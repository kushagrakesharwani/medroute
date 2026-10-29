
from routing_service import RouteService


def test_route_service_calculates_route():
    service = RouteService()

    # Use two nearby coordinates in the downloaded road network.
    result = service.calculate_route(
        26.2183, 78.1828,
        26.2250, 78.1900,
    )

    assert result is not None
    assert len(result["path"]) >= 1
    assert len(result["coordinates"]) >= len(result["path"])
    assert all(
    len(point) == 2
    and isinstance(point[0], float)
    and isinstance(point[1], float)
    for point in result["coordinates"]
    )
    assert result["distance_meters"] >= 0
    assert result["eta_seconds"] >= 0
