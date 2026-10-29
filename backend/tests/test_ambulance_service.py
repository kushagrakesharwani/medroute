
import pytest

from ambulance_service import (
    filter_eligible_ambulances,
    rank_eligible_ambulances,
)


@pytest.fixture
def ambulances():
    return [
        {
            "id": "A001",
            "name": "Ambulance 1",
            "status": "available",
            "operational": True,
            "capabilities": ["trauma", "general"],
        },
        {
            "id": "A002",
            "name": "Ambulance 2",
            "status": "ASSIGNED",
            "operational": True,
            "capabilities": ["trauma"],
        },
        {
            "id": "A003",
            "name": "Ambulance 3",
            "status": "AVAILABLE",
            "operational": False,
            "capabilities": ["trauma"],
        },
        {
            "id": "A004",
            "name": "Ambulance 4",
            "status": "AVAILABLE",
            "operational": True,
            "capabilities": ["cardiac"],
        },
    ]


def test_filter_eligible_ambulances(ambulances):
    eligible, excluded = filter_eligible_ambulances(
        ambulances, "trauma"
    )

    assert [a["id"] for a in eligible] == ["A001"]
    assert {a["id"] for a in excluded} == {
        "A002", "A003", "A004"
    }


def test_exclusion_reasons(ambulances):
    _, excluded = filter_eligible_ambulances(
        ambulances, "trauma"
    )

    reasons = {a["id"]: a["reason"] for a in excluded}

    assert reasons["A002"] == "AMBULANCE_NOT_AVAILABLE"
    assert reasons["A003"] == "AMBULANCE_NOT_OPERATIONAL"
    assert reasons["A004"] == "REQUIRED_CAPABILITY_MISSING"


def test_rank_ambulances_by_eta_then_distance(ambulances):
    eligible, _ = filter_eligible_ambulances(
        ambulances, "trauma"
    )

    # Include multiple eligible records for ranking.
    eligible.extend([
        {
            "id": "A005",
            "name": "Ambulance 5",
            "status": "available",
            "operational": True,
            "capabilities": ["trauma"],
        },
        {
            "id": "A006",
            "name": "Ambulance 6",
            "status": "available",
            "operational": True,
            "capabilities": ["trauma"],
        },
    ])

    routes = {
        "A001": {"eta_seconds": 240, "distance_meters": 2500},
        "A005": {"eta_seconds": 180, "distance_meters": 3000},
        "A006": {"eta_seconds": 180, "distance_meters": 2000},
    }

    ranked = rank_eligible_ambulances(eligible, routes)

    assert [a["id"] for a in ranked] == [
        "A006", "A005", "A001"
    ]


@pytest.mark.parametrize(
    "route",
    [
        {"eta_seconds": -1, "distance_meters": 100},
        {"eta_seconds": float("nan"), "distance_meters": 100},
        {"eta_seconds": 100, "distance_meters": float("inf")},
        {"eta_seconds": True, "distance_meters": 100},
    ],
)
def test_invalid_route_metrics_are_excluded(ambulances, route):
    eligible, _ = filter_eligible_ambulances(
        ambulances, "trauma"
    )

    ranked = rank_eligible_ambulances(
        eligible, {"A001": route}
    )

    assert ranked == []