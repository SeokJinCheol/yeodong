"""Time appointments: arrive by a fixed time, wait, then spend the stay duration."""
import math
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from .routing import optimal_order


def appointments_for(nodes, payload):
    return {p['id']: datetime.combine(payload.visit_date, time.fromisoformat(p['required_time']), ZoneInfo(payload.time_zone))
            for p in nodes if p.get('required_time') and p.get('visit_date') == payload.visit_date.isoformat()}


def scheduled_order(nodes, costs, departure, appointments):
    ranks = {i:p['required_order'] for i,p in enumerate(nodes) if 0<i<len(nodes)-1 and p.get('required_order') is not None}
    if len(set(ranks.values())) != len(ranks):
        raise HTTPException(422, '필수 방문 순서가 중복됩니다. 중간 방문지마다 다른 숫자를 지정해 주세요.')
    if any(rank > len(nodes)-2 for rank in ranks.values()):
        raise HTTPException(422, f'이 일정의 중간 방문지는 {len(nodes)-2}개입니다. 필수 순서는 1~{len(nodes)-2} 안에서 지정해 주세요.')
    reserved = {rank:i for i,rank in ranks.items()}
    if not appointments and not ranks:
        return optimal_order(costs)
    targets = {i:(appointments[p['id']]-departure).total_seconds() for i,p in enumerate(nodes) if p['id'] in appointments}
    best = None
    def visit(path, remaining, elapsed, travel):
        nonlocal best
        if not remaining:
            end=len(nodes)-1
            arrival=elapsed+costs[path[-1]][end]
            if not math.isfinite(arrival) or arrival > targets.get(end,float('inf')):
                return
            finish=max(arrival,targets.get(end,arrival))
            candidate=(finish,travel+costs[path[-1]][end],path+[end])
            if best is None or candidate[:2]<best[:2]:
                best=candidate
            return
        for nxt in remaining:
            step = len(path)
            if (nxt in ranks and ranks[nxt] != step) or (step in reserved and reserved[step] != nxt):
                continue
            arrival=elapsed+costs[path[-1]][nxt]
            if not math.isfinite(arrival) or arrival > targets.get(nxt,float('inf')):
                continue
            ready=max(arrival,targets.get(nxt,arrival))+nodes[nxt]['stay_minutes']*60
            visit(path+[nxt],remaining-{nxt},ready,travel+costs[path[-1]][nxt])
    if targets.get(0,0)>=0:
        visit([0],set(range(1,len(nodes)-1)),max(0,targets.get(0,0)),0)
    # Return a visible route with explicit conflicts when no feasible order exists.
    if best:
        return best[2]
    if appointments:
        return scheduled_order(nodes, costs, departure, {})
    raise HTTPException(422, '지정한 필수 방문 순서로 연결할 수 있는 경로가 없습니다.', headers={'X-Route-Unavailable':'true'})


def build_schedule(ordered, legs, departure, appointments):
    cursor=departure
    schedule=[]
    conflicts=[]
    for i,p in enumerate(ordered):
        if i:
            cursor += timedelta(seconds=legs[i-1]['duration_seconds'])
        arrival=cursor
        required=appointments.get(p['id'])
        late=max(0,(arrival-required).total_seconds()) if required else 0
        wait=max(0,(required-arrival).total_seconds()) if required else 0
        start=arrival+timedelta(seconds=wait)
        stay=p['stay_minutes'] if 0<i<len(ordered)-1 else 0
        cursor=start+timedelta(minutes=stay)
        if late:
            conflicts.append(f"{p['name']}: 필수 {p['required_time']}보다 {math.ceil(late/60)}분 늦게 도착합니다.")
        if required and i:
            deadline = required-timedelta(seconds=legs[i-1]['duration_seconds'])
            schedule[-1]['leave_by'] = deadline.isoformat()
            schedule[-1]['leave_by_destination'] = p['name']
            schedule[-1]['leave_by_required_time'] = p['required_time']
        schedule.append(dict(place_id=p['id'],arrival_time=arrival.isoformat(),visit_start=start.isoformat(),
                             departure_time=cursor.isoformat(),wait_seconds=round(wait),late_seconds=round(late),
                             required_time=p.get('required_time') if required else None))
    return dict(schedule=schedule, schedule_feasible=not conflicts, schedule_conflicts=conflicts,
                total_wait_seconds=sum(s['wait_seconds'] for s in schedule),
                total_elapsed_seconds=round((cursor-departure).total_seconds()))
