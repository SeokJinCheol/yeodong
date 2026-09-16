from datetime import datetime, timedelta, timezone

from app.scheduling import build_schedule, scheduled_order


def test_appointment_changes_visit_order_and_counts_wait():
    departure=datetime(2026,9,15,9,tzinfo=timezone.utc)
    nodes=[dict(id=i,name=str(i),stay_minutes=30 if i==1 else 0,required_time='09:10' if i==2 else None) for i in range(4)]
    costs=[[0,60,300,60],[60,0,60,60],[300,60,0,60],[60,60,60,0]]
    appointments={2:departure+timedelta(minutes=10)}
    order=scheduled_order(nodes,costs,departure,appointments)
    assert order==[0,2,1,3]
    result=build_schedule([nodes[i] for i in order],[{'duration_seconds':costs[a][b]} for a,b in zip(order,order[1:])],departure,appointments)
    assert result['schedule_feasible']
    assert result['total_wait_seconds']==300
    assert result['total_elapsed_seconds']==42*60


def test_conflicts_are_visible_when_no_feasible_order():
    departure=datetime(2026,9,15,9,tzinfo=timezone.utc)
    nodes=[dict(id=i,name=str(i),stay_minutes=0,required_time='08:00' if i else None) for i in range(2)]
    result=build_schedule(nodes,[{'duration_seconds':600}],departure,{1:departure-timedelta(hours=1)})
    assert not result['schedule_feasible']
    assert result['schedule'][1]['late_seconds']==4200
    assert '70분' in result['schedule_conflicts'][0]


def test_start_and_end_wait_are_counted_but_endpoint_stay_is_not():
    departure=datetime(2026,9,15,9,tzinfo=timezone.utc)
    nodes=[dict(id=i,name=str(i),stay_minutes=60,required_time='10:00') for i in range(2)]
    result=build_schedule(nodes,[{'duration_seconds':600}],departure,{0:departure+timedelta(minutes=10),1:departure+timedelta(hours=1)})
    assert result['total_wait_seconds']==3000
    assert result['total_elapsed_seconds']==3600


def test_leave_by_handles_previous_day_and_conflict():
    from datetime import datetime, timezone
    departure = datetime(2026,9,15,0,0,tzinfo=timezone.utc)
    nodes = [dict(id=1,name='이전',stay_minutes=0),dict(id=2,name='예약',stay_minutes=0,required_time='00:10')]
    result = build_schedule(nodes,[{'duration_seconds':1200}],departure,{2:departure.replace(minute=10)})
    assert result['schedule'][0]['leave_by'] == '2026-09-14T23:50:00+00:00'
    assert result['schedule'][0]['leave_by_destination'] == '예약'
    assert not result['schedule_feasible']


def test_required_order_survives_impossible_time_constraint():
    departure = datetime(2026,9,15,9,tzinfo=timezone.utc)
    nodes = [dict(id=i,name=str(i),stay_minutes=0) for i in range(4)]
    nodes[1]['required_order'] = 2
    nodes[2]['required_order'] = 1
    costs = [[0,1,10,10],[10,0,1,1],[10,1,0,1],[10,10,10,0]]
    assert scheduled_order(nodes,costs,departure,{}) == [0,2,1,3]
    assert scheduled_order(nodes,costs,departure,{1:departure}) == [0,2,1,3]


def test_duplicate_required_order_rejected():
    import pytest
    from fastapi import HTTPException
    nodes = [dict(id=i,name=str(i),stay_minutes=0,required_order=1) for i in range(4)]
    with pytest.raises(HTTPException) as error:
        scheduled_order(nodes,[[0]*4 for _ in nodes],datetime.now(timezone.utc),{})
    assert error.value.status_code == 422
