import math

def load_ambulances():
    """Load ambulance records from Supabase and normalize their fields."""
    from supabase_client import supabase
    result = (
        supabase
        .table("ambulances")
        .select(
            "id, name, latitude, longitude, location_updated_at, "
            "operational, capabilities, status, ambulance_type, "
            "clinical_capabilities"
        )
        .execute()
    )

    ambulances = []

    for row in result.data or []:
        ambulances.append({
            **row,
            "status": str(row.get("status", "")).lower(),
            "capabilities": row.get("capabilities") or [],
            "ambulance_type": row.get("ambulance_type"),
            "clinical_capabilities": row.get("clinical_capabilities") or [],
        })

    return ambulances


def filter_eligible_ambulances(ambulances, emergency_type):
    eligible = []
    excluded = []

    for ambulance in ambulances:
        reason = None

        if str(ambulance["status"]).upper() != "AVAILABLE":
            reason = "AMBULANCE_NOT_AVAILABLE"

        elif ambulance["operational"] is not True:
            reason = "AMBULANCE_NOT_OPERATIONAL"

        elif emergency_type not in ambulance["capabilities"]:
            reason = "REQUIRED_CAPABILITY_MISSING"

        if reason:
            excluded.append({
                "ambulance": ambulance["name"],
                "id": ambulance["id"],
                "reason": reason,
            })
        else:
            eligible.append(ambulance)

    return eligible, excluded

def rank_eligible_ambulances(eligible_ambulances, route_results):
    ranked = []

    for ambulance in eligible_ambulances:
        route = route_results.get(ambulance["id"])

        if route is None:
            continue

        eta = route.get("eta_seconds")
        distance = route.get("distance_meters")

        if (
            not isinstance(eta, (int, float))
            or isinstance(eta, bool)
            or not math.isfinite(eta)
            or eta < 0
        ):
            continue

        if (
            not isinstance(distance, (int, float))
            or isinstance(distance, bool)
            or not math.isfinite(distance)
            or distance < 0
        ):
            continue

        ranked.append({
            **ambulance,
            "eta_seconds": eta,
            "distance_meters": distance,
        })

    ranked.sort(
        key=lambda ambulance: (
            ambulance["eta_seconds"],
            ambulance["distance_meters"],
            ambulance["id"],
        )
    )

    return ranked