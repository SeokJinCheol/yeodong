import time

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app import auth, db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings,'database_path',str(tmp_path/'accounts.db'))
    monkeypatch.setattr(settings,'session_cookie_secure',False)
    with TestClient(app) as client:
        client.headers['X-Requested-With'] = 'yeodong'
        yield client


def signup(client, username='alice', first=False):
    response = client.post('/api/auth/register',json={'username':username,'password':'correct horse battery','display_name':username,
                           'setup_token':auth.setup_path().read_text() if first else ''})
    assert response.status_code == 201, response.text
    session = response.json()
    client.headers['X-CSRF-Token'] = session['csrf']
    return session


def test_bootstrap_requires_secret_and_preserves_legacy_trips(client):
    assert client.get('/api/auth/status').json() == {'setup_required':True}
    for endpoint in ['/api/places','/api/trips','/api/backup','/api/trash','/api/route-settings']:
        assert client.get(endpoint).status_code == 401
    assert client.post('/api/auth/register',json={'username':'alice','password':'correct horse battery','display_name':'Alice'}).status_code == 403
    assert client.post('/api/auth/register',json={'username':'alice','password':'correct horse battery','display_name':'Alice','setup_token':'잘못된 코드'}).status_code == 403
    legacy = db.all_places()
    with db.connection(global_db=True) as conn:
        conn.execute("INSERT INTO trips(name) VALUES ('이전 여행')")
    session = signup(client,first=True)
    assert len(session['user']['trips']) == 2
    assert client.get('/api/places').json() == legacy
    assert client.get('/api/auth/status').json()['setup_required'] is False
    with db.connection(global_db=True) as conn:
        row = conn.execute('SELECT * FROM users').fetchone()
        assert row['password_hash'].startswith('scrypt$') and 'correct horse' not in row['password_hash']
        assert conn.execute('SELECT token_hash FROM sessions').fetchone()[0] != client.cookies.get(auth.COOKIE)


def test_two_accounts_cannot_read_or_mutate_each_others_trips(client):
    alice = signup(client,first=True)
    place = client.get('/api/places').json()[0]
    assert client.delete(f"/api/places/{place['id']}").status_code == 204
    trash = client.get('/api/trash').json()[0]
    other = TestClient(app)
    other.headers['X-Requested-With']='yeodong'
    bob = signup(other,'bob')
    assert bob['user']['trips'][0]['id'] != 1
    assert other.get('/api/places').json() == []
    assert other.get('/api/trash').json() == []
    for method,path,payload in [('get','/api/places',None),('get','/api/backup',None),('get','/api/route-settings',None),('get','/api/trash',None),
                                ('post',f"/api/trash/{trash['id']}/restore",{}),('delete',f"/api/places/{place['id']}",None),
                                ('patch','/api/route-settings/2033-01-01',{'mode':'DRIVE'}),('post','/api/backup/import',{})]:
        args={'headers':{'X-Trip-ID':'1'}}
        if payload is not None: args['json']=payload
        assert getattr(other,method)(path,**args).status_code == 404
    assert other.put('/api/trips/1',json={'name':'hijacked'}).status_code == 404
    assert other.get('/api/trips').json() == bob['user']['trips']
    assert client.get('/api/trips').json() == alice['user']['trips']
    assert other.get('/api/places',headers={'X-Account-ID':str(alice['user']['id'])}).status_code == 401
    other.close()


def test_csrf_origin_session_rotation_expiry_and_logout(client):
    signup(client,first=True)
    cookie = client.cookies.get(auth.COOKIE)
    assert client.post('/api/trips',json={'name':'fail'},headers={'X-CSRF-Token':''}).status_code == 403
    assert client.post('/api/trips',json={'name':'fail'},headers={'Origin':'https://evil.example'}).status_code == 403
    assert client.post('/api/trips',json={'name':'allowed'},headers={'Origin':'http://localhost:5173'}).status_code == 201
    assert client.post('/api/auth/login',json={'username':'alice','password':'correct horse battery'},headers={'X-Requested-With':''}).status_code == 403
    logged = client.post('/api/auth/login',json={'username':'ALICE','password':'correct horse battery'})
    assert logged.status_code == 200
    assert 'HttpOnly' in logged.headers['set-cookie'] and 'SameSite=lax' in logged.headers['set-cookie']
    assert client.cookies.get(auth.COOKIE) != cookie
    assert client.get('/api/auth/me',headers={'Cookie':f'{auth.COOKIE}={cookie}'}).status_code == 401
    client.headers['X-CSRF-Token']=logged.json()['csrf']
    active = client.cookies.get(auth.COOKIE)
    assert client.post('/api/auth/logout').status_code == 204
    assert client.get('/api/places',headers={'Cookie':f'{auth.COOKIE}={active}'}).status_code == 401
    login = client.post('/api/auth/login',json={'username':'alice','password':'correct horse battery'})
    assert login.status_code == 200
    with db.connection(global_db=True) as conn:
        conn.execute('UPDATE sessions SET expires=?',(time.time()-1,))
    assert client.get('/api/places').status_code == 401


def test_personal_defaults_are_isolated_and_saved_route_wins(client):
    signup(client,first=True)
    prefs = {'departureTime':'11:30','timeZone':'Asia/Seoul','mode':'DRIVE'}
    assert client.patch('/api/auth/preferences',json=prefs).json() == prefs
    assert client.get('/api/auth/me').json()['user']['preferences'] == prefs
    saved = client.patch('/api/route-settings/2033-01-01',json={'departureTime':'08:00'}).json()
    assert saved['mode']=='DRIVE' and saved['timeZone']=='Asia/Seoul'
    client.patch('/api/auth/preferences',json={**prefs,'mode':'WALK'})
    assert client.get('/api/route-settings').json()['2033-01-01'] == saved
    assert client.patch('/api/auth/preferences',json={**prefs,'timeZone':'No/SuchZone'}).status_code == 422
    assert client.patch('/api/auth/preferences',json={**prefs,'mode':'INVALID'}).status_code == 422
    other=TestClient(app)
    other.headers['X-Requested-With']='yeodong'
    bob=signup(other,'bob')
    assert bob['user']['preferences']['mode']=='MAP'
    assert other.get('/api/route-settings').json()=={}
    other.close()


def test_login_rate_limit_and_password_errors(client):
    signup(client,first=True)
    for _ in range(10):
        assert client.post('/api/auth/login',json={'username':'alice','password':'wrong-password-123'}).status_code == 401
    assert client.post('/api/auth/login',json={'username':'alice','password':'correct horse battery'}).status_code == 429
    assert client.post('/api/auth/register',json={'username':'bob','password':'short','display_name':'Bob'}).status_code == 422
    duplicate=client.post('/api/auth/register',json={'username':'ALICE','password':'correct horse battery','display_name':'duplicate'})
    assert duplicate.status_code == 409


def test_secure_cookie_in_https_configuration(client, monkeypatch):
    monkeypatch.setattr(settings,'session_cookie_secure',True)
    response=client.post('/api/auth/register',json={'username':'alice','password':'correct horse battery','display_name':'Alice','setup_token':auth.setup_path().read_text()})
    assert response.status_code==201
    assert '; Secure' in response.headers['set-cookie']
