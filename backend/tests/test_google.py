import asyncio

from app import google


def test_google_matrix_handles_unordered_results_and_unreachable_edges(monkeypatch):
    async def fake_request(url, body, mask):
        assert 'computeRouteMatrix' in url
        assert body['travelMode'] == 'WALK'
        assert 'status' in mask
        return [
            {'originIndex':1,'destinationIndex':0,'duration':'75s','condition':'ROUTE_EXISTS'},
            {'originIndex':0,'destinationIndex':1,'condition':'ROUTE_NOT_FOUND'},
        ]
    monkeypatch.setattr(google,'request',fake_request)
    matrix = asyncio.run(google.time_matrix([{'lat':0,'lng':0},{'lat':1,'lng':1}],'WALK'))
    assert matrix == [[0,float('inf')],[75,0]]


def test_google_route_keeps_optimized_order_and_extracts_geojson(monkeypatch):
    async def fake_request(url, body, mask):
        assert 'computeRoutes' in url
        assert body['intermediates'][0]['location']['latLng']['latitude'] == 2
        assert body['polylineEncoding'] == 'GEO_JSON_LINESTRING'
        return {'routes':[{'legs':[{'duration':'60s','distanceMeters':100},{'duration':'90s','distanceMeters':150}],
                           'polyline':{'geoJsonLinestring':{'coordinates':[[1,1],[2,2],[3,3]]}}}]}
    monkeypatch.setattr(google,'request',fake_request)
    legs,coords = asyncio.run(google.route_details([{'lat':i,'lng':i} for i in [1,2,3]],'DRIVE'))
    assert len(legs) == 2
    assert coords == [[1,1],[2,2],[3,3]]
