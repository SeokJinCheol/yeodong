"""Trip-local settings, recoverable deletion, and portable itinerary backups."""
import json
from datetime import date, datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from . import db
from .models import Place, PlaceInput, SectionInput

router = APIRouter(prefix='/api')


class TripInput(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r'\S')


class RouteSettings(BaseModel):
    model_config = ConfigDict(extra='forbid')
    start: int | None = Field(default=None, ge=1)
    end: int | None = Field(default=None, ge=1)
    departureTime: str = Field(default='09:00', pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    timeZone: str = Field(default='Asia/Tokyo', max_length=80)
    mode: Literal['MAP', 'WALK', 'DRIVE', 'TRANSIT'] = 'MAP'
    orderMode: Literal['auto', 'manual'] = 'auto'

    @model_validator(mode='after')
    def valid_zone(self):
        try:
            ZoneInfo(self.timeZone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError('올바른 시간대를 선택해 주세요.')
        return self


def section_key(day, section=None):
    return str(day) if section is None else f'{day}:{section}'


def parse_key(key):
    parts = key.split(':')
    try:
        if len(parts) > 2:
            raise ValueError()
        day = date.fromisoformat(parts[0]).isoformat()
        section = int(parts[1]) if len(parts) == 2 else None
        if section is not None and section < 1:
            raise ValueError()
        if key != section_key(day, section):
            raise ValueError()
        return day, section
    except (ValueError, TypeError):
        raise HTTPException(422, '설정의 날짜 또는 구간이 올바르지 않습니다.') from None


def default_settings():
    from .auth import active_user
    with db.connection(global_db=True) as conn:
        row = conn.execute('SELECT preferences FROM users WHERE id=?',(active_user.get(),)).fetchone()
    return RouteSettings(**(json.loads(row['preferences']) if row else {})).model_dump()


def read_settings(conn):
    return {r['key']: json.loads(r['value']) for r in conn.execute('SELECT * FROM route_settings')}


def put_settings(conn, key, value):
    conn.execute('INSERT OR REPLACE INTO route_settings VALUES (?,?)', (key, json.dumps(value, ensure_ascii=False)))


def check_settings(conn, key, value):
    day, section = parse_key(key)
    if section is not None and not conn.execute('SELECT 1 FROM sections WHERE id=? AND visit_date=?', (section, day)).fetchone():
        raise HTTPException(422, '선택한 날짜에 속한 구간이 없습니다.')
    for endpoint in (value['start'], value['end']):
        if endpoint is not None and not conn.execute('SELECT 1 FROM places WHERE id=? AND section_id IS ?', (endpoint, section)).fetchone():
            raise HTTPException(422, '출발지 또는 도착지가 해당 구간에 없습니다.')


def repair_settings(conn):
    for key, value in read_settings(conn).items():
        _, section = parse_key(key)
        for field in ('start', 'end'):
            if value.get(field) is not None and not conn.execute('SELECT 1 FROM places WHERE id=? AND section_id IS ?', (value[field], section)).fetchone():
                value[field] = None
        put_settings(conn, key, value)


@router.get('/trips')
def trips():
    from .auth import active_user
    with db.connection(global_db=True) as conn:
        return [dict(r) for r in conn.execute('SELECT id,name FROM trips WHERE owner_id=? ORDER BY id', (active_user.get(),))]


@router.post('/trips', status_code=201)
def create_trip(payload: TripInput):
    from .auth import active_user
    with db.connection(global_db=True) as conn:
        trip_id = conn.execute('INSERT INTO trips (name,owner_id) VALUES (?,?)', (payload.name.strip(),active_user.get())).lastrowid
        db.init_db(trip_id=trip_id, seed=False)
    return {'id': trip_id, 'name': payload.name.strip()}


@router.put('/trips/{trip_id}')
def rename_trip(trip_id: int, payload: TripInput):
    from .auth import active_user
    with db.connection(global_db=True) as conn:
        if not conn.execute('UPDATE trips SET name=? WHERE id=? AND owner_id=?', (payload.name.strip(), trip_id,active_user.get())).rowcount:
            raise HTTPException(404, '여행이 없습니다.')
    return {'id': trip_id, 'name': payload.name.strip()}


@router.get('/route-settings')
def get_route_settings():
    with db.connection() as conn:
        return read_settings(conn)


@router.patch('/route-settings/{key}')
def save_route_settings(key: str, payload: RouteSettings):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        previous = read_settings(conn).get(key, default_settings())
        value = RouteSettings.model_validate({**previous, **payload.model_dump(exclude_unset=True)}).model_dump()
        check_settings(conn, key, value)
        put_settings(conn, key, value)
    return value


class VisitStatus(BaseModel):
    status: Literal['pending', 'visited', 'skipped']


@router.patch('/places/{place_id}/visit-status', response_model=Place)
def set_visit_status(place_id: int, payload: VisitStatus):
    with db.connection() as conn:
        if not conn.execute('UPDATE places SET visit_status=? WHERE id=?', (payload.status, place_id)).rowcount:
            raise HTTPException(404, '장소가 없습니다.')
        row = dict(conn.execute('SELECT * FROM places WHERE id=?', (place_id,)).fetchone())
        row['tasks'] = json.loads(row['tasks'])
        return row


class OrderInput(BaseModel):
    visit_date: date
    section_id: int | None = Field(default=None, ge=1)
    start_id: int
    end_id: int
    place_ids: list[int] = Field(max_length=100)
    automatic: bool = False


@router.put('/itineraries/order')
def reorder(payload: OrderInput):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        key = section_key(payload.visit_date, payload.section_id)
        value = read_settings(conn).get(key, default_settings())
        value.update(start=payload.start_id, end=payload.end_id)
        check_settings(conn, key, value)
        expected = {r['id'] for r in conn.execute('SELECT id FROM places WHERE visit_date=? AND section_id IS ?',
                                                 (str(payload.visit_date), payload.section_id))} - {payload.start_id, payload.end_id}
        if len(payload.place_ids) != len(set(payload.place_ids)) or set(payload.place_ids) != expected:
            raise HTTPException(409, '장소가 변경되었습니다. 새로고침 후 순서를 다시 정해 주세요.')
        for index, place_id in enumerate(payload.place_ids, 1):
            conn.execute('UPDATE places SET required_order=? WHERE id=?', (None if payload.automatic else index, place_id))
        value['orderMode'] = 'auto' if payload.automatic else 'manual'
        put_settings(conn, key, value)
    return {'updated': len(expected)}


def archive(conn, rows, label, day=None):
    ids = {r['id'] for r in rows}
    sections = [dict(r) for r in conn.execute('SELECT * FROM sections')
                if (day and r['visit_date'] == day) or r['id'] in {p['section_id'] for p in rows}]
    settings = {k: v for k, v in read_settings(conn).items()
                if (day and parse_key(k)[0] == day) or v.get('start') in ids or v.get('end') in ids}
    names = {r['key']: r['value'] for r in conn.execute("SELECT * FROM metadata WHERE key LIKE 'default-section:%'")
             if day and r['key'] == f'default-section:{day}'}
    after = {}
    for key, value in settings.items():
        if day and parse_key(key)[0] == day:
            conn.execute('DELETE FROM route_settings WHERE key=?', (key,))
            after[key] = None
        else:
            updated = {**value, 'start': None if value.get('start') in ids else value.get('start'),
                       'end': None if value.get('end') in ids else value.get('end')}
            put_settings(conn, key, updated)
            after[key] = updated
    payload = {'places': [dict(r) for r in rows], 'sections': sections, 'names': names,
               'settings': settings, 'settings_after': after, 'day': day}
    return conn.execute('INSERT INTO trash (label,payload,deleted_at) VALUES (?,?,?)',
                        (label, json.dumps(payload, ensure_ascii=False), datetime.now(timezone.utc).isoformat())).lastrowid


@router.get('/trash')
def trash():
    with db.connection() as conn:
        return [dict(r) for r in conn.execute('SELECT id,label,deleted_at FROM trash ORDER BY id DESC')]


def insert_row(conn, table, row):
    return conn.execute(f"INSERT INTO {table} ({','.join(row)}) VALUES ({','.join('?' for _ in row)})", list(row.values())).lastrowid


@router.post('/trash/{trash_id}/restore')
def restore(trash_id: int):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        item = conn.execute('SELECT * FROM trash WHERE id=?', (trash_id,)).fetchone()
        if not item:
            raise HTTPException(404, '복구할 항목이 없습니다.')
        saved = json.loads(item['payload'])
        if conn.execute('SELECT count(*) FROM places').fetchone()[0] + len(saved['places']) > 100:
            raise HTTPException(422, '복구 후 장소가 100개를 초과합니다. 다른 여행에 백업을 가져오거나 장소를 정리해 주세요.')
        # If a deleted day has since been replaced, restore into separate sections.
        day = saved['day']
        occupied = day and (conn.execute('SELECT 1 FROM places WHERE visit_date=?', (day,)).fetchone()
                           or conn.execute('SELECT 1 FROM sections WHERE visit_date=?', (day,)).fetchone()
                           or conn.execute('SELECT 1 FROM metadata WHERE key=?', (f'default-section:{day}',)).fetchone())
        sections = {}
        if occupied:
            for old in {p['section_id'] for p in saved['places']} | {s['id'] for s in saved['sections']}:
                sections[old] = conn.execute('INSERT INTO sections (name,visit_date) VALUES (?,?)',
                                             (unique_name(conn, day, '복구된 일정'), day)).lastrowid
        else:
            for section in saved['sections']:
                existing = conn.execute('SELECT * FROM sections WHERE id=?', (section['id'],)).fetchone()
                if existing and existing['visit_date'] != section['visit_date']:
                    sections[section['id']] = insert_row(conn, 'sections', {k:v for k,v in section.items() if k != 'id'})
                else:
                    if not existing:
                        insert_row(conn, 'sections', section)
                    sections[section['id']] = section['id']
            for key, value in saved['names'].items():
                conn.execute('INSERT OR IGNORE INTO metadata VALUES (?,?)', (key, value))
        for place in saved['places']:
            if conn.execute('SELECT 1 FROM places WHERE id=?', (place['id'],)).fetchone():
                raise HTTPException(409, '동일한 장소 ID가 이미 있습니다. 복구를 중단했습니다.')
            place['section_id'] = sections.get(place['section_id'], place['section_id'])
            insert_row(conn, 'places', place)
        current = read_settings(conn)
        for key, value in saved['settings'].items():
            setting_day, old_section = parse_key(key)
            target_key = section_key(setting_day, sections.get(old_section, old_section)) if setting_day == day or old_section in sections else key
            if target_key != key or current.get(key) == saved['settings_after'].get(key):
                put_settings(conn, target_key, value)
        repair_settings(conn)
        conn.execute('DELETE FROM trash WHERE id=?', (trash_id,))
        conn.execute('DELETE FROM saved_plans')
    return {'restored': len(saved['places'])}


def unique_name(conn, day, base):
    names = {r['name'] for r in conn.execute('SELECT name FROM sections WHERE visit_date=?', (day,))}
    n, name = 2, base
    while name in names:
        name = f'{base[:32]} {n}'
        n += 1
    return name


class BackupSection(SectionInput):
    id: int = Field(ge=1)


class Backup(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: Literal[1] = 1
    name: str = Field(default='여행 백업', max_length=80)
    places: list[Place] = Field(max_length=100)
    sections: list[BackupSection] = Field(max_length=100)
    default_names: dict[date, str] = Field(default_factory=dict, max_length=100)
    route_settings: dict[str, RouteSettings] = Field(default_factory=dict, max_length=200)

    @model_validator(mode='after')
    def check_references(self):
        places = {p.id: p for p in self.places}
        sections = {s.id: s for s in self.sections}
        if len(places) != len(self.places) or len(sections) != len(self.sections):
            raise ValueError('백업에 중복 ID가 있습니다.')
        for p in self.places:
            if p.section_id is not None and (p.section_id not in sections or sections[p.section_id].visit_date != p.visit_date):
                raise ValueError('장소의 구간 또는 날짜가 일치하지 않습니다.')
            if len({t.id for t in p.tasks}) != len(p.tasks):
                raise ValueError('할 일 ID가 중복됩니다.')
        for name in self.default_names.values():
            if not name.strip() or len(name) > 40:
                raise ValueError('기본 구간 이름이 올바르지 않습니다.')
        for key, value in self.route_settings.items():
            day, section = parse_key(key)
            if section is not None and (section not in sections or str(sections[section].visit_date) != day):
                raise ValueError('설정의 구간이 올바르지 않습니다.')
            for endpoint in (value.start, value.end):
                if endpoint is not None and (endpoint not in places or places[endpoint].section_id != section):
                    raise ValueError('설정의 출발·도착지가 올바르지 않습니다.')
        return self


@router.get('/backup')
def export_backup():
    with db.connection(global_db=True) as conn:
        name = conn.execute('SELECT name FROM trips WHERE id=?', (db.active_trip.get(),)).fetchone()['name']
    with db.connection() as conn:
        conn.execute('BEGIN')
        places = [{**dict(r), 'tasks': json.loads(r['tasks'])} for r in conn.execute('SELECT * FROM places ORDER BY id')]
        return {'version': 1, 'name': name, 'places': places,
                'sections': [dict(r) for r in conn.execute('SELECT * FROM sections')],
                'default_names': {r['key'].removeprefix('default-section:'):r['value'] for r in conn.execute("SELECT * FROM metadata WHERE key LIKE 'default-section:%'")},
                'route_settings': read_settings(conn)}


@router.post('/backup/import', status_code=201)
def import_backup(payload: Backup):
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        if conn.execute('SELECT count(*) FROM places').fetchone()[0] + len(payload.places) > 100:
            raise HTTPException(422, '가져온 후 장소가 100개를 초과합니다. 새 여행을 만들어 가져와 주세요.')
        dates = {str(p.visit_date) for p in payload.places if p.visit_date} | {str(s.visit_date) for s in payload.sections} | {str(d) for d in payload.default_names} | {parse_key(k)[0] for k in payload.route_settings}
        occupied = {r[0] for r in conn.execute('SELECT DISTINCT visit_date FROM places WHERE visit_date IS NOT NULL')} | {r[0] for r in conn.execute('SELECT DISTINCT visit_date FROM sections')} | {r[0].removeprefix('default-section:') for r in conn.execute("SELECT key FROM metadata WHERE key LIKE 'default-section:%'")}
        section_map = {}
        for day in sorted(dates):
            if day in occupied:
                section_map[(day, None)] = conn.execute('INSERT INTO sections (name,visit_date) VALUES (?,?)', (unique_name(conn, day, '가져온 일정'), day)).lastrowid
            else:
                section_map[(day, None)] = None
                name = payload.default_names.get(date.fromisoformat(day), '기본 동선')
                conn.execute('INSERT INTO metadata VALUES (?,?)', (f'default-section:{day}', name))
        for section in payload.sections:
            name = unique_name(conn, str(section.visit_date), section.name)
            section_map[(str(section.visit_date), section.id)] = conn.execute('INSERT INTO sections (name,visit_date) VALUES (?,?)', (name, str(section.visit_date))).lastrowid
        place_map = {}
        for place in payload.places:
            values = place.model_dump(mode='json', exclude={'id'})
            values['section_id'] = section_map.get((str(place.visit_date), place.section_id))
            values['tasks'] = json.dumps(values['tasks'], ensure_ascii=False)
            place_map[place.id] = insert_row(conn, 'places', values)
        endpoint_map = {}
        for key, settings in payload.route_settings.items():
            day, section = parse_key(key)
            value = settings.model_dump()
            # Endpoints belonging to another date need a local copy when importing into a new section.
            target_section = section_map[(day, section)]
            for field in ('start', 'end'):
                old = value[field]
                if old is None:
                    continue
                endpoint_key = (old, day, target_section)
                if endpoint_key in endpoint_map:
                    value[field] = endpoint_map[endpoint_key]
                    continue
                mapped = place_map[old]
                row = dict(conn.execute('SELECT * FROM places WHERE id=?', (mapped,)).fetchone())
                if row['section_id'] != target_section:
                    row.pop('id')
                    row.update(section_id=target_section, visit_date=day)
                    if conn.execute('SELECT count(*) FROM places').fetchone()[0] >= 100:
                        raise HTTPException(422, '출발·도착지 복사 후 장소가 100개를 초과합니다.')
                    mapped = insert_row(conn, 'places', row)
                value[field] = mapped
                endpoint_map[endpoint_key] = mapped
            # Preserve round trips when an endpoint had to be cloned.
            if settings.start is not None and settings.start == settings.end:
                value['end'] = value['start']
            put_settings(conn, section_key(day, target_section), value)
    return {'imported': len(payload.places)}
