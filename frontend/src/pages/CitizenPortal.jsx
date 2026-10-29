import API_BASE_URL from "../api.js";
import "./CitizenPortal.css";
import { useEffect, useState } from "react";

const pickupLocations = [
  {
    id: "LOC001",
    name: "MITS College, Gwalior",
    latitude: 26.2183,
    longitude: 78.1828,
  },
  {
    id: "LOC002",
    name: "Gwalior Railway Station",
    latitude: 26.2155,
    longitude: 78.1799,
  },
  {
    id: "LOC003",
    name: "Gwalior Bus Stand",
    latitude: 26.2245,
    longitude: 78.1762,
  },
];

const emergencyTypes = [
  { value: "trauma", label: "Trauma / Road Accident" },
  { value: "cardiac", label: "Cardiac Emergency" },
  { value: "stroke", label: "Stroke" },
  { value: "respiratory", label: "Respiratory Emergency" },
  { value: "general", label: "General Emergency" },
];

function CitizenPortal({ onCaseCreated }) {
  const [patientName, setPatientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emergencyType, setEmergencyType] = useState("");
  const [pickupLocationId, setPickupLocationId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [preferredHospitalId, setPreferredHospitalId] = useState("");

  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [savedCase, setSavedCase] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const pickupLocation = pickupLocations.find(
    (location) => location.id === pickupLocationId
  );

  const canRecommend = Boolean(emergencyType && pickupLocation);

  useEffect(() => {
    if (!emergencyType || !pickupLocationId) {
      return;
    }

    const location = pickupLocations.find(
      (item) => item.id === pickupLocationId
    );

    if (!location) {
      return;
    }

    const controller = new AbortController();

    async function fetchRecommendations() {
      setLoadingRecommendations(true);
      setRecommendationError("");
      setRecommendations([]);
      setPreferredHospitalId("");

      try {
        const params = new URLSearchParams({
          emergency_type: emergencyType,
          pickup_latitude: String(location.latitude),
          pickup_longitude: String(location.longitude),
        });

        const response = await fetch(
          `${API_BASE_URL}/hospitals/recommend?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        const results = data.recommendations ?? [];

        setRecommendations(results);
        setPreferredHospitalId(results[0]?.id ?? "");

        if (results.length === 0) {
          setRecommendationError(
            "No eligible hospitals with a valid route were found for this selection."
          );
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setRecommendations([]);
          setPreferredHospitalId("");
          setRecommendationError(
            "Could not load hospital recommendations. Check that the backend is running, then change your selection to retry."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRecommendations(false);
        }
      }
    }

    fetchRecommendations();

    return () => controller.abort();
  }, [emergencyType, pickupLocationId]);

  const recommendedHospital = recommendations[0];

  const selectedHospital = recommendations.find(
    (hospital) => hospital.id === preferredHospitalId
  );

  
async function handleSubmit(event) {
  event.preventDefault();

  if (
    !patientName.trim() ||
    !contactNumber.trim() ||
    !canRecommend ||
    !pickupLocation ||
    !selectedHospital ||
    loadingRecommendations ||
    submitting
  ) {
    return;
  }

  setSubmitting(true);
  setSavedCase(null);

  try {
    const response = await fetch(`${API_BASE_URL}/cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patient_name: patientName.trim(),
        contact_number: contactNumber.trim(),
        emergency_type: emergencyType,
        pickup_location_id: pickupLocationId,
        pickup_latitude: pickupLocation.latitude,
        pickup_longitude: pickupLocation.longitude,
        landmark: landmark.trim(),
        hospital_id: selectedHospital.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Unable to save the emergency request."
      );
    }

    setSavedCase(data);
    onCaseCreated?.(data.case.id);
    
  } catch (error) {
    alert(error.message || "Could not connect to the MedRoute backend.");
  } finally {
    setSubmitting(false);
  }
}

  return (
    <section className="citizen-portal">
      <h2>Citizen Emergency Booking</h2>
      <p>Report a simulated emergency and review suitable hospitals.</p>

{savedCase && (
  <section className="case-confirmation" role="status">
    <h3>Emergency Request Saved</h3>
    <p>Your simulated emergency request was saved successfully.</p>

    <p>
      <strong>Case ID:</strong> {savedCase.case.id}
    </p>

    <p>
      <strong>Selected Hospital:</strong>{" "}
      {savedCase.selected_hospital}
    </p>

    <p>
      <strong>Case Status:</strong>{" "}
      {savedCase.case.mission_status}
    </p>

    <p>
      <strong>Ambulance Assignment:</strong>{" "}
      {savedCase.assignment_status ?? "UNKNOWN"}
    </p>

    {savedCase.selected_ambulance ? (
      <>
        <p>
          <strong>Assigned Ambulance:</strong>{" "}
          {savedCase.selected_ambulance.name} (
          {savedCase.selected_ambulance.id})
        </p>

        <p>
          <strong>Ambulance Status:</strong>{" "}
          {savedCase.selected_ambulance.status}
        </p>

        {savedCase.selected_route_to_pickup && (
          <>
            <p>
              <strong>Estimated Arrival at Pickup:</strong>{" "}
              {(
                savedCase.selected_route_to_pickup.eta_seconds / 60
              ).toFixed(1)}{" "}
              minutes
            </p>

            <p>
              <strong>Distance to Pickup:</strong>{" "}
              {(
                savedCase.selected_route_to_pickup.distance_meters / 1000
              ).toFixed(2)}{" "}
              km
            </p>
          </>
        )}
      </>
    ) : (
      <p>
        No ambulance was assigned to this case.{" "}
        {savedCase.assignment_reason
          ? `Reason: ${savedCase.assignment_reason}`
          : "Please check the dispatcher view."}
      </p>
    )}

    <p>
      <strong>Estimated Hospital Travel Time:</strong>{" "}
      {savedCase.case.estimated_eta_seconds != null
        ? `${(savedCase.case.estimated_eta_seconds / 60).toFixed(1)} minutes`
        : "Unavailable"}
    </p>

    <p>
      <strong>Hospital Route Distance:</strong>{" "}
      {savedCase.case.estimated_distance_meters != null
        ? `${(savedCase.case.estimated_distance_meters / 1000).toFixed(2)} km`
        : "Unavailable"}
    </p>

    <small>
      Demonstration results use simulated ambulance locations and road-network
      estimates. They are not live emergency-service information.
    </small>
  </section>
)}
      <div className="simulation-notice">
        College demonstration only. Do not use for real emergencies.
        Enter fictional patient details and mock contact information only.
      </div>

      <form onSubmit={handleSubmit}>
        
        <div>
          <label htmlFor="patientName">Patient Name *</label>
          <input
            id="patientName"
            type="text"
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            placeholder="Enter patient's name"
            autoComplete="off"
            required
          />
        </div>
        
        <div>
          <label htmlFor="contactNumber">Contact Number *</label>
          <input
            id="contactNumber"
            type="tel"
            inputMode="numeric"
            value={contactNumber}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
              setContactNumber(digits);
            }}
            placeholder="99999 XXXXX"
            pattern="[6-9][0-9]{9}"
            title="Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9"
            maxLength={10}
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="emergencyType">Emergency Category *</label>
          <select
            id="emergencyType"
            value={emergencyType}
            onChange={(event) => {
              setEmergencyType(event.target.value);
              setPreferredHospitalId("");
              setLoadingRecommendations(false);
            }}
            required
          >
            <option value="">Select emergency category</option>
            {emergencyTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pickupLocation">Simulated Pickup Location *</label>
          <select
            id="pickupLocation"
            value={pickupLocationId}
            onChange={(event) => {
              setPickupLocationId(event.target.value);
              setPreferredHospitalId("");
              setLoadingRecommendations(false);
            }}
            required
          >
            <option value="">Choose a pickup location</option>
            {pickupLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <small>
            Select a predefined demonstration location.
            {pickupLocation && (
              <>
                {" "}Coordinates: {pickupLocation.latitude},{" "}
                {pickupLocation.longitude}
              </>
            )}
          </small>
        </div>

        <div>
          <label htmlFor="landmark">Specific Landmark / Room Details</label>
          <textarea
            id="landmark"
            value={landmark}
            onChange={(event) => setLandmark(event.target.value)}
            placeholder="e.g. Building, floor, room, or nearby landmark"
            rows={3}
          />
        </div>

        {canRecommend && (
          <section className="hospital-recommendations">
            <h3>Hospital Recommendations</h3>

            {loadingRecommendations && (
              <p>Calculating eligible hospitals and road-network travel times...</p>
            )}

            {recommendationError && (
              <p role="alert">{recommendationError}</p>
            )}

            {!loadingRecommendations && recommendations.length > 0 && (
              <>
                <p>
                  Hospitals are ranked using the current suitability scoring
                  model. Travel times are calculated using the project's road
                  graph and assumed road speeds.
                </p>

                {recommendedHospital && (
                  <div className="recommended-hospital-card">
                    <h4>Algorithm Recommendation</h4>
                    <p>
                      <strong>{recommendedHospital.name}</strong>
                    </p>
                    <p>
                      Estimated travel time:{" "}
                      {recommendedHospital.estimated_eta_minutes.toFixed(1)} min
                    </p>
                    <p>
                      Distance:{" "}
                      {(recommendedHospital.estimated_distance_meters / 1000).toFixed(2)} km
                    </p>
                    <p>
                      Current simulated hospital load:{" "}
                      {recommendedHospital.current_load ?? "Unknown"}%
                    </p>
                    <p>
                      Suitability score:{" "}
                      {recommendedHospital.final_score ?? "Unavailable"}
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="preferredHospital">
                    Choose Hospital Destination *
                  </label>
                  <select
                    id="preferredHospital"
                    value={preferredHospitalId}
                    onChange={(event) =>
                      setPreferredHospitalId(event.target.value)
                    }
                    required
                  >
                    <option value="">Select an eligible hospital</option>
                    {recommendations.map((hospital, index) => (
                      <option key={hospital.id} value={hospital.id}>
                        {index === 0 ? "Recommended — " : ""}
                        {hospital.name} —{" "}
                        {hospital.estimated_eta_minutes.toFixed(1)} min
                      </option>
                    ))}
                  </select>
                </div>

                {selectedHospital && (
                  <div>
                    <h4>Your Selected Hospital</h4>
                    <p>{selectedHospital.name}</p>
                    <p>
                      Estimated travel time:{" "}
                      {selectedHospital.estimated_eta_minutes.toFixed(1)} min
                    </p>

                    {recommendedHospital &&
                      selectedHospital.id !== recommendedHospital.id && (
                        <p>
                          You selected an alternative to the algorithm's
                          recommendation. Its estimated travel time is{" "}
                          {(
                            selectedHospital.estimated_eta_minutes -
                            recommendedHospital.estimated_eta_minutes
                          ).toFixed(1)}{" "}
                          minutes different from the recommended hospital.
                        </p>
                      )}
                  </div>
                )}

                <small>
                  These are simulated hospital and routing results, not live
                  emergency-service information.
                </small>
              </>
            )}
          </section>
        )}

        
        <button
          type="submit"
          disabled={
            !canRecommend ||
            loadingRecommendations ||
            !selectedHospital ||
            submitting
          }
        >
          {submitting
            ? "Saving Request..."
            : "Prepare Simulated Emergency Request"}
        </button>

      </form>
    </section>
  );
}

export default CitizenPortal;