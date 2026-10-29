
from router import RoadRouter


def test_router_loads_graph():
    router = RoadRouter()
    assert len(router.graph.nodes) > 0
    assert len(router.graph.edges) > 0


def test_same_node_has_zero_distance():
    router = RoadRouter()
    node = next(iter(router.graph.nodes))

    path = router.shortest_path(node, node)

    assert path == [node]
    assert router.path_distance_meters(path) == 0.0


def test_path_coordinates_match_path():
    router = RoadRouter()
    node = next(iter(router.graph.nodes))

    coordinates = router.path_coordinates([node])

    assert len(coordinates) == 1
    assert len(coordinates[0]) == 2


def test_dijkstra_finds_route_between_connected_nodes():
    router = RoadRouter()

    # Find a node that has at least one outgoing road edge.
    source = next(
        node for node in router.graph.nodes
        if router.graph.out_degree(node) > 0
    )

    # Use one of its actual outgoing neighbors as the destination.
    target = next(iter(router.graph.successors(source)))

    path = router.shortest_path(source, target)

    assert path[0] == source
    assert path[-1] == target
    assert len(path) >= 2
    assert router.path_distance_meters(path) > 0


def test_primary_road_travel_time():
    router = RoadRouter()

    edge = {
        "length": 1000,
        "highway": "primary",
    }

    travel_time = router.edge_travel_time_seconds(edge)

    # At 50 km/h, 1 km takes 72 seconds.
    assert abs(travel_time - 72.0) < 0.001

def test_time_weighted_route_returns_valid_path():
    router = RoadRouter()

    source = next(
        node for node in router.graph.nodes
        if router.graph.out_degree(node) > 0
    )
    target = next(iter(router.graph.successors(source)))

    path = router.shortest_path(source, target, weight="time")

    assert path[0] == source
    assert path[-1] == target
    assert router.path_travel_time_seconds(path) > 0


def test_invalid_routing_weight_is_rejected():
    router = RoadRouter()
    nodes = list(router.graph.nodes)

    try:
        router.shortest_path(nodes[0], nodes[1], weight="invalid")
        assert False, "Expected ValueError for invalid weight"
    except ValueError as exc:
        assert "weight" in str(exc)
