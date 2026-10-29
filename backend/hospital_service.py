from supabase_client import supabase

def load_hospitals():
    response = (
        supabase.table("hospitals")
        .select("*")
        .order("id")
        .execute()
    )

    hospitals = response.data

    for hospital in hospitals:
        hospital["accepting_patients"] = hospital["accepting_cases"]
        hospital.pop("estimated_eta_minutes", None)

    return hospitals

def filter_eligible_hospitals(hospitals, emergency_type):
    eligible = []
    excluded = []

    for hospital in hospitals:
        if emergency_type not in hospital["specialties"]:
            excluded.append({
                "hospital": hospital["name"],
                "reason": "SPECIALTY_NOT_SUPPORTED"
            })
        elif hospital["accepting_patients"] is not True:
            excluded.append({
                "hospital": hospital["name"],
                "reason": "NOT_ACCEPTING_PATIENTS"
            })
        else:
            eligible.append(hospital)

    return eligible, excluded


def rank_hospitals(hospitals):
    if not hospitals:
        return []

    eta_values = [
        hospital["estimated_eta_minutes"]
        for hospital in hospitals
    ]

    min_eta = min(eta_values)
    max_eta = max(eta_values)

    known_loads = [
        hospital["current_load"]
        for hospital in hospitals
        if isinstance(hospital.get("current_load"), (int, float))
        and not isinstance(hospital.get("current_load"), bool)
        and 0 <= hospital["current_load"] <= 100
    ]

    min_load = min(known_loads) if known_loads else None
    max_load = max(known_loads) if known_loads else None

    ranked = []

    for hospital in hospitals:
        eta = hospital["estimated_eta_minutes"]

        if max_eta == min_eta:
            eta_score = 100.0
        else:
            eta_score = 100 * (max_eta - eta) / (max_eta - min_eta)

        load = hospital.get("current_load")
        load_is_valid = (
            isinstance(load, (int, float))
            and not isinstance(load, bool)
            and 0 <= load <= 100
        )

        if not load_is_valid:
            # Unknown load must not be treated as zero.
            final_score = None
            load_score = None
        elif min_load == max_load:
            load_score = 100.0
            final_score = 0.7 * eta_score + 0.3 * load_score
        else:
            load_score = 100 * (max_load - load) / (max_load - min_load)
            final_score = 0.7 * eta_score + 0.3 * load_score

        ranked.append({
            **hospital,
            "eta_score": round(eta_score, 2),
            "load_score": (
                round(load_score, 2)
                if load_score is not None else None
            ),
            "final_score": (
                round(final_score, 2)
                if final_score is not None else None
            ),
        })

    # Known scores first; use ETA to break equal-score ties.
    ranked.sort(
        key=lambda hospital: (
            hospital["final_score"] is None,
            -(hospital["final_score"] or 0),
            hospital["estimated_eta_minutes"],
            hospital["id"],
        )
    )

    return ranked