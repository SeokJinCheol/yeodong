from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException



def departure_for(payload):
    try:
        zone = ZoneInfo(payload.time_zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, '올바른 여행지 시간대를 선택해 주세요.') from None
    departure = datetime.combine(payload.visit_date, payload.departure_time.replace(tzinfo=None), zone).astimezone(timezone.utc)
    return departure
