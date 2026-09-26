import copy
import json

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app import db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'database_path', str(tmp_path / 'workspace.db'))
    from app import valhalla
    from app.routing import estimate_matrix, distance
    async def matrix(places, mode):
        return estimate_matrix(places, mode)
    async def route(places, mode):
        return ([{'duration': '60s', 'distanceMeters': round(distance(a,b))} for a,b in zip(places, places[1:])], [[p['lng'],p['lat']] for p in places])
    monkeypatch.setattr(valhalla, 'time_matrix', matrix)
    monkeypatch.setattr(valhalla, 'route_details', route)
    with TestClient(app) as client:
        yield client


def add(client, name='방문', day='2033-01-01', **extra):
    response = client.post('/api/places', json={'name':name, 'lat':35, 'lng':139, 'visit_date':day, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_trip_isolation_and_existing_data_preserved(client):
    original = client.get('/api/places').json()
    trip = client.post('/api/trips', json={'name':'새 여행'}).json()
    headers = {'X-Trip-ID':str(trip['id'])}
    assert client.get('/api/places', headers=headers).json() == []
    assert client.get('/api/sections', headers=headers).json() == []
    created = client.post('/api/places', headers=headers, json={'name':'새 여행 장소','lat':1,'lng':2}).json()
    assert client.get('/api/places', headers=headers).json() == [created]
    assert client.get('/api/places').json() == original
    assert client.delete('/api/places/99999', headers=headers).status_code == 404
    assert client.get('/api/trash').json() == []
    assert client.get('/api/places', headers={'X-Trip-ID':'999999'}).status_code == 404
    assert client.get('/api/places', headers={'X-Trip-ID':'bad'}).status_code == 422
    assert client.put(f"/api/trips/{trip['id']}", json={'name':'봄 여행'}).status_code == 200
    assert client.get('/api/trips').json()[-1]['name'] == '봄 여행'


def test_settings_persist_copy_move_and_validate(client):
    a, b = add(client), add(client, name='도착')
    day = a['visit_date']
    response = client.patch(f'/api/route-settings/{day}', json={'start':a['id'],'end':b['id'],'departureTime':'10:30','timeZone':'Asia/Seoul','mode':'DRIVE'})
    assert response.status_code == 200
    client.patch(f'/api/route-settings/{day}', json={'departureTime':'11:20'})
    value = client.get('/api/route-settings').json()[day]
    assert value['mode'] == 'DRIVE' and value['departureTime'] == '11:20'
    result = client.post('/api/itineraries/copy', json={'source_date':day,'target_date':'2033-01-02'}).json()
    copied = client.get('/api/route-settings').json()['2033-01-02']
    assert copied == {**value, 'start':result['place_id_map'][str(a['id'])], 'end':result['place_id_map'][str(b['id'])]}
    assert client.post('/api/days/move', json={'source_date':'2033-01-02','target_date':'2033-01-03'}).status_code == 200
    saved = client.get('/api/route-settings').json()
    assert saved['2033-01-03'] == copied and '2033-01-02' not in saved
    for key, payload in [(day, {'start':999999}), (day, {'timeZone':'No/SuchZone'}), ('invalid', {}), (day, {'departureTime':'25:00'}), (day+':12345', {})]:
        assert client.patch(f'/api/route-settings/{key}', json=payload).status_code == 422


def test_trash_place_restore_preserves_tasks_and_endpoints(client):
    p = add(client, tasks=[{'id':'one','text':'할 일','done':True}], visit_status='visited')
    day = p['visit_date']
    client.patch(f'/api/route-settings/{day}', json={'start':p['id'],'end':p['id'],'mode':'WALK'})
    before = client.get('/api/route-settings').json()[day]
    assert client.delete(f"/api/places/{p['id']}").status_code == 204
    assert client.get('/api/route-settings').json()[day]['start'] is None
    item = client.get('/api/trash').json()[0]
    assert client.post(f"/api/trash/{item['id']}/restore").status_code == 200
    assert next(x for x in client.get('/api/places').json() if x['id'] == p['id']) == p
    assert client.get('/api/route-settings').json()[day] == before
    assert client.get('/api/trash').json() == []
    assert client.post(f"/api/trash/{item['id']}/restore").status_code == 404


def test_deleted_day_restores_separately_if_replacement_exists(client):
    p = add(client)
    day = p['visit_date']
    client.patch(f'/api/route-settings/{day}', json={'start':p['id'],'end':p['id'],'departureTime':'12:00'})
    client.delete(f'/api/days/{day}')
    item = client.get('/api/trash').json()[0]
    replacement = add(client, name='새 일정')
    response = client.post(f"/api/trash/{item['id']}/restore")
    assert response.status_code == 200, response.text
    places = {p['id']:p for p in client.get('/api/places').json()}
    assert places[replacement['id']] == replacement
    restored = places[p['id']]
    assert restored['section_id'] is not None
    key = f"{day}:{restored['section_id']}"
    assert client.get('/api/route-settings').json()[key]['departureTime'] == '12:00'


def test_backup_roundtrip_and_conflict_import_preserve_existing(client):
    original = client.get('/api/places').json()
    day = original[0]['visit_date']
    client.patch(f'/api/route-settings/{day}', json={'start':original[0]['id'],'end':original[0]['id'],'mode':'DRIVE','timeZone':'Asia/Seoul'})
    backup = client.get('/api/backup').json()
    trip = client.post('/api/trips', json={'name':'복원 여행'}).json()
    headers = {'X-Trip-ID':str(trip['id'])}
    response = client.post('/api/backup/import', headers=headers, json=backup)
    assert response.status_code == 201, response.text
    restored = client.get('/api/backup', headers=headers).json()
    assert restored['places'] == backup['places']
    assert restored['route_settings'] == backup['route_settings']
    before = client.get('/api/places').json()
    response = client.post('/api/backup/import', json=backup)
    assert response.status_code == 201, response.text
    after = {p['id']:p for p in client.get('/api/places').json()}
    assert all(after[p['id']] == p for p in before)
    assert client.get('/api/sections').json()[-1]['name'] == '가져온 일정'
    new_settings = client.get('/api/route-settings').json()
    assert new_settings[day] == backup['route_settings'][day]
    new_key = next(k for k in new_settings if ':' in k)
    assert new_settings[new_key]['start'] == new_settings[new_key]['end']


def test_backup_invalid_input_is_atomic(client):
    backup = client.get('/api/backup').json()
    bad = copy.deepcopy(backup)
    bad['places'][0]['section_id'] = 999999
    assert client.post('/api/backup/import', json=bad).status_code == 422
    bad = copy.deepcopy(backup)
    bad['places'].append(bad['places'][0])
    assert client.post('/api/backup/import', json=bad).status_code == 422
    bad = copy.deepcopy(backup)
    bad['version'] = 9
    assert client.post('/api/backup/import', json=bad).status_code == 422
    assert client.get('/api/backup').json() == backup


def test_order_status_and_remaining_route(client):
    places = [add(client, name=f'場所{i}') for i in range(4)]
    ids = [p['id'] for p in places]
    day = places[0]['visit_date']
    payload = {'visit_date':day,'start_id':ids[0],'end_id':ids[3],'place_ids':[ids[2],ids[1]]}
    assert client.put('/api/itineraries/order', json=payload).status_code == 200
    plan_payload = {'visit_date':day,'start_id':ids[0],'end_id':ids[3]}
    result = client.post('/api/plan', json=plan_payload).json()
    assert [p['id'] for p in result['places']] == [ids[0],ids[2],ids[1],ids[3]]
    client.patch(f'/api/places/{ids[2]}/visit-status', json={'status':'visited'})
    # Marking visited alone must not exclude it from planning.
    assert ids[2] in [p['id'] for p in client.post('/api/plan', json=plan_payload).json()['places']]
    result = client.post('/api/plan', json={**plan_payload,'excluded_ids':[ids[2]]})
    assert result.status_code == 200, result.text
    assert [p['id'] for p in result.json()['places']] == [ids[0],ids[1],ids[3]]
    assert client.put('/api/itineraries/order', json={**payload,'place_ids':[ids[2],ids[2]]}).status_code == 409
    assert client.put('/api/itineraries/order', json={**payload,'automatic':True}).status_code == 200
    assert all(p['required_order'] is None for p in client.get('/api/places').json() if p['id'] in ids)


def test_copy_uses_saved_unscheduled_endpoint(client):
    p = add(client)
    home = add(client, name='숙소', day=None)
    day = p['visit_date']
    client.patch(f'/api/route-settings/{day}', json={'start':home['id'],'end':home['id'],'mode':'WALK'})
    result = client.post('/api/itineraries/copy', json={'source_date':day,'target_date':'2033-06-01'}).json()
    assert result['copied'] == 2
    value = client.get('/api/route-settings').json()['2033-06-01']
    assert value['start'] == value['end'] == result['place_id_map'][str(home['id'])]


def test_editing_section_clears_stale_endpoint_settings(client):
    p = add(client)
    day = p['visit_date']
    client.patch(f'/api/route-settings/{day}', json={'start':p['id'],'end':p['id']})
    section = client.post('/api/sections', json={'name':'오후','visit_date':day}).json()
    assert client.put(f"/api/places/{p['id']}", json={**p,'section_id':section['id']}).status_code == 200
    value = client.get('/api/route-settings').json()[day]
    assert value['start'] is None and value['end'] is None
