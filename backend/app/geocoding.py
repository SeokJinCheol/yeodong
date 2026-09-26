"""User-triggered OSM place search via a configurable Photon instance."""
import asyncio
import math
import time
from collections import OrderedDict

import httpx
from fastapi import HTTPException

from .config import settings

_cache = OrderedDict()
_lock = asyncio.Lock()
_last_request = 0.0


async def search_places(query):
    global _last_request
    query = query.strip()
    if len(query) < 2:
        raise HTTPException(422, '장소 이름을 두 글자 이상 입력해 주세요.')
    if not settings.photon_url:
        raise HTTPException(503, '장소 검색 서버가 설정되지 않았습니다. 지도에서 위치를 선택해 주세요.')
    key = (settings.photon_url, query.casefold())
    async with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic()-cached[0] < 86400:
            _cache.move_to_end(key)
            return cached[1]
        # Explicit searches only, cached and spaced apart for the shared demo.
        await asyncio.sleep(max(0, 1-(time.monotonic()-_last_request)))
        _last_request = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(f"{settings.photon_url.rstrip('/')}/api/",
                    params={'q':query, 'limit':6}, headers={'User-Agent':'YeodongTravelPlanner/0.1 (local personal itinerary app)'})
                response.raise_for_status()
                features = response.json()['features']
            results = []
            for feature in features:
                lng, lat = feature['geometry']['coordinates']
                lat, lng = float(lat), float(lng)
                if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
                    raise ValueError('Invalid coordinates')
                props = feature['properties']
                address = ', '.join(dict.fromkeys(str(props[k]) for k in ('housenumber','street','city','state','country') if props.get(k)))
                results.append(dict(name=props.get('name') or props.get('street') or query,
                                    address=address, lat=lat, lng=lng))
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(502, '장소 검색에 실패했습니다. 잠시 후 다시 시도하거나 지도에서 위치를 선택해 주세요.') from None
        _cache[key] = (time.monotonic(), results)
        _cache.move_to_end(key)
        while len(_cache) > 256:
            _cache.popitem(last=False)
        return results
