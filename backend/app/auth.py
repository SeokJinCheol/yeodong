"""Account authentication with revocable opaque sessions and per-account defaults."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from contextvars import ContextVar
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from . import db
from .config import settings
from .workspace import RouteSettings

router = APIRouter(prefix='/api/auth')
active_user = ContextVar('active_user', default=None)
COOKIE = 'yeodong_session'
SESSION_SECONDS = 7 * 86400
hash_slots = threading.BoundedSemaphore(2)


def setup_path():
    return Path(f'{settings.database_path}.setup-token')


def init_auth():
    with db.connection(global_db=True) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
            preferences TEXT NOT NULL DEFAULT '{}')''')
        conn.execute('''CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
            csrf TEXT NOT NULL, expires REAL NOT NULL)''')
        conn.execute('CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires REAL NOT NULL)')
        if 'owner_id' not in {r[1] for r in conn.execute('PRAGMA table_info(trips)')}:
            conn.execute('ALTER TABLE trips ADD COLUMN owner_id INTEGER REFERENCES users(id)')
        if not conn.execute('SELECT 1 FROM users').fetchone() and not setup_path().exists():
            try:
                fd = os.open(setup_path(), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError:
                return
            with os.fdopen(fd, 'w') as file:
                file.write(secrets.token_urlsafe(32))


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    with hash_slots:
        value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256*1024*1024).hex()
    return f'scrypt${salt}${value}'


def verify_password(password, stored):
    return hmac.compare_digest(hash_password(password, stored.split('$')[1]), stored)


def rate_limit(request, username, action):
    # No forwarded IP headers are trusted here. A proxy shares the IP budget.
    host = request.client.host if request.client else 'unknown'
    buckets = [(f'{action}:ip:{host}', 30), (f'{action}:name:{username}', 10)]
    with db.connection(global_db=True) as conn:
        conn.execute('BEGIN IMMEDIATE')
        now = time.time()
        conn.execute('DELETE FROM auth_attempts WHERE expires <= ?', (now,))
        keys = [(digest(key), limit) for key, limit in buckets]
        for key, limit in keys:
            row = conn.execute('SELECT count FROM auth_attempts WHERE key=?', (key,)).fetchone()
            if row and row['count'] >= limit:
                raise HTTPException(429, '시도가 너무 많습니다. 15분 후 다시 시도해 주세요.', headers={'Retry-After':'900'})
        for key, _ in keys:
            conn.execute('INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now+900))


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r'^[a-zA-Z0-9_.-]+$')
    password: str = Field(min_length=12, max_length=128)


class Registration(Credentials):
    display_name: str = Field(min_length=1, max_length=60, pattern=r'\S')
    setup_token: str = Field(default='', max_length=200)


class Preferences(BaseModel):
    model_config = ConfigDict(extra='forbid')
    departureTime: str = Field(default='09:00', pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    timeZone: str = 'Asia/Tokyo'
    mode: str = 'MAP'

    def validated(self):
        try:
            return RouteSettings(**self.model_dump()).model_dump(include={'departureTime','timeZone','mode'})
        except ValueError:
            raise HTTPException(422, '시간대 또는 이동수단이 올바르지 않습니다.') from None


def account_view(conn, user):
    trips = [dict(r) for r in conn.execute('SELECT id,name FROM trips WHERE owner_id=? ORDER BY id', (user['id'],))]
    return {'id':user['id'], 'username':user['username'], 'display_name':user['display_name'],
            'preferences':{**Preferences().model_dump(), **json.loads(user['preferences'])}, 'trips':trips}


def new_session(conn, user, request, response):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    conn.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
    old = request.cookies.get(COOKIE)
    if old:
        conn.execute('DELETE FROM sessions WHERE token_hash=?', (digest(old),))
    conn.execute('INSERT INTO sessions VALUES (?,?,?,?)', (digest(token), user['id'], csrf, time.time()+SESSION_SECONDS))
    response.set_cookie(COOKIE, token, httponly=True, secure=settings.session_cookie_secure or request.url.scheme=='https',
                        samesite='lax', max_age=SESSION_SECONDS, path='/')
    return {'user':account_view(conn,user), 'csrf':csrf}


def authenticate(request):
    token = request.cookies.get(COOKIE, '')
    if not token:
        return None
    with db.connection(global_db=True) as conn:
        row = conn.execute('''SELECT users.*,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id
                              WHERE token_hash=? AND expires>?''', (digest(token),time.time())).fetchone()
        return dict(row) if row else None


@router.get('/status')
def status():
    with db.connection(global_db=True) as conn:
        return {'setup_required':not bool(conn.execute('SELECT 1 FROM users').fetchone())}


@router.post('/register', status_code=201)
def register(payload: Registration, request: Request, response: Response):
    username = payload.username.lower()
    rate_limit(request, username, 'register')
    with db.connection(global_db=True) as conn:
        first = not conn.execute('SELECT 1 FROM users').fetchone()
    if first and (not setup_path().exists() or not hmac.compare_digest(payload.setup_token.encode(), setup_path().read_text().strip().encode())):
        raise HTTPException(403, '서버의 초기 설정 코드를 확인해 주세요.')
    password_hash = hash_password(payload.password)
    with db.connection(global_db=True) as conn:
        conn.execute('BEGIN IMMEDIATE')
        first = not conn.execute('SELECT 1 FROM users').fetchone()
        if first and (not setup_path().exists() or not hmac.compare_digest(payload.setup_token.encode(), setup_path().read_text().strip().encode())):
            raise HTTPException(403, '서버의 초기 설정 코드를 확인해 주세요.')
        try:
            user_id = conn.execute('INSERT INTO users (username,display_name,password_hash) VALUES (?,?,?)',
                                    (username,payload.display_name.strip(),password_hash)).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409, '사용할 수 없는 아이디입니다.') from None
        if first:
            conn.execute('UPDATE trips SET owner_id=? WHERE owner_id IS NULL', (user_id,))
        else:
            trip_id = conn.execute('INSERT INTO trips (name,owner_id) VALUES (?,?)', ('나의 여행',user_id)).lastrowid
            db.init_db(trip_id=trip_id, seed=False)
        user = conn.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
        result = new_session(conn,user,request,response)
    return result


@router.post('/login')
def login(payload: Credentials, request: Request, response: Response):
    username = payload.username.lower()
    rate_limit(request,username,'login')
    with db.connection(global_db=True) as conn:
        user = conn.execute('SELECT * FROM users WHERE username=?',(username,)).fetchone()
    # Perform the same expensive derivation for nonexistent accounts.
    stored = user['password_hash'] if user else 'scrypt$' + '0'*32 + '$' + '0'*128
    valid = verify_password(payload.password, stored)
    if not user or not valid:
        raise HTTPException(401, '아이디 또는 비밀번호가 올바르지 않습니다.')
    with db.connection(global_db=True) as conn:
        return new_session(conn,user,request,response)


@router.get('/me')
def me(request: Request):
    with db.connection(global_db=True) as conn:
        return {'user':account_view(conn,request.state.user), 'csrf':request.state.user['csrf']}


@router.post('/logout', status_code=204)
def logout(request: Request, response: Response):
    with db.connection(global_db=True) as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash=?',(digest(request.cookies.get(COOKIE,'')),))
    response.delete_cookie(COOKIE, path='/', secure=settings.session_cookie_secure or request.url.scheme=='https', httponly=True, samesite='lax')


@router.patch('/preferences')
def preferences(payload: Preferences, request: Request):
    value = payload.validated()
    with db.connection(global_db=True) as conn:
        conn.execute('UPDATE users SET preferences=? WHERE id=?',(json.dumps(value),request.state.user['id']))
    return value
