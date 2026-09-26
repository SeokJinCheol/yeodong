import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app import valhalla
from app.config import settings

POINTS = [{'lat':35.0, 'lng':139.0}, {'lat':35.1, 'lng':139.1}, {'lat':35.0, 'lng':139.0}]


def test_matrix_units_costing_and_unreachable(monkeypatch):
    async def request(action, body):
        assert action == 'sources_to_targets'
        assert body['costing'] == 'pedestrian'
        assert body['sources'] == body['targets'] == [{'lat':p['lat'], 'lon':p['lng']} for p in POINTS]
        return {'sources_to_targets': [[{'time':0},{'time':12},{'time':0}],
                                     [{'time':None},{'time':0},{'time':15}],
                                     [{'time':0},{'time':12},{'time':0}]]}
    monkeypatch.setattr(valhalla, 'request', request)
    matrix = asyncio.run(valhalla.time_matrix(POINTS, 'WALK'))
    assert matrix == [[0,12,0],[float('inf'),0,15],[0,12,0]]


def test_route_keeps_round_trip_and_osrm_meters(monkeypatch):
    async def request(action, body):
        assert action == 'route' and body['costing'] == 'auto'
        assert body['shape_format'] == 'geojson'
        assert body['locations'] == [{**valhalla.location(p), 'type':'break'} for p in POINTS]
        assert body['format'] == 'osrm'
        return {'code':'Ok', 'routes':[{'legs': [
            {'duration':60, 'distance':1250}, {'duration':75, 'distance':1500},
        ], 'geometry':{'type':'LineString', 'coordinates':[[139,35],[139.1,35.1],[139,35]]}}]}
    monkeypatch.setattr(valhalla, 'request', request)
    legs, coords = asyncio.run(valhalla.route_details(POINTS, 'DRIVE'))
    assert [leg['distanceMeters'] for leg in legs] == [1250,1500]
    assert coords == [[139,35],[139.1,35.1],[139,35]]


@pytest.mark.parametrize('data', [{}, {'sources_to_targets':[]}, {'sources_to_targets':[[{'time':-1}]]}])
def test_invalid_matrix_fails_without_estimates(monkeypatch, data):
    async def request(*args):
        return data
    monkeypatch.setattr(valhalla, 'request', request)
    with pytest.raises(HTTPException) as error:
        asyncio.run(valhalla.time_matrix(POINTS, 'WALK'))
    assert error.value.status_code == 502


@pytest.mark.parametrize('status,body,expected', [(500,{},502), (400,{'error_code':442},422), (200,{'ok':True},200)])
def test_http_adapter(monkeypatch, status, body, expected):
    monkeypatch.setattr(settings, 'valhalla_url', 'http://valhalla.test:8002/')
    original = httpx.AsyncClient
    def respond(request):
        assert str(request.url) == 'http://valhalla.test:8002/route'
        assert 'X-Goog-Api-Key' not in request.headers
        return httpx.Response(status, json=body)
    monkeypatch.setattr(valhalla.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    if expected == 200:
        assert asyncio.run(valhalla.request('route', {})) == body
    else:
        with pytest.raises(HTTPException) as error:
            asyncio.run(valhalla.request('route', {}))
        assert error.value.status_code == expected


@pytest.mark.parametrize('data', [{}, {'code':'Ok','routes':[]}, {'code':'Ok','routes':[{'legs':[]}]}])
def test_incomplete_route_is_rejected(monkeypatch, data):
    async def request(*args):
        return data
    monkeypatch.setattr(valhalla, 'request', request)
    with pytest.raises(HTTPException) as error:
        asyncio.run(valhalla.route_details(POINTS, 'WALK'))
    assert error.value.status_code == 502


def test_missing_server_and_timeout(monkeypatch):
    monkeypatch.setattr(settings, 'valhalla_url', '')
    with pytest.raises(HTTPException) as error:
        asyncio.run(valhalla.request('route', {}))
    assert error.value.status_code == 503
    monkeypatch.setattr(settings, 'valhalla_url', 'http://valhalla.test')
    original = httpx.AsyncClient
    def timeout(request):
        raise httpx.ReadTimeout('timeout', request=request)
    monkeypatch.setattr(valhalla.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(timeout), **kwargs))
    with pytest.raises(HTTPException) as error:
        asyncio.run(valhalla.request('route', {}))
    assert error.value.status_code == 502
