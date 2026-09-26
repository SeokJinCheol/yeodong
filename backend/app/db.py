import sqlite3
import json
from contextlib import contextmanager
from contextvars import ContextVar

from .config import settings


active_trip = ContextVar('active_trip', default=1)


@contextmanager
def connection(global_db=False, trip_id=None):
    selected = 1 if global_db else (active_trip.get() if trip_id is None else trip_id)
    path = settings.database_path if selected == 1 else f'{settings.database_path}.trip-{selected}.db'
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db(trip_id=1, seed=True):
    with connection(trip_id=trip_id) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
            address TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '',
            visit_date TEXT, stay_minutes INTEGER NOT NULL DEFAULT 60,
            google_place_id TEXT
        )""")
        if 'required_time' not in {row[1] for row in db.execute('PRAGMA table_info(places)')}:
            db.execute('ALTER TABLE places ADD COLUMN required_time TEXT')
        if 'required_order' not in {row[1] for row in db.execute('PRAGMA table_info(places)')}:
            db.execute('ALTER TABLE places ADD COLUMN required_order INTEGER')
        columns = {row[1] for row in db.execute('PRAGMA table_info(places)')}
        if 'description' not in columns:
            db.execute("ALTER TABLE places ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        if 'tasks' not in columns:
            db.execute("ALTER TABLE places ADD COLUMN tasks TEXT NOT NULL DEFAULT '[]'")
        db.execute("CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, visit_date TEXT NOT NULL)")
        if 'section_id' not in columns:
            db.execute("ALTER TABLE places ADD COLUMN section_id INTEGER REFERENCES sections(id)")
        if 'visit_status' not in columns:
            db.execute("ALTER TABLE places ADD COLUMN visit_status TEXT NOT NULL DEFAULT 'pending'")
        db.execute("CREATE TABLE IF NOT EXISTS route_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS trash (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, payload TEXT NOT NULL, deleted_at TEXT NOT NULL)")
        if trip_id == 1:
            db.execute("CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
            db.execute("INSERT OR IGNORE INTO trips (id,name) VALUES (1,'기존 여행')")
        if not seed:
            db.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT)")
            db.execute("INSERT OR IGNORE INTO metadata VALUES ('seeded','1')")
        db.execute("CREATE TABLE IF NOT EXISTS saved_plans (cache_key TEXT PRIMARY KEY, result TEXT NOT NULL, saved_at REAL NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT)")
        if not db.execute("SELECT 1 FROM metadata WHERE key='seeded'").fetchone():
            # Illustrative seed coordinates, clearly identified as sample data in the UI.
            from datetime import date
            today = date.today().isoformat()
            rows = [
                ("신주쿠역",35.6909,139.7003,"도쿄 신주쿠 · 샘플", "신주쿠",today,0),
                ("신주쿠 교엔",35.6852,139.7100,"도쿄 신주쿠 · 샘플", "신주쿠",today,90),
                ("하나조노 신사",35.6933,139.7049,"도쿄 신주쿠 · 샘플", "신주쿠",today,30),
                ("신주쿠 그랑벨 호텔",35.6963,139.7065,"도쿄 신주쿠 · 샘플", "신주쿠",today,30),
                ("신주쿠 워싱턴 호텔",35.6870,139.6937,"도쿄 신주쿠 · 샘플", "신주쿠",today,0),
                ("긴자 식스",35.6696,139.7640,"도쿄 긴자 · 샘플", "긴자",None,90),
                ("쓰키지 장외시장",35.6655,139.7707,"도쿄 쓰키지 · 샘플", "긴자",None,90),
                ("가부키자",35.6695,139.7678,"도쿄 긴자 · 샘플", "긴자",None,45),
                ("시부야 스크램블 교차로",35.6595,139.7005,"도쿄 시부야 · 샘플", "시부야",None,30),
                ("미야시타 파크",35.6628,139.7011,"도쿄 시부야 · 샘플", "시부야",None,60),
            ]
            db.executemany("INSERT INTO places (name,lat,lng,address,area,visit_date,stay_minutes) VALUES (?,?,?,?,?,?,?)", rows)
            db.execute("INSERT INTO metadata VALUES ('seeded','1')")


def all_places():
    with connection() as db:
        return [{**dict(row), "tasks": json.loads(row["tasks"])} for row in db.execute("SELECT * FROM places ORDER BY id")]
