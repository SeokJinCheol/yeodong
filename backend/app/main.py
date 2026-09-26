import math
import hashlib
import time
from datetime import date, datetime, timezone
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db, geocoding, transit, scheduling, valhalla
from .config import settings
from .models import AssignInput, CopyItineraryInput, MoveDayInput, Place, PlaceInput, PlanInput, TaskStatus, SectionInput
from .routing import cluster_places


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    yield


app = FastAPI(title='여동 · 여행 동선 API', version='0.1.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=['*'], allow_headers=['*'])


@app.get('/api/health')
def health():
    return {'status': 'ok', 'routing_provider': 'valhalla', 'valhalla_enabled': bool(settings.valhalla_url)}


@app.get('/api/sections')
def sections():
    with db.connection() as conn:
        return [dict(row) for row in conn.execute('SELECT * FROM sections ORDER BY id')]


@app.get('/api/default-sections')
def default_section_names():
    with db.connection() as conn:
        return {row['key'].removeprefix('default-section:'): row['value']
                for row in conn.execute("SELECT key,value FROM metadata WHERE key LIKE 'default-section:%'")}


@app.put('/api/default-sections')
def rename_default_section(section: SectionInput):
    visit_date = section.visit_date.isoformat()
    name = section.name.strip()
    with db.connection() as conn:
        conn.execute('INSERT OR REPLACE INTO metadata (key,value) VALUES (?,?)',
                     (f'default-section:{visit_date}', name))
    return dict(id=None, name=name, visit_date=visit_date)


@app.post('/api/sections', status_code=201)
def add_section(section: SectionInput):
    with db.connection() as conn:
        cursor = conn.execute('INSERT INTO sections (name,visit_date) VALUES (?,?)',
                              (section.name.strip(), section.visit_date.isoformat()))
        return dict(id=cursor.lastrowid, name=section.name.strip(), visit_date=section.visit_date.isoformat())


@app.put('/api/sections/{section_id}')
def rename_section(section_id: int, section: SectionInput):
    with db.connection() as conn:
        if not conn.execute('UPDATE sections SET name=? WHERE id=? AND visit_date=?',
                            (section.name.strip(), section_id, section.visit_date.isoformat())).rowcount:
            raise HTTPException(404, '구간이 없습니다.')
    return dict(id=section_id, name=section.name.strip(), visit_date=section.visit_date.isoformat())


@app.delete('/api/sections/{section_id}', status_code=204)
def delete_section(section_id: int):
    with db.connection() as conn:
        if not conn.execute('SELECT 1 FROM sections WHERE id=?', (section_id,)).fetchone():
            raise HTTPException(404, '구간이 없습니다.')
        conn.execute('UPDATE places SET section_id=NULL WHERE section_id=?', (section_id,))
        conn.execute('DELETE FROM sections WHERE id=?', (section_id,))


def validate_section(conn, section_id, visit_date):
    if section_id is not None and not conn.execute(
        'SELECT 1 FROM sections WHERE id=? AND visit_date=?',
        (section_id, visit_date.isoformat() if visit_date else None)
    ).fetchone():
        raise HTTPException(422, '선택한 날짜에 속한 구간을 선택해 주세요.')


@app.get('/api/places', response_model=list[Place])
def places():
    return db.all_places()


@app.post('/api/places', response_model=Place, status_code=201)
def add_place(place: PlaceInput):
    values = place.model_dump(mode='json')
    if len({task['id'] for task in values['tasks']}) != len(values['tasks']):
        raise HTTPException(422, '할 일 ID가 중복됩니다.')
    values['tasks'] = json.dumps(values['tasks'], ensure_ascii=False)
    with db.connection() as conn:
        validate_section(conn, place.section_id, place.visit_date)
        if conn.execute('SELECT count(*) FROM places').fetchone()[0] >= 100:
            raise HTTPException(422, '초안에서는 최대 100개 장소를 저장할 수 있습니다.')
        cursor = conn.execute(f"INSERT INTO places ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", list(values.values()))
        return dict(id=cursor.lastrowid, **place.model_dump(mode='json'))


@app.put('/api/places/{place_id}', response_model=Place)
def update_place(place_id: int, place: PlaceInput):
    values = place.model_dump(mode='json')
    if len({task['id'] for task in values['tasks']}) != len(values['tasks']):
        raise HTTPException(422, '할 일 ID가 중복됩니다.')
    values['tasks'] = json.dumps(values['tasks'], ensure_ascii=False)
    with db.connection() as conn:
        validate_section(conn, place.section_id, place.visit_date)
        cursor = conn.execute(f"UPDATE places SET {','.join(f'{key}=?' for key in values)} WHERE id=?", [*values.values(), place_id])
        if not cursor.rowcount:
            raise HTTPException(404, '장소가 없습니다.')
    return dict(id=place_id, **place.model_dump(mode='json'))


@app.delete('/api/places/{place_id}', status_code=204)
def delete_place(place_id: int):
    with db.connection() as conn:
        if not conn.execute('DELETE FROM places WHERE id=?', (place_id,)).rowcount:
            raise HTTPException(404, '장소가 없습니다.')


@app.get('/api/search')
async def search(q: str = Query(min_length=2, max_length=200)):
    return await geocoding.search_places(q)


@app.post('/api/plan')
async def plan(payload: PlanInput):
    all_places = db.all_places()
    with db.connection() as conn:
        validate_section(conn, payload.section_id, payload.visit_date)
    lookup = {p['id']: p for p in all_places if p['section_id'] == payload.section_id}
    if payload.start_id not in lookup or payload.end_id not in lookup:
        raise HTTPException(404, '출발지 또는 도착지를 다시 선택해 주세요.')
    stops = [p for p in lookup.values() if p['visit_date'] == payload.visit_date.isoformat() and p['id'] not in {payload.start_id, payload.end_id}]
    if len(stops) > 8:
        raise HTTPException(422, '구간별 중간 방문지는 최대 8개입니다. 다른 구간이나 날짜로 나눠 주세요.')
    nodes = [lookup[payload.start_id], *stops, lookup[payload.end_id]]
    valhalla.costing(payload.mode)
    departure = transit.departure_for(payload)
    appointments = scheduling.appointments_for(nodes, payload)
    signature = {'version':2, 'provider':'valhalla', 'endpoint':settings.valhalla_url, 'request':payload.model_dump(mode='json', exclude={'force_refresh'}),
                 'nodes':[{k:p.get(k) for k in ('id','lat','lng','visit_date','stay_minutes','required_order','required_time')} for p in nodes]}
    cache_key = hashlib.sha256(json.dumps(signature,sort_keys=True).encode()).hexdigest()
    now = time.time()
    with db.connection() as conn:
        conn.execute('DELETE FROM saved_plans WHERE saved_at < ?', (now-86400,))
        cached = conn.execute('SELECT result FROM saved_plans WHERE cache_key=?', (cache_key,)).fetchone()
    if cached and not payload.force_refresh:
        result = json.loads(cached['result'])
        result['places'] = [lookup[p['id']] for p in result['places']]
        result['cache_hit'] = True
        return result

    matrix = await valhalla.time_matrix(nodes, payload.mode)
    order = scheduling.scheduled_order(nodes, matrix, departure, appointments)
    if any(not math.isfinite(matrix[a][b]) for a,b in zip(order,order[1:])):
        raise HTTPException(422, '모든 장소를 연결할 수 없습니다. 장소와 이동수단을 확인해 주세요.', headers={'X-Route-Unavailable':'true'})
    ordered = [nodes[i] for i in order]
    raw_legs, coordinates = await valhalla.route_details(ordered, payload.mode)
    if len(raw_legs) != len(ordered)-1:
        raise HTTPException(502, 'Valhalla 경로 구간 응답이 불완전합니다.')
    legs = [dict(from_id=a['id'], to_id=b['id'], duration_seconds=round(float(raw['duration'].removesuffix('s'))),
                 distance_meters=raw.get('distanceMeters',0), mode=payload.mode, steps=raw.get('steps',[]),
                 departure_time=raw.get('departure_time'), arrival_time=raw.get('arrival_time'),
                 transfer_count=raw.get('transfer_count',0), warnings=raw.get('warnings',[]))
            for a,b,raw in zip(ordered, ordered[1:],raw_legs)]
    schedule = scheduling.build_schedule(ordered, legs, departure, appointments)
    result = dict(**schedule, places=ordered, legs=legs, coordinates=coordinates, mode=payload.mode,
                total_travel_seconds=sum(l['duration_seconds'] for l in legs),
                total_distance_meters=sum(l['distance_meters'] for l in legs),
                total_stay_minutes=sum(p['stay_minutes'] for p in ordered[1:-1]),
                source='valhalla',
                time_zone=payload.time_zone,
                optimization=('필수 시각을 지키는 순서 우선 · 이동·대기시간 반영' if appointments else '이동시간 행렬 기준 최단 순서 · 출발/도착 고정'))
    result['saved_at'] = datetime.now(timezone.utc).isoformat()
    result['cache_hit'] = False
    with db.connection() as conn:
        conn.execute('INSERT OR REPLACE INTO saved_plans VALUES (?,?,?)', (cache_key,json.dumps(result,ensure_ascii=False),now))
    return result



@app.get('/api/courses')
def courses():
    return cluster_places([p for p in db.all_places() if p['visit_date'] is None])


@app.post('/api/courses/assign')
def assign(payload: AssignInput):
    with db.connection() as conn:
        validate_section(conn, payload.section_id, payload.visit_date)
        ids = set(payload.place_ids)
        found = {row[0] for row in conn.execute('SELECT id FROM places')}
        if not ids <= found:
            raise HTTPException(404, '코스에 삭제된 장소가 있습니다. 새로고침해 주세요.')
        conn.executemany('UPDATE places SET visit_date=?, section_id=? WHERE id=?', [(payload.visit_date.isoformat(), payload.section_id, i) for i in ids])
    return {'updated': len(ids)}


@app.post('/api/days/move')
def move_day(payload: MoveDayInput):
    if payload.source_date == payload.target_date:
        raise HTTPException(422, '변경할 날짜를 다르게 선택해 주세요.')
    with db.connection() as conn:
        if conn.execute('SELECT 1 FROM places WHERE visit_date=?', (payload.target_date.isoformat(),)).fetchone():
            raise HTTPException(409, '이미 일정이 있는 날짜입니다. 빈 날짜를 선택하거나 장소별 날짜를 수정해 주세요.')
        if conn.execute('SELECT 1 FROM sections WHERE visit_date=?', (payload.target_date.isoformat(),)).fetchone():
            raise HTTPException(409, '이미 구간이 있는 날짜입니다. 빈 날짜를 선택해 주세요.')
        if conn.execute('SELECT 1 FROM metadata WHERE key=?', (f'default-section:{payload.target_date.isoformat()}',)).fetchone():
            raise HTTPException(409, '이미 이름을 지정한 구간이 있는 날짜입니다. 빈 날짜를 선택해 주세요.')
        count = conn.execute('UPDATE places SET visit_date=? WHERE visit_date=?',
                             (payload.target_date.isoformat(), payload.source_date.isoformat())).rowcount
        if not count:
            raise HTTPException(404, '옮길 일정이 없습니다.')
        conn.execute('UPDATE sections SET visit_date=? WHERE visit_date=?',
                     (payload.target_date.isoformat(), payload.source_date.isoformat()))
        conn.execute('UPDATE metadata SET key=? WHERE key=?',
                     (f'default-section:{payload.target_date.isoformat()}', f'default-section:{payload.source_date.isoformat()}'))
    return {'updated': count}


@app.post('/api/itineraries/copy', status_code=201)
def copy_itinerary(payload: CopyItineraryInput):
    source, target = payload.source_date.isoformat(), payload.target_date.isoformat()
    with db.connection() as conn:
        # Lock before reading occupancy and limits so concurrent copies cannot collide.
        conn.execute('BEGIN IMMEDIATE')
        validate_section(conn, payload.section_id, payload.source_date)
        rows = list(conn.execute('SELECT * FROM places WHERE visit_date=? AND section_id IS ? ORDER BY id',
                                 (source, payload.section_id)))
        if not rows:
            raise HTTPException(404, '복사할 구간에 장소가 없습니다.')
        ids = {row['id'] for row in rows}
        for endpoint in (payload.start_id, payload.end_id):
            if endpoint is None or endpoint in ids:
                continue
            row = conn.execute('SELECT * FROM places WHERE id=? AND section_id IS ?',
                               (endpoint, payload.section_id)).fetchone()
            if row is None:
                raise HTTPException(422, '복사할 출발지 또는 도착지를 확인해 주세요.')
            rows.append(row)
            ids.add(endpoint)
        if conn.execute('SELECT count(*) FROM places').fetchone()[0] + len(rows) > 100:
            raise HTTPException(422, '복사 후 장소가 100개를 초과합니다. 저장한 장소를 정리해 주세요.')
        occupied = (
            conn.execute('SELECT 1 FROM places WHERE visit_date=?', (target,)).fetchone()
            or conn.execute('SELECT 1 FROM sections WHERE visit_date=?', (target,)).fetchone()
            or conn.execute('SELECT 1 FROM metadata WHERE key=?', (f'default-section:{target}',)).fetchone()
        )
        target_section = None
        if occupied:
            names = {row['name'] for row in conn.execute('SELECT name FROM sections WHERE visit_date=?', (target,))}
            default = conn.execute('SELECT value FROM metadata WHERE key=?', (f'default-section:{target}',)).fetchone()
            if default:
                names.add(default['value'])
            name, suffix = '복사된 일정', 2
            while name in names:
                name = f'복사된 일정 {suffix}'
                suffix += 1
            target_section = conn.execute('INSERT INTO sections (name,visit_date) VALUES (?,?)', (name, target)).lastrowid
        else:
            source_name = (conn.execute('SELECT name FROM sections WHERE id=?', (payload.section_id,)).fetchone()
                           if payload.section_id is not None else
                           conn.execute('SELECT value FROM metadata WHERE key=?', (f'default-section:{source}',)).fetchone())
            name = source_name[0] if source_name else '기본 동선'
            conn.execute('INSERT INTO metadata (key,value) VALUES (?,?)', (f'default-section:{target}', name))
        copied_ids = {}
        for row in sorted(rows, key=lambda row: row['id']):
            values = {key: row[key] for key in row.keys() if key != 'id'}
            values.update(visit_date=target, section_id=target_section)
            cursor = conn.execute(f"INSERT INTO places ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", list(values.values()))
            copied_ids[row['id']] = cursor.lastrowid
        return {'copied': len(rows), 'target_date': target, 'section_id': target_section,
                'section_name': name, 'place_id_map': copied_ids}


@app.delete('/api/days/{visit_date}', status_code=204)
def delete_day(visit_date: date):
    target = visit_date.isoformat()
    with db.connection() as conn:
        deleted_ids = {row['id'] for row in conn.execute('SELECT id FROM places WHERE visit_date=?', (target,))}
        conn.execute('DELETE FROM places WHERE visit_date=?', (target,))
        conn.execute('DELETE FROM sections WHERE visit_date=?', (target,))
        conn.execute('DELETE FROM metadata WHERE key=?', (f'default-section:{target}',))
        # Other days may have used a deleted place as their start or end point.
        cached_keys = []
        for row in conn.execute('SELECT cache_key,result FROM saved_plans'):
            places = json.loads(row['result']).get('places', [])
            if any(p.get('id') in deleted_ids or p.get('visit_date') == target for p in places):
                cached_keys.append((row['cache_key'],))
        conn.executemany('DELETE FROM saved_plans WHERE cache_key=?', cached_keys)


@app.patch('/api/places/{place_id}/tasks/{task_id}', response_model=Place)
def set_task_status(place_id: int, task_id: str, status: TaskStatus):
    with db.connection() as conn:
        row = conn.execute('SELECT * FROM places WHERE id=?', (place_id,)).fetchone()
        if not row:
            raise HTTPException(404, '장소가 없습니다.')
        place = dict(row)
        tasks = json.loads(place['tasks'])
        task = next((t for t in tasks if t['id']==task_id), None)
        if task is None:
            raise HTTPException(404, '할 일이 없습니다. 목록을 새로고침해 주세요.')
        task['done'] = status.done
        conn.execute('UPDATE places SET tasks=? WHERE id=?', (json.dumps(tasks, ensure_ascii=False),place_id))
        return {**place, 'tasks': tasks}
