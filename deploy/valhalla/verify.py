"""Run with backend/.venv/bin/python deploy/valhalla/verify.py from repo root."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from app import valhalla

TOKYO = {'lat': 35.681236, 'lng': 139.767125}
SHINJUKU = {'lat': 35.690921, 'lng': 139.700258}
FUJI = {'lat': 35.4976962, 'lng': 138.7671672}


async def main():
    for mode, places in [('WALK', [TOKYO, SHINJUKU, TOKYO]), ('DRIVE', [TOKYO, FUJI, TOKYO])]:
        matrix = await valhalla.time_matrix(places, mode)
        legs, coordinates = await valhalla.route_details(places, mode)
        assert len(matrix) == 3 and all(len(row) == 3 for row in matrix)
        assert 0 < matrix[0][1] < float('inf')
        assert len(legs) == 2 and len(coordinates) > 2
        assert all(float(leg['duration'][:-1]) > 0 and leg['distanceMeters'] > 0 for leg in legs)
        print(f'{mode}: matrix OK, round-trip route OK, {sum(leg["distanceMeters"] for leg in legs)/1000:.1f} km')


asyncio.run(main())
