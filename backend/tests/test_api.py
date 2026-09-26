import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings,'database_path',str(tmp_path/'test.db'))
    monkeypatch.setattr(settings,'photon_url','')
    from app import valhalla
    from app.routing import estimate_matrix, distance
    async def matrix(places, mode):
        return estimate_matrix(places, mode)
    async def route(places, mode):
        times = estimate_matrix(places, mode)
        return ([dict(duration=f'{times[i][i+1]}s', distanceMeters=round(distance(a,b)))
                 for i,(a,b) in enumerate(zip(places, places[1:]))],
                [[p['lng'],p['lat']] for p in places])
    monkeypatch.setattr(valhalla, 'time_matrix', matrix)
    monkeypatch.setattr(valhalla, 'route_details', route)
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
    assert result['source'] == 'valhalla'
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


def test_transit_reports_unsupported(client):
    date = client.get('/api/places').json()[0]['visit_date']
    result = client.post('/api/plan',json=dict(visit_date=date,start_id=1,end_id=5,mode='TRANSIT'))
    assert result.status_code == 422
    assert result.headers["X-Route-Unavailable"] == "true"


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


def test_routing_uses_only_valhalla(client, monkeypatch):
    import httpx
    async def forbidden(*args, **kwargs):
        pytest.fail('Planning must only use the mocked Valhalla adapter')
    monkeypatch.setattr(httpx.AsyncClient, 'request', forbidden)
    date = client.get('/api/places').json()[0]['visit_date']
    for mode in ('WALK', 'DRIVE'):
        result = client.post('/api/plan', json=dict(visit_date=date, start_id=1, end_id=5, mode=mode))
        assert result.status_code == 200
        assert result.json()['source'] == 'valhalla'
    result = client.post('/api/plan', json=dict(visit_date=date, start_id=1, end_id=5, mode='TRANSIT'))
    assert result.status_code == 422


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
    from app import valhalla
    calls=[]
    original=valhalla.time_matrix
    async def counted(*args):
        calls.append(1)
        return await original(*args)
    monkeypatch.setattr(valhalla,'time_matrix',counted)
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
    from app import valhalla
    before=client.get('/api/places').json()
    async def unreachable(nodes, mode):
        return [[0 if i==j else float('inf') for j in range(len(nodes))] for i in range(len(nodes))]
    monkeypatch.setattr(valhalla, 'time_matrix', unreachable)
    response=client.post('/api/plan',json={'visit_date':before[0]['visit_date'],'start_id':1,'end_id':5})
    assert response.status_code==422
    assert response.headers.get('X-Route-Unavailable')=='true'
    assert client.get('/api/places').json()==before


def test_search_uses_geocoding_and_google_details_are_removed(client, monkeypatch):
    from app import geocoding
    async def search(query):
        assert query == 'Tokyo'
        return [dict(name='Tokyo', address='Japan', lat=35.6, lng=139.7)]
    monkeypatch.setattr(geocoding, 'search_places', search)
    assert client.get('/api/search?q=Tokyo').json()[0]['name'] == 'Tokyo'
    assert client.get('/api/map-place?place_id=old-google-id').status_code == 404


def test_sections_isolate_routes_and_validate_place_dates(client):
    original = client.get('/api/places').json()
    date = original[0]['visit_date']
    section = client.post('/api/sections', json={'name':'오후','visit_date':date}).json()
    ids = []
    for i in range(3):
        response = client.post('/api/places', json={
            'name':f'오후 장소 {i}', 'lat':35.69+i*.001, 'lng':139.7,
            'visit_date':date, 'section_id':section['id'],
        })
        assert response.status_code == 201
        ids.append(response.json()['id'])
    payload = {'visit_date':date, 'section_id':section['id'], 'start_id':ids[0], 'end_id':ids[-1]}
    result = client.post('/api/plan', json=payload)
    assert result.status_code == 200
    assert [p['id'] for p in result.json()['places']] == ids
    assert client.post('/api/plan', json=payload).json()['cache_hit']
    default = client.post('/api/plan', json={'visit_date':date, 'start_id':1, 'end_id':5}).json()
    assert not set(ids) & {p['id'] for p in default['places']}
    assert client.post('/api/plan', json={**payload,'start_id':1}).status_code == 404
    for section_id, visit_date in [(section['id'], '2040-01-01'), (999, date), (section['id'], None)]:
        assert client.post('/api/places', json={'name':'invalid','lat':0,'lng':0,'visit_date':visit_date,'section_id':section_id}).status_code == 422
    moved = client.put('/api/places/2', json={**original[1], 'section_id':section['id']})
    assert moved.status_code == 200
    assert 2 in {p['id'] for p in client.post('/api/plan', json=payload).json()['places']}
    assert 2 not in {p['id'] for p in client.post('/api/plan', json={'visit_date':date,'start_id':1,'end_id':5}).json()['places']}
    assert client.post('/api/sections', json={'name':'   ','visit_date':date}).status_code == 422
    assert client.put(f"/api/sections/{section['id']}", json={'name':'저녁','visit_date':date}).json()['name'] == '저녁'


def test_move_day_preserves_sections_and_their_places(client):
    place = client.get('/api/places').json()[1]
    date = place['visit_date']
    section = client.post('/api/sections', json={'name':'오전','visit_date':date}).json()
    client.put(f"/api/places/{place['id']}", json={**place,'section_id':section['id']})
    target = '2040-01-01'
    assert client.post('/api/days/move', json={'source_date':date,'target_date':target}).status_code == 200
    assert client.get('/api/sections').json() == [{**section,'visit_date':target}]
    updated = next(p for p in client.get('/api/places').json() if p['id']==place['id'])
    assert updated['section_id'] == section['id'] and updated['visit_date'] == target
    client.post('/api/sections', json={'name':'빈 구간','visit_date':'2040-01-02'})
    assert client.post('/api/days/move', json={'source_date':target,'target_date':'2040-01-02'}).status_code == 409


def test_migration_preserves_existing_places(tmp_path, monkeypatch):
    import sqlite3
    from app import db
    path = str(tmp_path/'legacy.db')
    with sqlite3.connect(path) as conn:
        conn.execute('CREATE TABLE places (id INTEGER PRIMARY KEY, name TEXT, lat REAL, lng REAL, address TEXT, area TEXT, visit_date TEXT, stay_minutes INTEGER, google_place_id TEXT)')
        conn.execute("INSERT INTO places VALUES (1,'기존 장소',35,139,'','','2026-09-18',60,NULL)")
        conn.execute('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)')
        conn.execute("INSERT INTO metadata VALUES ('seeded','1')")
    monkeypatch.setattr(settings,'database_path',path)
    db.init_db()
    db.init_db()
    places = db.all_places()
    assert len(places) == 1
    assert places[0]['name'] == '기존 장소' and places[0]['section_id'] is None


def test_assign_course_to_section(client):
    date = '2040-05-01'
    section = client.post('/api/sections', json={'name':'오후','visit_date':date}).json()
    ids = [p['id'] for p in client.get('/api/courses').json()[0]['places']]
    payload = {'visit_date':date,'section_id':section['id'],'place_ids':ids}
    assert client.post('/api/courses/assign', json={**payload,'visit_date':'2040-05-02'}).status_code == 422
    assert client.post('/api/courses/assign', json=payload).status_code == 200
    assigned = [p for p in client.get('/api/places').json() if p['id'] in ids]
    assert all(p['section_id']==section['id'] and p['visit_date']==date for p in assigned)


def test_delete_section_preserves_places_and_other_sections(client):
    before = client.get('/api/places').json()
    date = before[0]['visit_date']
    section = client.post('/api/sections', json={'name':'오전','visit_date':date}).json()
    other = client.post('/api/sections', json={'name':'오후','visit_date':date}).json()
    for place, section_id in [(before[1], section['id']), (before[2], other['id'])]:
        assert client.put(f"/api/places/{place['id']}", json={**place,'section_id':section_id}).status_code == 200
    snapshot = client.get('/api/places').json()
    assert client.delete(f"/api/sections/{section['id']}").status_code == 204
    assert client.get('/api/sections').json() == [other]
    assert client.get('/api/places').json() == [
        {**place,'section_id':None} if place['section_id']==section['id'] else place
        for place in snapshot
    ]
    plan = client.post('/api/plan', json={'visit_date':date,'start_id':1,'end_id':5})
    assert plan.status_code == 200
    assert before[1]['id'] in {p['id'] for p in plan.json()['places']}
    assert before[2]['id'] not in {p['id'] for p in plan.json()['places']}
    assert client.delete(f"/api/sections/{section['id']}").status_code == 404
    assert client.delete(f"/api/sections/{other['id']}").status_code == 204
    assert client.get('/api/places').json() == before
    empty = client.post('/api/sections', json={'name':'빈 구간','visit_date':date}).json()
    assert client.delete(f"/api/sections/{empty['id']}").status_code == 204
    assert client.get('/api/places').json() == before


def test_rename_default_section_persists_per_day_without_changing_places(client):
    from app import db
    before = client.get('/api/places').json()
    date = before[0]['visit_date']
    assert client.get('/api/default-sections').json() == {}
    response = client.put('/api/default-sections', json={'name':'  오전 산책  ','visit_date':date})
    assert response.status_code == 200
    assert response.json() == {'id':None,'name':'오전 산책','visit_date':date}
    db.init_db()
    assert client.get('/api/default-sections').json() == {date:'오전 산책'}
    for name in ['', '   ', 'x'*41]:
        assert client.put('/api/default-sections', json={'name':name,'visit_date':date}).status_code == 422
    client.put('/api/default-sections', json={'name':'둘째 날','visit_date':'2040-01-02'})
    client.put('/api/default-sections', json={'name':'첫째 날','visit_date':date})
    assert client.get('/api/default-sections').json() == {date:'첫째 날','2040-01-02':'둘째 날'}
    assert client.get('/api/places').json() == before
    assert client.get('/api/sections').json() == []
    assert client.post('/api/days/move', json={'source_date':date,'target_date':'2040-01-02'}).status_code == 409
    assert client.post('/api/days/move', json={'source_date':date,'target_date':'2040-01-03'}).status_code == 200
    assert client.get('/api/default-sections').json() == {'2040-01-03':'첫째 날','2040-01-02':'둘째 날'}


def test_delete_day_removes_all_sections_places_and_related_cache(client):
    from app import db
    import json
    before = client.get('/api/places').json()
    date = before[0]['visit_date']
    section = client.post('/api/sections', json={'name':'오후','visit_date':date}).json()
    client.put('/api/places/2', json={**before[1],'section_id':section['id']})
    client.put('/api/default-sections', json={'name':'오전','visit_date':date})
    other_date = '2040-02-01'
    other_section = client.post('/api/sections', json={'name':'다른 날','visit_date':other_date}).json()
    other_place = client.post('/api/places', json={'name':'보존','lat':0,'lng':0,'visit_date':other_date,'section_id':other_section['id']}).json()
    client.put('/api/default-sections', json={'name':'보존 이름','visit_date':other_date})
    assert client.post('/api/plan', json={'visit_date':date,'start_id':1,'end_id':5}).status_code == 200
    with db.connection() as conn:
        conn.execute('INSERT INTO saved_plans VALUES (?,?,?)', ('unrelated',json.dumps({'places':[other_place]}),1))
    assert client.delete(f'/api/days/{date}').status_code == 204
    assert client.get('/api/places').json() == [p for p in before if p['visit_date']!=date]+[other_place]
    assert client.get('/api/sections').json() == [other_section]
    assert client.get('/api/default-sections').json() == {other_date:'보존 이름'}
    with db.connection() as conn:
        assert [r['cache_key'] for r in conn.execute('SELECT cache_key FROM saved_plans')] == ['unrelated']
    assert client.delete(f'/api/days/{date}').status_code == 204
    assert client.delete('/api/days/not-a-date').status_code == 422


def test_delete_empty_day_removes_sections_and_default_name(client):
    before = client.get('/api/places').json()
    date = '2040-03-01'
    client.post('/api/sections', json={'name':'빈 구간','visit_date':date})
    client.put('/api/default-sections', json={'name':'빈 일정','visit_date':date})
    assert client.delete(f'/api/days/{date}').status_code == 204
    assert client.get('/api/sections').json() == []
    assert client.get('/api/default-sections').json() == {}
    assert client.get('/api/places').json() == before


def test_copy_itinerary_preserves_source_fields_and_isolates_copies(client):
    source, target = '2031-01-01', '2031-01-02'
    section = client.post('/api/sections', json=dict(name='오전', visit_date=source)).json()['id']
    original = client.post('/api/places', json=dict(name='예약 장소', lat=35, lng=139, visit_date=source,
        section_id=section, required_order=1, required_time='13:00', stay_minutes=45,
        description='메모', tasks=[dict(id='task', text='예약', done=True)])).json()
    other = client.post('/api/places', json=dict(name='다른 구간', lat=35, lng=139, visit_date=source)).json()
    response = client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target,
        section_id=section, start_id=original['id'], end_id=original['id']))
    assert response.status_code == 201
    result = response.json()
    assert result['copied'] == 1 and result['section_id'] is None
    assert result['section_name'] == '오전'
    places = {p['id']: p for p in client.get('/api/places').json()}
    copied = places[result['place_id_map'][str(original['id'])]]
    assert copied == {**original, 'id': copied['id'], 'visit_date': target, 'section_id': None}
    assert places[original['id']] == original and places[other['id']] == other
    assert client.get('/api/default-sections').json()[target] == '오전'
    client.patch(f"/api/places/{copied['id']}/tasks/task", json={'done': False})
    assert next(p for p in client.get('/api/places').json() if p['id'] == original['id'])['tasks'][0]['done'] is True


@pytest.mark.parametrize('existing', ['places', 'section', 'default-name'])
def test_copy_to_existing_date_creates_unique_section(client, existing):
    source, target = '2031-02-01', '2031-02-02'
    original = client.post('/api/places', json=dict(name='원본', lat=35, lng=139, visit_date=source)).json()
    if existing == 'places':
        client.post('/api/places', json=dict(name='기존 일정', lat=35, lng=139, visit_date=target))
    elif existing == 'section':
        client.post('/api/sections', json=dict(name='빈 구간', visit_date=target))
    else:
        client.put('/api/default-sections', json=dict(name='기존 기본 구간', visit_date=target))
    before = client.get('/api/places').json()
    first = client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target)).json()
    second = client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target)).json()
    assert first['section_name'] == '복사된 일정' and second['section_name'] == '복사된 일정 2'
    assert first['section_id'] != second['section_id']
    after = {p['id']: p for p in client.get('/api/places').json()}
    assert all(after[p['id']] == p for p in before)
    assert after[first['place_id_map'][str(original['id'])]]['section_id'] == first['section_id']


def test_copy_same_date_and_unscheduled_round_trip_endpoint(client):
    source = '2031-03-01'
    stop = client.post('/api/places', json=dict(name='방문', lat=35, lng=139, visit_date=source)).json()
    endpoint = client.post('/api/places', json=dict(name='숙소', lat=35, lng=139)).json()
    result = client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=source,
        start_id=endpoint['id'], end_id=endpoint['id'])).json()
    assert result['copied'] == 2 and result['section_name'] == '복사된 일정'
    assert len(set(result['place_id_map'].values())) == 2
    places = {p['id']: p for p in client.get('/api/places').json()}
    assert places[stop['id']] == stop and places[endpoint['id']] == endpoint


def test_copy_invalid_source_or_endpoint_does_not_create_destination(client):
    source, target = '2031-04-01', '2031-04-02'
    before_sections = client.get('/api/sections').json()
    assert client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target)).status_code == 404
    client.post('/api/places', json=dict(name='장소', lat=35, lng=139, visit_date=source))
    before_places = client.get('/api/places').json()
    assert client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target, start_id=999999)).status_code == 422
    assert client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target, section_id=999999)).status_code == 422
    assert client.get('/api/places').json() == before_places
    assert client.get('/api/sections').json() == before_sections
    assert target not in client.get('/api/default-sections').json()


def test_copy_limit_failure_rolls_back_all_changes(client):
    from app import db
    source, target = '2031-05-01', '2031-05-02'
    with db.connection() as conn:
        count = conn.execute('SELECT count(*) FROM places').fetchone()[0]
        conn.executemany('INSERT INTO places (name,lat,lng,visit_date) VALUES (?,35,139,?)',
                         [(f'장소 {i}', source) for i in range(100 - count)])
    before = client.get('/api/places').json()
    response = client.post('/api/itineraries/copy', json=dict(source_date=source, target_date=target))
    assert response.status_code == 422
    assert client.get('/api/places').json() == before
    assert target not in client.get('/api/default-sections').json()
    assert not any(s['visit_date'] == target for s in client.get('/api/sections').json())
