import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app import geocoding
from app.config import settings


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(settings, 'photon_url', 'https://photon.test')
    monkeypatch.setattr(geocoding, '_cache', geocoding.OrderedDict())
    monkeypatch.setattr(geocoding, '_lock', asyncio.Lock())
    monkeypatch.setattr(geocoding, '_last_request', 0)


def test_search_coordinates_and_cache(monkeypatch):
    calls = []
    original = httpx.AsyncClient
    def respond(request):
        calls.append(request)
        assert request.url.host == 'photon.test'
        assert request.url.path == '/api/'
        assert request.url.params['q'] == 'Tokyo'
        assert request.headers['User-Agent'].startswith('Yeodong')
        return httpx.Response(200, json={'features':[{'geometry':{'coordinates':[139.76,35.68]},'properties':{'name':'Tokyo','city':'Tokyo','country':'Japan'}}]})
    monkeypatch.setattr(geocoding.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    async def run():
        first = await geocoding.search_places(' Tokyo ')
        second = await geocoding.search_places('Tokyo')
        assert first == second == [dict(name='Tokyo',address='Tokyo, Japan',lat=35.68,lng=139.76)]
    asyncio.run(run())
    assert len(calls) == 1


@pytest.mark.parametrize('status,data', [(503,{}), (200,{}), (200,{'features':[{'geometry':{'coordinates':[999,35]},'properties':{}}]})])
def test_bad_search_results_fail_cleanly(monkeypatch, status, data):
    original = httpx.AsyncClient
    monkeypatch.setattr(geocoding.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(lambda request:httpx.Response(status,json=data)), **kwargs))
    with pytest.raises(HTTPException) as error:
        asyncio.run(geocoding.search_places('Tokyo'))
    assert error.value.status_code == 502
