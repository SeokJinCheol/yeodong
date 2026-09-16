import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings,'database_path',str(tmp_path/'test.db'))
    monkeypatch.setattr(settings,'google_maps_api_key','')
    with TestClient(app) as client:
        yield client


def test_add_replan_delete_and_persistence(client):
    places = client.get('/api/places').json()
    date = places[0]['visit_date']
    payload = dict(visit_date=date,start_id=1,end_id=5,mode='WALK')
    original = client.post('/api/plan',json=payload).json()
    new = client.post('/api/places',json=dict(name='추가 장소',lat=35.692,lng=139.701,visit_date=date,stay_minutes=25))
    assert new.status_code == 201
    id = new.json()['id']
    result = client.post('/api/plan',json=payload).json()
    assert id in [p['id'] for p in result['places']]
    assert len(result['legs']) == len(original['legs'])+1
    assert result['total_travel_seconds'] == sum(l['duration_seconds'] for l in result['legs'])
    assert result['total_stay_minutes'] == original['total_stay_minutes']+25
    assert result['source'] == 'estimate'
    assert result['places'][0]['id'] == 1 and result['places'][-1]['id'] == 5
    assert any(p['id']==id for p in client.get('/api/places').json())
    assert client.delete(f'/api/places/{id}').status_code == 204
    assert id not in [p['id'] for p in client.post('/api/plan',json=payload).json()['places']]


def test_course_assignment_and_validation(client):
    courses = client.get('/api/courses').json()
    ids = [p['id'] for p in courses[0]['places']]
    assert client.post('/api/courses/assign',json=dict(place_ids=ids,visit_date='2026-10-12')).status_code == 200
    assert not any(p['id'] in ids for g in client.get('/api/courses').json() for p in g['places'])
    assert client.post('/api/places',json=dict(name='bad',lat=100,lng=0)).status_code == 422
    assert client.post('/api/plan',json=dict(visit_date='2026-10-12',start_id=1,end_id=999)).status_code == 404
    assert client.get('/api/search?q=도쿄').status_code == 503


def test_limit_and_round_trip(client):
    date = client.get('/api/places').json()[0]['visit_date']
    payload = dict(visit_date=date,start_id=1,end_id=1)
    result = client.post('/api/plan',json=payload).json()
    assert result['places'][0]['id'] == result['places'][-1]['id'] == 1
    for i in range(6):
        client.post('/api/places',json=dict(name=f'extra{i}',lat=35.7,lng=139.7,visit_date=date))
    assert client.post('/api/plan',json=payload).status_code == 422


def test_transit_requires_google_key(client):
    date = client.get('/api/places').json()[0]['visit_date']
    result = client.post('/api/plan',json=dict(visit_date=date,start_id=1,end_id=5,mode='TRANSIT'))
    assert result.status_code == 503


def test_edit_stay_and_required_time_persist_and_recalculate(client):
    place=client.get('/api/places').json()[1]
    result=client.put(f"/api/places/{place['id']}",json={**place,'name':'예약 장소','stay_minutes':45,'required_time':'12:00'})
    assert result.status_code==200
    stored=next(p for p in client.get('/api/places').json() if p['id']==place['id'])
    assert stored['stay_minutes']==45 and stored['required_time']=='12:00'
    plan=client.post('/api/plan',json=dict(visit_date=place['visit_date'],start_id=1,end_id=5)).json()
    visit=next(s for s in plan['schedule'] if s['place_id']==place['id'])
    assert plan['schedule_feasible'] and visit['wait_seconds']>0
    assert visit['required_time']=='12:00'
    assert plan['total_elapsed_seconds']==plan['total_travel_seconds']+plan['total_stay_minutes']*60+plan['total_wait_seconds']
    assert client.put(f"/api/places/{place['id']}",json={**stored,'required_time':'25:00'}).status_code==422
    assert client.put(f"/api/places/{place['id']}",json={**stored,'required_time':None}).status_code==200


def test_transit_plan_uses_matrix_then_sequential_legs(client,monkeypatch):
    from app import google
    monkeypatch.setattr(settings,'google_maps_api_key','test-key')
    calls=[]
    async def fake_request(url,body,mask):
        calls.append(body)
        if 'computeRouteMatrix' in url:
            n=len(body['origins'])
            return [dict(originIndex=i,destinationIndex=j,duration='600s',condition='ROUTE_EXISTS') for i in range(n) for j in range(n)]
        return {'routes':[{'duration':'600s','legs':[{'distanceMeters':1000,'steps':[
            {'travelMode':'TRANSIT','staticDuration':'600s','transitDetails':{'transitLine':{'nameShort':'24'}}}
        ]}], 'polyline':{'geoJsonLinestring':{'coordinates':[[139.7,35.69],[139.71,35.70]]}}}]}
    monkeypatch.setattr(google,'request',fake_request)
    date=client.get('/api/places').json()[0]['visit_date']
    response=client.post('/api/plan',json=dict(visit_date=date,start_id=1,end_id=5,mode='TRANSIT',departure_time='09:00'))
    assert response.status_code==200
    plan=response.json()
    assert plan['total_travel_seconds']==2400
    assert plan['total_stay_minutes']==150
    assert len(plan['legs'])==4 and len(calls)==5
    assert plan['places'][0]['id']==1 and plan['places'][-1]['id']==5
    assert all(l['steps'][0]['line']=='24' for l in plan['legs'])


def test_move_day_preserves_places_and_rejects_occupied_date(client):
    before = client.get('/api/places').json()
    source = before[0]['visit_date']
    place = before[1]
    client.put(f"/api/places/{place['id']}", json={**place, 'required_time':'12:00','stay_minutes':45})
    before = client.get('/api/places').json()
    response = client.post('/api/days/move',json={'source_date':source,'target_date':'2028-01-01'})
    assert response.status_code == 200
    after = client.get('/api/places').json()
    assert after == [{**p,'visit_date':'2028-01-01'} if p['visit_date']==source else p for p in before]
    client.post('/api/places',json={'name':'other','lat':0,'lng':0,'visit_date':'2028-01-02'})
    snapshot = client.get('/api/places').json()
    assert client.post('/api/days/move',json={'source_date':'2028-01-01','target_date':'2028-01-02'}).status_code == 409
    assert client.get('/api/places').json() == snapshot


def test_required_order_saved_and_applied(client):
    places = client.get('/api/places').json()
    for index,rank in [(1,2),(2,1)]:
        p=places[index]
        assert client.put(f"/api/places/{p['id']}",json={**p,'required_order':rank}).status_code==200
    result=client.post('/api/plan',json={'visit_date':places[0]['visit_date'],'start_id':1,'end_id':5}).json()
    ids=[p['id'] for p in result['places']]
    assert ids.index(3)<ids.index(2)
    stored=client.get('/api/places').json()[1]
    assert stored['required_order']==2
    assert client.put('/api/places/2',json={**stored,'required_order':0}).status_code==422
    assert client.put('/api/places/2',json={**stored,'required_order':None}).json()['required_order'] is None


def test_single_required_step_changes_after_edit(client):
    p=client.get('/api/places').json()[1]
    payload={'visit_date':p['visit_date'],'start_id':1,'end_id':5}
    for step in [3,1,2]:
        assert client.put(f"/api/places/{p['id']}",json={**p,'required_order':step}).status_code==200
        response=client.post('/api/plan',json=payload)
        assert response.status_code==200
        assert response.json()['places'][step]['id']==p['id']
    client.put(f"/api/places/{p['id']}",json={**p,'required_order':4})
    assert client.post('/api/plan',json=payload).status_code==422


def test_place_checklist_and_description_persist(client):
    p=client.get('/api/places').json()[1]
    tasks=[{'id':'a','text':'메뉴 주문','description':'추천 메뉴 2개','done':False},{'id':'b','text':'사진 찍기','done':False}]
    response=client.put(f"/api/places/{p['id']}",json={**p,'description':'예약 정보\n창가 좌석','tasks':tasks})
    assert response.status_code==200
    checked=client.patch(f"/api/places/{p['id']}/tasks/a",json={'done':True}).json()
    assert checked['tasks'][0]['done'] and not checked['tasks'][1]['done']
    assert checked['description']=='예약 정보\n창가 좌석'
    stored=next(x for x in client.get('/api/places').json() if x['id']==p['id'])
    assert stored==checked
    assert client.patch(f"/api/places/{p['id']}/tasks/missing",json={'done':True}).status_code==404
    assert client.patch(f"/api/places/{p['id']}/tasks/a",json={'done':False}).json()['tasks'][0]['done'] is False
    assert client.put(f"/api/places/{p['id']}",json={**checked,'tasks':[]}).json()['tasks']==[]


def test_saved_route_skips_recalculation_and_refreshes_metadata(client,monkeypatch):
    from app import main
    calls=[]
    original=main.estimate_matrix
    def counted(*args):
        calls.append(1)
        return original(*args)
    monkeypatch.setattr(main,'estimate_matrix',counted)
    place=client.get('/api/places').json()[1]
    payload={'visit_date':place['visit_date'],'start_id':1,'end_id':5}
    assert client.post('/api/plan',json=payload).json()['cache_hit'] is False
    assert client.post('/api/plan',json=payload).json()['cache_hit'] is True
    assert len(calls)==1
    client.put('/api/places/2',json={**place,'description':'new memo'})
    saved=client.post('/api/plan',json=payload).json()
    assert saved['cache_hit'] and next(p for p in saved['places'] if p['id']==2)['description']=='new memo'
    assert len(calls)==1
    assert not client.post('/api/plan',json={**payload,'force_refresh':True}).json()['cache_hit']
    client.put('/api/places/2',json={**place,'stay_minutes':10})
    assert not client.post('/api/plan',json=payload).json()['cache_hit']
    assert len(calls)==3
    from app import db
    with db.connection() as conn:
        conn.execute('UPDATE saved_plans SET saved_at=0')
    assert not client.post('/api/plan',json=payload).json()['cache_hit']
    assert len(calls)==4


def test_unreachable_route_keeps_places(client,monkeypatch):
    from app import main
    before=client.get('/api/places').json()
    monkeypatch.setattr(main,'estimate_matrix',lambda nodes,mode:[[0 if i==j else float('inf') for j in range(len(nodes))] for i in range(len(nodes))])
    response=client.post('/api/plan',json={'visit_date':before[0]['visit_date'],'start_id':1,'end_id':5})
    assert response.status_code==422
    assert response.headers.get('X-Route-Unavailable')=='true'
    assert client.get('/api/places').json()==before


def test_map_place_returns_name_and_coordinates(client,monkeypatch):
    import httpx
    from app import google
    monkeypatch.setattr(settings,'google_maps_api_key','test')
    original_client=httpx.AsyncClient
    def respond(request):
        assert request.method=='GET'
        assert request.url.path=='/v1/places/example-id'
        assert request.headers['X-Goog-FieldMask']=='id,displayName,formattedAddress,location'
        return httpx.Response(200,json={'id':'example-id','displayName':{'text':'선택한 카페'},'formattedAddress':'도쿄', 'location':{'latitude':35.6,'longitude':139.7}})
    monkeypatch.setattr(google.httpx,'AsyncClient',lambda **kwargs:original_client(transport=httpx.MockTransport(respond),**kwargs))
    result=client.get('/api/map-place?place_id=example-id')
    assert result.status_code==200
    assert result.json()==dict(name='선택한 카페',address='도쿄',lat=35.6,lng=139.7,google_place_id='example-id')
    assert client.get('/api/map-place?place_id=').status_code==422
