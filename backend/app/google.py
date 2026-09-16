import httpx
from fastapi import HTTPException

from .config import settings


def waypoint(place):
    return {'location': {'latLng': {'latitude': place['lat'], 'longitude': place['lng']}}}


async def request(url, body, mask):
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            result = await client.post(url, json=body, headers={
                'X-Goog-Api-Key': settings.google_maps_api_key,
                'X-Goog-FieldMask': mask,
            })
            result.raise_for_status()
            return result.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, 'Google API 요청에 실패했습니다. 서버 키, API 활성화, 할당량을 확인해 주세요.') from None


async def search_places(query):
    data = await request('https://places.googleapis.com/v1/places:searchText',
                         {'textQuery': query, 'languageCode': 'ko', 'maxResultCount': 6},
                         'places.id,places.displayName,places.formattedAddress,places.location')
    return [dict(name=p['displayName']['text'], address=p.get('formattedAddress',''),
                 lat=p['location']['latitude'], lng=p['location']['longitude'],
                 google_place_id=p['id']) for p in data.get('places', [])]


async def time_matrix(places, mode, departure=None):
    n = len(places)
    data = await request('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        'origins': [{'waypoint': waypoint(p)} for p in places],
        'destinations': [{'waypoint': waypoint(p)} for p in places],
        'travelMode': mode,
        **({'departureTime': departure.isoformat()} if departure else {}),
    }, 'originIndex,destinationIndex,duration,status,condition')
    matrix = [[float('inf')]*n for _ in places]
    for cell in data:
        i, j = cell.get('originIndex',0), cell.get('destinationIndex',0)
        if cell.get('condition') == 'ROUTE_EXISTS' and not cell.get('status',{}).get('code'):
            matrix[i][j] = float(cell.get('duration','0s').removesuffix('s'))
    for i in range(n):
        matrix[i][i] = 0
    return matrix


async def route_details(places, mode):
    data = await request('https://routes.googleapis.com/directions/v2:computeRoutes', {
        'origin': waypoint(places[0]), 'destination': waypoint(places[-1]),
        'intermediates': [waypoint(p) for p in places[1:-1]],
        'travelMode': mode, 'languageCode': 'ko',
        'polylineEncoding': 'GEO_JSON_LINESTRING',
    }, 'routes.legs.duration,routes.legs.distanceMeters,routes.polyline.geoJsonLinestring')
    if not data.get('routes'):
        raise HTTPException(422, '선택한 이동수단으로 연결할 수 있는 경로가 없습니다.', headers={'X-Route-Unavailable':'true'})
    route = data['routes'][0]
    return route['legs'], route.get('polyline',{}).get('geoJsonLinestring',{}).get('coordinates', [])


async def place_details(place_id):
    from urllib.parse import quote
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f'https://places.googleapis.com/v1/places/{quote(place_id, safe="")}',
                params={'languageCode':'ko'}, headers={'X-Goog-Api-Key':settings.google_maps_api_key,
                'X-Goog-FieldMask':'id,displayName,formattedAddress,location'})
            response.raise_for_status()
            p=response.json()
            return dict(name=p['displayName']['text'],address=p.get('formattedAddress',''),
                        lat=p['location']['latitude'],lng=p['location']['longitude'],google_place_id=p['id'])
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, '장소 정보를 불러오지 못했습니다. 잠시 후 다시 선택해 주세요.') from None
