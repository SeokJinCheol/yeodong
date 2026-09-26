"""Valhalla routing; Google is never used as a routing fallback."""
import math

import httpx
from fastapi import HTTPException

from .config import settings


def costing(mode):
    if mode not in ('WALK', 'DRIVE'):
        raise HTTPException(422, 'Valhalla 대중교통 동선 최적화는 지원하지 않습니다. 구간별 Google 지도 링크에서 교통편을 확인해 주세요.',
                            headers={'X-Route-Unavailable': 'true'})
    return {'WALK': 'pedestrian', 'DRIVE': 'auto'}[mode]


async def request(action, body):
    if not settings.valhalla_url:
        raise HTTPException(503, 'Valhalla 서버 주소(VALHALLA_URL)를 설정해 주세요.')
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{settings.valhalla_url.rstrip('/')}/{action}", json=body)
            if response.status_code == 400:
                error = response.json().get('error_code')
                if error in (170, 171, 441, 442):
                    raise HTTPException(422, 'Valhalla에서 연결 가능한 경로를 찾지 못했습니다. 장소와 이동수단을 확인해 주세요.',
                                        headers={'X-Route-Unavailable': 'true'})
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, 'Valhalla 경로 요청에 실패했습니다. 서버 주소, 지도 데이터 및 연결 상태를 확인해 주세요.') from None


def location(place):
    return {'lat': place['lat'], 'lon': place['lng']}


def nonnegative(value):
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError('Invalid route measurement')
    return number


async def time_matrix(places, mode):
    points = [location(p) for p in places]
    data = await request('sources_to_targets', {'sources': points, 'targets': points,
                         'costing': costing(mode), 'units': 'kilometers', 'verbose': True})
    try:
        rows = data['sources_to_targets']
        if len(rows) != len(points) or any(len(row) != len(points) for row in rows):
            raise ValueError('Incomplete matrix')
        matrix = [[float('inf') if cell['time'] is None else nonnegative(cell['time'])
                   for cell in row] for row in rows]
        for i in range(len(points)):
            matrix[i][i] = 0
        return matrix
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, 'Valhalla 이동시간 행렬 응답이 불완전합니다.') from None


async def route_details(places, mode):
    # GeoJSON output is supported by Valhalla's OSRM serialization. Its leg
    # distances are meters (unlike the native JSON summary.length in km).
    data = await request('route', {'locations': [{**location(p), 'type': 'break'} for p in places],
                         'costing': costing(mode), 'units': 'kilometers',
                         'format': 'osrm', 'shape_format': 'geojson', 'overview': 'full'})
    try:
        route = data['routes'][0]
        if data.get('code') != 'Ok' or len(route['legs']) != len(places)-1:
            raise ValueError('Incomplete route')
        legs = [{'duration': f"{nonnegative(leg['duration'])}s",
                 'distanceMeters': round(nonnegative(leg['distance']))} for leg in route['legs']]
        coordinates = route['geometry']['coordinates']
        if not coordinates or any(len(p) != 2 or not all(math.isfinite(float(v)) for v in p) for p in coordinates):
            raise ValueError('Invalid geometry')
        return legs, coordinates
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(502, 'Valhalla 경로 구간 응답이 불완전합니다.') from None
