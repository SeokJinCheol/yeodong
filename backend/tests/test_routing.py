import itertools

from app.routing import cluster_places, estimate_matrix, optimal_order


def test_exact_solution_matches_bruteforce_asymmetric_matrix():
    costs = [[0,7,3,9,12],[2,0,11,4,7],[9,5,0,8,12],[1,9,3,0,2],[12,7,4,3,0]]
    route = optimal_order(costs)
    total = lambda path: sum(costs[a][b] for a,b in zip(path,path[1:]))
    expected = min(total([0,*p,4]) for p in itertools.permutations([1,2,3]))
    assert total(route) == expected
    assert route[0] == 0 and route[-1] == 4
    assert sorted(route) == list(range(5))


def test_roundtrip_and_modes():
    places = [dict(lat=35.69,lng=139.70),dict(lat=35.71,lng=139.72),dict(lat=35.69,lng=139.70)]
    walk,drive = estimate_matrix(places,'WALK'),estimate_matrix(places,'DRIVE')
    assert optimal_order(walk) == [0,1,2]
    assert walk[0][1] > drive[0][1] > 0
    assert walk[0][2] == 0


def test_clusters_keep_every_place_once_and_separate_distant_points():
    places = [dict(id=i,name=str(i),lat=lat,lng=139.7,area='',stay_minutes=60) for i,lat in enumerate([35.69,35.695,36.0])]
    groups = cluster_places(places)
    assert len(groups) == 2
    assert sorted(p['id'] for g in groups for p in g['places']) == [0,1,2]
