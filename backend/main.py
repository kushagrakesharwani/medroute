
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ambulance_service import (
    filter_eligible_ambulances,
    load_ambulances,
    rank_eligible_ambulances,
)
from hospital_service import (
    filter_eligible_hospitals,
    load_hospitals,
    rank_hospitals,
)
from routing_service import RouteService
from supabase_client import supabase

route_service = RouteService()

app = FastAPI(title="MedRoute API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmergencyCaseRequest(BaseModel):
    patient_name: str = Field(min_length=1, max_length=100)
    contact_number: str = Field(min_length=1, max_length=30)
    emergency_type: Literal[
        "trauma", "cardiac", "stroke", "respiratory", "general"
    ]
    pickup_location_id: str
    pickup_latitude: float = Field(ge=-90, le=90)
    pickup_longitude: float = Field(ge=-180, le=180)
    landmark: str = Field(default="", max_length=300)
    hospital_id: str


class MissionStatusUpdate(BaseModel):
    ambulance_id: str
    status: Literal[
        "TO_PICKUP",
        "AT_PICKUP",
        "TO_HOSPITAL",
        "COMPLETED",
    ]


def find_best_ambulance(
    pickup_latitude,
    pickup_longitude,
    emergency_type,
):
    """Find the best eligible ambulance for a pickup location."""
    ambulances = load_ambulances()

    eligible, excluded = filter_eligible_ambulances(
        ambulances,
        emergency_type,
    )

    route_results = {}
    route_details = {}
    routing_exclusions = []

    for ambulance in eligible:
        ambulance_id = ambulance["id"]

        route = route_service.calculate_route(
            ambulance["latitude"],
            ambulance["longitude"],
            pickup_latitude,
            pickup_longitude,
        )

        if route is None:
            routing_exclusions.append({
                "id": ambulance_id,
                "ambulance": ambulance["name"],
                "reason": "NO_ROUTE_TO_PICKUP",
            })
            continue

        route_results[ambulance_id] = {
            "eta_seconds": route["eta_seconds"],
            "distance_meters": route["distance_meters"],
        }
        route_details[ambulance_id] = route

    ranked = rank_eligible_ambulances(
        eligible,
        route_results,
    )

    # Only consider ambulances with successfully calculated routes.
    ranked = [
        ambulance
        for ambulance in ranked
        if ambulance["id"] in route_details
    ]

    selected = ranked[0] if ranked else None

    return {
        "selected_ambulance": selected,
        "selected_route": (
            route_details[selected["id"]] if selected else None
        ),
        "ranked_ambulances": ranked,
        "excluded_ambulances": excluded + routing_exclusions,
        "route_details": route_details,
    }


@app.get("/")
def home():
    return {"message": "MedRoute API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/hospitals/map")
def hospitals_for_map():
    return {
        "hospitals": load_hospitals(),
        "simulated_data": True,
    }


@app.get("/hospitals/recommend")
def recommend_hospitals(
    emergency_type: str = Query(
        ...,
        description="Required emergency type",
    ),
    pickup_latitude: float = Query(..., ge=-90, le=90),
    pickup_longitude: float = Query(..., ge=-180, le=180),
):
    emergency_type = emergency_type.lower()
    hospitals = load_hospitals()

    eligible, excluded = filter_eligible_hospitals(
        hospitals,
        emergency_type,
    )

    ranked = []
    routing_exclusions = []

    for hospital in eligible:
        route = route_service.calculate_route(
            pickup_latitude,
            pickup_longitude,
            hospital["latitude"],
            hospital["longitude"],
        )

        if route is None:
            routing_exclusions.append({
                "hospital": hospital["name"],
                "reason": "NO_ROUTE_AVAILABLE",
            })
            continue

        hospital_with_eta = {
            **hospital,
            "estimated_eta_minutes": route["eta_seconds"] / 60,
            "estimated_distance_meters": route["distance_meters"],
        }
        ranked.append(hospital_with_eta)

    ranked = rank_hospitals(ranked)

    return {
        "emergency_type": emergency_type,
        "pickup_location": {
            "latitude": pickup_latitude,
            "longitude": pickup_longitude,
        },
        "recommendations": ranked,
        "excluded_hospitals": excluded,
        "routing_exclusions": routing_exclusions,
        "simulated_data": True,
    }


@app.post("/cases")
def create_emergency_case(request: EmergencyCaseRequest):
    # 1. Validate the citizen's selected hospital.
    hospitals = load_hospitals()

    eligible_hospitals, _ = filter_eligible_hospitals(
        hospitals,
        request.emergency_type,
    )

    selected_hospital = next(
        (
            hospital
            for hospital in eligible_hospitals
            if hospital["id"] == request.hospital_id
        ),
        None,
    )

    if selected_hospital is None:
        raise HTTPException(
            status_code=400,
            detail="Selected hospital is not eligible for this emergency.",
        )

    # 2. Calculate the route from pickup to the selected hospital.
    route = route_service.calculate_route(
        request.pickup_latitude,
        request.pickup_longitude,
        selected_hospital["latitude"],
        selected_hospital["longitude"],
    )

    if route is None:
        raise HTTPException(
            status_code=400,
            detail="No route is available to the selected hospital.",
        )

    # 3. Save the emergency case first.
    case_data = {
        "patient_name": request.patient_name.strip(),
        "contact_number": request.contact_number.strip(),
        "pickup_location_id": request.pickup_location_id,
        "landmark": request.landmark.strip(),
        "emergency_type": request.emergency_type,
        "priority": "HIGH",
        "pickup_latitude": request.pickup_latitude,
        "pickup_longitude": request.pickup_longitude,
        "mission_status": "PENDING",
        "hospital_id": selected_hospital["id"],
        "hospital_readiness": "AWAITING_ACKNOWLEDGMENT",
        "estimated_distance_meters": route["distance_meters"],
        "estimated_eta_seconds": route["eta_seconds"],
        "capacity_reserved": False,
    }

    try:
        result = (
            supabase.table("cases")
            .insert(case_data)
            .execute()
        )
    except Exception as exc:
        print("SUPABASE CASE INSERT ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not save the emergency request.",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=500,
            detail="The database did not return the saved case.",
        )

    saved_case = result.data[0]
    case_id = saved_case["id"]

    # 4. Find eligible ambulances and calculate routes to pickup.
    
    try:
        assignment = find_best_ambulance(
            request.pickup_latitude,
            request.pickup_longitude,
            request.emergency_type,
        )
    except Exception as exc:
        print("AMBULANCE SELECTION ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Emergency saved, but ambulance selection failed.",
        ) from exc

    selected_ambulance = None
    selected_route_to_pickup = None
    assignment_reason = "NO_ELIGIBLE_AMBULANCE"

    # 5. Reserve the best available ambulance.
    # The conditional update avoids reserving an ambulance that is
    # no longer AVAILABLE.
    for candidate in assignment["ranked_ambulances"]:
        ambulance_id = candidate["id"]

        try:
            reservation = (
                supabase.table("ambulances")
                .update({"status": "ASSIGNED"})
                .eq("id", ambulance_id)
                .eq("status", "AVAILABLE")
                .select("id, name, status")
                .execute()
            )
        except Exception as exc:
            print("AMBULANCE RESERVATION ERROR:", repr(exc))
            assignment_reason = "AMBULANCE_RESERVATION_ERROR"
            break

        if not reservation.data:
            continue

        # 6. Link the reserved ambulance to the saved case.
        try:
            case_update = (
                supabase.table("cases")
                .update({
                    "ambulance_id": ambulance_id,
                    "mission_status": "ASSIGNED",
                })
                .eq("id", case_id)
                .is_("ambulance_id", "null")
                .select("*")
                .execute()
            )
        except Exception as exc:
            print("CASE ASSIGNMENT UPDATE ERROR:", repr(exc))
            case_update = None

        if not case_update or not case_update.data:
            # Best-effort release if linking the ambulance failed.
            try:
                supabase.table("ambulances").update(
                    {"status": "AVAILABLE"}
                ).eq(
                    "id", ambulance_id
                ).eq(
                    "status", "ASSIGNED"
                ).execute()
            except Exception as exc:
                print("AMBULANCE RELEASE ERROR:", repr(exc))

            assignment_reason = "CASE_ASSIGNMENT_UPDATE_FAILED"
            break

        saved_case = case_update.data[0]
        selected_ambulance = {
            **candidate,
            "status": "ASSIGNED",
        }

        # Reuse the route calculated during ambulance selection.
        selected_route_to_pickup = assignment["route_details"].get(
            ambulance_id
        )

        assignment_reason = None
        break

    # 7. Return the saved case and actual assignment outcome.
    return {
        "message": (
            "Emergency saved and ambulance assigned."
            if selected_ambulance
            else "Emergency saved, but no ambulance was assigned."
        ),
        "case": saved_case,
        "selected_hospital": selected_hospital["name"],
        "selected_ambulance": selected_ambulance,
        "selected_route_to_pickup": selected_route_to_pickup,
        "assignment_status": (
            "ASSIGNED" if selected_ambulance else "UNASSIGNED"
        ),
        "assignment_reason": assignment_reason,
        "excluded_ambulances": assignment["excluded_ambulances"],
        "simulated_data": True,
    }


@app.get("/cases/active")
def get_active_cases():
    """Return active emergency cases for the Driver Portal."""
    try:
        result = (
            supabase.table("cases")
            .select("*")
            .not_.is_("ambulance_id", "null")
            .in_(
                "mission_status",
                [
                    "PENDING",
                    "ASSIGNED",
                    "TO_PICKUP",
                    "AT_PICKUP",
                    "TO_HOSPITAL",
                ],
            )
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        print("ACTIVE CASES LOOKUP ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve active emergency cases.",
        ) from exc

    return {
        "cases": result.data or [],
        "count": len(result.data or []),
        "simulated_data": True,
    }

@app.patch("/cases/{case_id}/acknowledge")
def acknowledge_case(case_id: str):
    """Acknowledge an incoming emergency case by hospital."""
    try:
        # First, check whether the case exists.
        existing = (
            supabase.table("cases")
            .select("*")
            .eq("id", case_id)
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Emergency case not found.",
            )

        case = existing.data[0]

        # Handle repeat acknowledgments clearly.
        if case.get("hospital_readiness") == "ACKNOWLEDGED":
            return {
                "message": "Emergency case was already acknowledged.",
                "case": case,
            }

        if case.get("hospital_readiness") != "AWAITING_ACKNOWLEDGMENT":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Case cannot be acknowledged in its current state: "
                    f"{case.get('hospital_readiness')}"
                ),
            )

        # Update only if the case is still awaiting acknowledgment.
        result = (
            supabase.table("cases")
            .update({"hospital_readiness": "ACKNOWLEDGED"})
            .eq("id", case_id)
            .eq("hospital_readiness", "AWAITING_ACKNOWLEDGMENT")
            .select("*")
            .execute()
        )

        if result.data:
            return {
                "message": "Emergency case acknowledged successfully.",
                "case": result.data[0],
            }

        # Another request may have acknowledged it at the same time.
        latest = (
            supabase.table("cases")
            .select("*")
            .eq("id", case_id)
            .execute()
        )

        if latest.data and latest.data[0].get("hospital_readiness") == "ACKNOWLEDGED":
            return {
                "message": "Emergency case was already acknowledged.",
                "case": latest.data[0],
            }

        raise HTTPException(
            status_code=409,
            detail="Case state changed. Please refresh and try again.",
        )

    except HTTPException:
        raise
    except Exception as exc:
        print(f"ACKNOWLEDGE CASE ERROR: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Could not acknowledge emergency case.",
        )


@app.get("/cases/{case_id}/route")
def get_mission_route(case_id: str):
    """Calculate routes for the ambulance assigned to a saved mission."""

    # 1. Fetch the saved mission.
    try:
        case_result = (
            supabase.table("cases")
            .select("*")
            .eq("id", case_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        print("MISSION ROUTE CASE LOOKUP ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve the mission.",
        ) from exc

    if not case_result.data:
        raise HTTPException(
            status_code=404,
            detail="Mission not found.",
        )

    case = case_result.data[0]

    if not case.get("ambulance_id"):
        raise HTTPException(
            status_code=409,
            detail="No ambulance is assigned to this mission.",
        )

    # 2. Find the ambulance actually assigned to this mission.
    ambulances = load_ambulances()
    ambulance = next(
        (
            item for item in ambulances
            if item["id"] == case["ambulance_id"]
        ),
        None,
    )

    if ambulance is None:
        raise HTTPException(
            status_code=404,
            detail="The assigned ambulance could not be found.",
        )

    # 3. Find the mission's destination hospital.
    hospitals = load_hospitals()
    hospital = next(
        (
            item for item in hospitals
            if item["id"] == case.get("hospital_id")
        ),
        None,
    )

    if hospital is None:
        raise HTTPException(
            status_code=404,
            detail="The destination hospital could not be found.",
        )

    # 4. Calculate the route to the pickup location.
    route_to_pickup = route_service.calculate_route(
        ambulance["latitude"],
        ambulance["longitude"],
        case["pickup_latitude"],
        case["pickup_longitude"],
    )

    # 5. Calculate the route from pickup to the hospital.
    route_to_hospital = route_service.calculate_route(
        case["pickup_latitude"],
        case["pickup_longitude"],
        hospital["latitude"],
        hospital["longitude"],
    )

    if route_to_pickup is None or route_to_hospital is None:
        raise HTTPException(
            status_code=404,
            detail="A route could not be calculated for this mission.",
        )

    return {
        "case_id": case["id"],
        "emergency_type": case["emergency_type"],
        "mission_status": case["mission_status"],
        "pickup": {
            "landmark": case.get("landmark") or "",
            "latitude": case["pickup_latitude"],
            "longitude": case["pickup_longitude"],
        },
        "ambulance": {
            "id": ambulance["id"],
            "name": ambulance["name"],
            "latitude": ambulance["latitude"],
            "longitude": ambulance["longitude"],
        },
        "hospital": {
            "id": hospital["id"],
            "name": hospital["name"],
            "latitude": hospital["latitude"],
            "longitude": hospital["longitude"],
        },
        "route_to_pickup": route_to_pickup,
        "route_to_hospital": route_to_hospital,
        "simulated_data": True,
    }


@app.get("/cases/{case_id}")
def get_emergency_case(case_id: str):
    """Return a saved emergency case and its hospital information."""
    try:
        result = (
            supabase.table("cases")
            .select("*")
            .eq("id", case_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        print("SUPABASE CASE LOOKUP ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve the emergency case.",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="No emergency case was found with this ID.",
        )

    case = result.data[0]
    hospital = None

    if case.get("hospital_id"):
        try:
            hospital_result = (
                supabase.table("hospitals")
                .select(
                    "id, name, latitude, longitude, current_load"
                )
                .eq("id", case["hospital_id"])
                .limit(1)
                .execute()
            )

            if hospital_result.data:
                hospital = hospital_result.data[0]

        except Exception as exc:
            print("SUPABASE HOSPITAL LOOKUP ERROR:", repr(exc))
            raise HTTPException(
                status_code=500,
                detail="Could not retrieve hospital information.",
            ) from exc

    return {
        "case": case,
        "hospital": hospital,
        "simulated_data": True,
    }


@app.get("/ambulances/assign")
def assign_ambulance(
    emergency_type: str = Query(...),
    pickup_latitude: float = Query(..., ge=-90, le=90),
    pickup_longitude: float = Query(..., ge=-180, le=180),
):
    emergency_type = emergency_type.lower()

    # 1. Load and filter hospitals.
    hospitals = load_hospitals()
    eligible_hospitals, excluded_hospitals = (
        filter_eligible_hospitals(hospitals, emergency_type)
    )

    # 2. Calculate real route-based ETA for each eligible hospital.
    ranked_candidates = []
    routing_exclusions = []

    for hospital in eligible_hospitals:
        route = route_service.calculate_route(
            pickup_latitude,
            pickup_longitude,
            hospital["latitude"],
            hospital["longitude"],
        )

        if route is None:
            routing_exclusions.append({
                "hospital": hospital["name"],
                "reason": "NO_ROUTE_AVAILABLE",
            })
            continue

        ranked_candidates.append({
            **hospital,
            "estimated_eta_minutes": route["eta_seconds"] / 60,
            "estimated_distance_meters": route["distance_meters"],
        })

    ranked_hospitals = rank_hospitals(ranked_candidates)

    if not ranked_hospitals:
        return {
            "emergency_type": emergency_type,
            "selected_hospital": None,
            "selected_ambulance": None,
            "ranked_ambulances": [],
            "excluded_ambulances": [],
            "excluded_hospitals": excluded_hospitals,
            "routing_exclusions": routing_exclusions,
            "message": "No eligible hospital with a valid route was found.",
            "simulated_data": True,
        }

    selected_hospital = ranked_hospitals[0]

    # 3. Load eligible ambulances.
    ambulances = load_ambulances()
    eligible_ambulances, excluded_ambulances = (
        filter_eligible_ambulances(ambulances, emergency_type)
    )

    # 4. Calculate ambulance routes to the pickup location.
    route_results = {}
    route_details = {}
    ambulance_routing_exclusions = []

    for ambulance in eligible_ambulances:
        ambulance_id = ambulance["id"]

        route = route_service.calculate_route(
            ambulance["latitude"],
            ambulance["longitude"],
            pickup_latitude,
            pickup_longitude,
        )

        if route is None:
            ambulance_routing_exclusions.append({
                "id": ambulance_id,
                "name": ambulance["name"],
                "reason": "NO_ROUTE_TO_PICKUP",
            })
            continue

        route_results[ambulance_id] = {
            "eta_seconds": route["eta_seconds"],
            "distance_meters": route["distance_meters"],
        }
        route_details[ambulance_id] = route

    ranked_ambulances = rank_eligible_ambulances(
        eligible_ambulances,
        route_results,
    )
    ranked_ambulances = [
        ambulance for ambulance in ranked_ambulances
        if ambulance["id"] in route_details
    ]

    selected_ambulance = (
        ranked_ambulances[0] if ranked_ambulances else None
    )

    return {
        "emergency_type": emergency_type,
        "pickup_location": {
            "latitude": pickup_latitude,
            "longitude": pickup_longitude,
        },
        "ranked_hospitals": ranked_hospitals,
        "selected_hospital": selected_hospital,
        "selected_ambulance": selected_ambulance,
        "selected_route": (
            route_details[selected_ambulance["id"]]
            if selected_ambulance else None
        ),
        "ranked_ambulances": ranked_ambulances,
        "excluded_ambulances": (
            excluded_ambulances + ambulance_routing_exclusions
        ),
        "excluded_hospitals": excluded_hospitals,
        "routing_exclusions": routing_exclusions,
        "simulated_data": True,
    }

@app.get("/ambulances")
def get_ambulances():
    """Return the current ambulance fleet."""
    try:
        ambulances = load_ambulances()

        return {
            "ambulances": ambulances,
            "count": len(ambulances),
            "simulated_data": True,
        }

    except Exception as exc:
        print("LOAD AMBULANCES ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not load ambulance records.",
        ) from exc


@app.patch("/cases/{case_id}/status")
def update_mission_status(
    case_id: str,
    request: MissionStatusUpdate,
):
    try:
        result = (
            supabase.table("cases")
            .select("*")
            .eq("id", case_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="Emergency case not found",
            )

        case = result.data[0]

        if case.get("ambulance_id") != request.ambulance_id:
            raise HTTPException(
                status_code=403,
                detail="This ambulance is not assigned to this case",
            )

        current_status = case.get("mission_status")

        allowed_next_status = {
            "ASSIGNED": "TO_PICKUP",
            "TO_PICKUP": "AT_PICKUP",
            "AT_PICKUP": "TO_HOSPITAL",
            "TO_HOSPITAL": "COMPLETED",
        }

        expected_status = allowed_next_status.get(current_status)

        if request.status != expected_status:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot change status from {current_status} "
                    f"to {request.status}"
                ),
            )

        updated = (
            supabase.table("cases")
            .update({"mission_status": request.status})
            .eq("id", case_id)
            .eq("ambulance_id", request.ambulance_id)
            .eq("mission_status", current_status)
            .select("*")
            .execute()
        )

        if not updated.data:
            raise HTTPException(
                status_code=409,
                detail="Case status changed; refresh and try again",
            )

        # Release the ambulance when the mission is completed.
        if request.status == "COMPLETED":
            supabase.table("ambulances").update(
                {"status": "AVAILABLE"}
            ).eq(
                "id", request.ambulance_id
            ).eq(
                "status", "ASSIGNED"
            ).execute()

        return {
            "message": "Mission status updated successfully",
            "case": updated.data[0],
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"MISSION STATUS UPDATE ERROR: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update mission status",
        ) from exc