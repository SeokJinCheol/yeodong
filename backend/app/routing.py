"""Fixed endpoint shortest path and proximity based course suggestions."""
import math


def distance(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dlat = lat2 - lat1
    dlng = math.radians(b['lng'] - a['lng'])
    h = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def estimate_matrix(places, mode):
    speed = 4.5 if mode == 'WALK' else 25
    return [[distance(a, b) / 1000 / speed * 3600 for b in places] for a in places]


def optimal_order(costs):
    """Held–Karp: exact minimum time for this matrix, endpoints 0 and n-1.

    The two endpoint entries may refer to the same physical place (round trip).
    """
    n = len(costs)
    if n <= 2:
        return list(range(n))
    count = n - 2
    dp = {(1 << j, j): (costs[0][j+1], [0, j+1]) for j in range(count)}
    for mask in range(1, 1 << count):
        for last in range(count):
            if (mask, last) not in dp:
                continue
            cost, path = dp[mask, last]
            for nxt in range(count):
                if mask & (1 << nxt):
                    continue
                key = (mask | (1 << nxt), nxt)
                candidate = cost + costs[last+1][nxt+1]
                if key not in dp or candidate < dp[key][0]:
                    dp[key] = candidate, path + [nxt+1]
    _, path = min((dp[(1 << count)-1, j][0] + costs[j+1][-1], dp[(1 << count)-1, j][1]) for j in range(count))
    return path + [n-1]


def cluster_places(places, radius=2500):
    # Complete-link radius prevents a chain of close points becoming a huge course.
    clusters = []
    for place in places:
        eligible = [group for group in clusters if len(group) < 8 and all(distance(place, p) <= radius for p in group)]
        if eligible:
            min(eligible, key=lambda g: sum(distance(place, p) for p in g)/len(g)).append(place)
        else:
            clusters.append([place])
    results = []
    for i, group in enumerate(clusters):
        remaining = group[1:]
        route = group[:1]
        while remaining:
            nxt = min(remaining, key=lambda p: distance(route[-1], p))
            route.append(nxt)
            remaining.remove(nxt)
        meters = sum(distance(a,b) for a,b in zip(route, route[1:]))
        area = next((p['area'] for p in route if p['area']), '근처 여행지')
        results.append(dict(id=i, title=f'{area} 산책 코스', places=route,
                            distance_meters=round(meters), travel_minutes=round(meters/75),
                            stay_minutes=sum(p['stay_minutes'] for p in route), source='estimate'))
    return results
