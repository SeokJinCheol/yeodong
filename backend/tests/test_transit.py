import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app import google, transit
from app.models import PlanInput


def test_departure_timezone_and_invalid_window():
    now = datetime.now(timezone.utc)
    payload = PlanInput(visit_date=now.date(),start_id=1,end_id=2,mode='TRANSIT',departure_time='09:00',time_zone='Asia/Tokyo')
    assert transit.departure_for(payload).hour == 0
    payload.time_zone = 'invalid-zone'
    with pytest.raises(HTTPException):
        transit.departure_for(payload)
    with pytest.raises(HTTPException):
        transit.validate_window(now+timedelta(days=101))


def test_segments_advance_by_travel_and_stay_and_keep_transfers(monkeypatch):
    start = datetime.now(timezone.utc).replace(microsecond=0)
    calls=[]
    async def fake_request(url,body,mask):
        calls.append(body)
        assert body['travelMode']=='TRANSIT' and 'intermediates' not in body
        return {'routes':[{'duration':'600s','legs':[{'distanceMeters':1200,'steps':[
            {'travelMode':'WALK','staticDuration':'60s','distanceMeters':80},
            {'travelMode':'WALK','staticDuration':'60s','distanceMeters':80},
            {'travelMode':'TRANSIT','staticDuration':'200s','transitDetails':{
                'stopDetails':{'departureStop':{'name':'A역'},'arrivalStop':{'name':'B역'}},
                'transitLine':{'nameShort':'3','name':'3번 버스'},'stopCount':2}},
            {'travelMode':'TRANSIT','staticDuration':'180s','transitDetails':{'transitLine':{'name':'지하철'}}},
        ]}], 'polyline':{'geoJsonLinestring':{'coordinates':[[1,1],[2,2]]}}}]}
    monkeypatch.setattr(google,'request',fake_request)
    places=[dict(id=i,name=str(i),lat=i,lng=i,stay_minutes=30) for i in [1,2,3]]
    legs,coords=asyncio.run(transit.route_details(places,start))
    assert len(calls)==2 and len(legs)==2 and len(coords)==4
    assert datetime.fromisoformat(calls[1]['departureTime']) == start+timedelta(minutes=40)
    assert legs[0]['transfer_count']==1
    assert legs[0]['steps'][0]['duration_seconds']==120
    assert legs[0]['steps'][1]['departure_stop']=='A역'
    assert legs[0]['steps'][1]['line']=='3'


def test_unavailable_route_and_same_location(monkeypatch):
    async def empty(*args): return {}
    monkeypatch.setattr(google,'request',empty)
    p=dict(name='A',lat=0,lng=0,stay_minutes=0)
    now=datetime.now(timezone.utc)
    legs,_=asyncio.run(transit.route_details([p,p],now))
    assert legs[0]['duration']=='0s'
    with pytest.raises(HTTPException) as err:
        asyncio.run(transit.route_details([p,dict(p,lat=1,name='B')],now))
    assert err.value.status_code==422


def test_appointment_wait_delays_next_transit_query(monkeypatch):
    start = datetime.now(timezone.utc).replace(microsecond=0)
    calls = []
    async def fake_request(url, body, mask):
        calls.append(body)
        return {'routes': [{'duration': '600s', 'legs': [{'distanceMeters': 1000}]}]}
    monkeypatch.setattr(google, 'request', fake_request)
    places = [dict(id=i, name=str(i), lat=i, lng=i, stay_minutes=30) for i in [1,2,3]]
    asyncio.run(transit.route_details(places, start, {2: start+timedelta(hours=1)}))
    assert datetime.fromisoformat(calls[1]['departureTime']) == start+timedelta(minutes=90)
