from datetime import date
import pytest
from fastapi import HTTPException
from app import transit
from app.models import PlanInput


def test_departure_timezone_and_invalid_zone():
    payload = PlanInput(visit_date=date(2040,1,1), start_id=1, end_id=2, departure_time='09:00', time_zone='Asia/Tokyo')
    assert transit.departure_for(payload).hour == 0
    payload.time_zone = 'invalid-zone'
    with pytest.raises(HTTPException):
        transit.departure_for(payload)
