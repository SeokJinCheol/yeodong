from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from . import google


def departure_for(payload):
    try:
        zone = ZoneInfo(payload.time_zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, '올바른 여행지 시간대를 선택해 주세요.') from None
    departure = datetime.combine(payload.visit_date, payload.departure_time.replace(tzinfo=None), zone).astimezone(timezone.utc)
    if payload.mode == 'TRANSIT':
        validate_window(departure)
    return departure


def validate_window(departure):
    now = datetime.now(timezone.utc)
    if not now-timedelta(days=7) <= departure <= now+timedelta(days=100):
        raise HTTPException(422, '대중교통은 현재 기준 과거 7일~미래 100일 이내의 출발 시각만 조회할 수 있습니다.')


def seconds(value):
    return float((value or '0s').removesuffix('s'))


def parse_steps(raw_steps):
    result = []
    for raw in raw_steps:
        details = raw.get('transitDetails', {})
        stops = details.get('stopDetails', {})
        line = details.get('transitLine', {})
        item = dict(mode=raw.get('travelMode','WALK'),
                    duration_seconds=round(seconds(raw.get('staticDuration'))),
                    distance_meters=raw.get('distanceMeters',0),
                    instruction=raw.get('navigationInstruction',{}).get('instructions',''),
                    line=line.get('nameShort') or line.get('name',''),
                    line_name=line.get('name',''),
                    vehicle=line.get('vehicle',{}).get('name',{}).get('text','대중교통'),
                    departure_stop=stops.get('departureStop',{}).get('name',''),
                    arrival_stop=stops.get('arrivalStop',{}).get('name',''),
                    departure_time=stops.get('departureTime'), arrival_time=stops.get('arrivalTime'),
                    headsign=details.get('headsign',''), stop_count=details.get('stopCount'),
                    agencies=[dict(name=a.get('name',''),url=a.get('uri','')) for a in line.get('agencies',[])])
        # Combine consecutive walking instructions without hiding station access time.
        if item['mode']=='WALK' and result and result[-1]['mode']=='WALK':
            result[-1]['duration_seconds'] += item['duration_seconds']
            result[-1]['distance_meters'] += item['distance_meters']
            result[-1]['instruction'] = '다음 장소 또는 승차 지점까지 도보 이동'
        else:
            result.append(item)
    return result


async def route_details(places, departure, appointments=None):
    legs, coordinates = [], []
    cursor = departure
    appointments = appointments or {}
    cursor = max(cursor, appointments.get(places[0].get('id'),cursor))
    for origin, destination in zip(places, places[1:]):
        validate_window(cursor)
        if origin['lat']==destination['lat'] and origin['lng']==destination['lng']:
            legs.append(dict(duration='0s',distanceMeters=0,steps=[],departure_time=cursor.isoformat(),arrival_time=cursor.isoformat(),transfer_count=0,warnings=[]))
            coordinates.append([origin['lng'],origin['lat']])
        else:
            data = await google.request('https://routes.googleapis.com/directions/v2:computeRoutes', {
                'origin':google.waypoint(origin), 'destination':google.waypoint(destination),
                'travelMode':'TRANSIT', 'departureTime':cursor.isoformat(),
                'languageCode':'ko', 'polylineEncoding':'GEO_JSON_LINESTRING',
            }, 'routes.duration,routes.legs.duration,routes.legs.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails,routes.polyline.geoJsonLinestring,routes.warnings')
            if not data.get('routes'):
                raise HTTPException(422, f"{origin['name']} → {destination['name']}: 해당 시각의 대중교통 경로가 없습니다. 출발 시각이나 이동수단을 변경해 주세요.", headers={'X-Route-Unavailable':'true'})
            route = data['routes'][0]
            if len(route.get('legs',[])) != 1:
                raise HTTPException(502, '대중교통 경로 응답이 불완전합니다.')
            leg = route['legs'][0]
            duration = seconds(route.get('duration',leg.get('duration')))
            steps = parse_steps(leg.get('steps',[]))
            arrival = cursor + timedelta(seconds=duration)
            legs.append(dict(duration=f'{duration}s', distanceMeters=leg.get('distanceMeters',0),
                             steps=steps,departure_time=cursor.isoformat(),arrival_time=arrival.isoformat(),
                             transfer_count=max(0,sum(s['mode']=='TRANSIT' for s in steps)-1),warnings=route.get('warnings',[])))
            coordinates.extend(route.get('polyline',{}).get('geoJsonLinestring',{}).get('coordinates',[]))
            cursor = arrival
        # The next segment starts after the visit, not at the original day's departure.
        cursor = max(cursor, appointments.get(destination.get('id'),cursor))
        cursor += timedelta(minutes=destination['stay_minutes'])
    return legs, coordinates
