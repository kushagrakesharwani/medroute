import API_BASE_URL from "../api.js";
import { useEffect, useState } from "react";
import "./CitizenStatus.css";

function CitizenStatus({ caseId: initialCaseId = "" }) {
  const [caseId, setCaseId] = useState("");
  const [caseDetails, setCaseDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

async function loadCase(id) {
  const trimmedCaseId = id.trim();

  if (!trimmedCaseId) {
    setError("Please enter your Case ID.");
    return;
  }

  setLoading(true);
  setError("");
  setCaseDetails(null);

  try {
    const response = await fetch(
      `${API_BASE_URL}/cases/${encodeURIComponent(trimmedCaseId)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Unable to retrieve this emergency request."
      );
    }

    setCaseDetails(data);
  } catch (err) {
    setError(
      err.message ||
        "Could not connect to MedRoute. Check that the backend is running."
    );
  } finally {
    setLoading(false);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  await loadCase(caseId);
}

  const savedCase = caseDetails?.case;
  const hospital = caseDetails?.hospital;
  useEffect(() => {
    if (!initialCaseId) return;

    const timer = setTimeout(() => {
      loadCase(initialCaseId);
    }, 0);

    return () => clearTimeout(timer);
  }, [initialCaseId]);

  function formatStatus(status) {
    if (!status) return "Unknown";

    return status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }

  return (
    <section className="citizen-status">
      <header className="status-header">
        <p className="status-eyebrow">MEDROUTE / CITIZEN SERVICES</p>
        <h2>Track Your Emergency Request</h2>
        <p>
          Enter the Case ID provided when your simulated emergency request
          was saved.
        </p>
      </header>

      <form className="status-search" onSubmit={handleSearch}>
        <label htmlFor="caseId">Emergency Case ID</label>

        <input
          id="caseId"
          type="text"
          value={caseId}
          onChange={(event) => setCaseId(event.target.value)}
          placeholder="e.g. 08072655-8e15-485d-8e0d-a33ccfffaefc"
          autoComplete="off"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Checking Status..." : "Check Status"}
        </button>
      </form>

      {error && (
        <p className="status-error" role="alert">
          {error}
        </p>
      )}

      {savedCase && (
        <div className="status-results" aria-live="polite">
          <section className="status-overview">
            <div>
              <p className="status-eyebrow">CURRENT MISSION STATUS</p>
              <h3>{formatStatus(savedCase.mission_status)}</h3>
              <p>
                Case ID: <strong>{savedCase.id}</strong>
              </p>
            </div>

            <span className="status-badge">
              {formatStatus(savedCase.mission_status)}
            </span>
          </section>

          <section className="status-grid">
            <article className="status-card">
              <h3>Hospital Destination</h3>
              <p className="status-card-primary">
                {hospital?.name || "No hospital assigned"}
              </p>

              {hospital && (
                <p>
                  Simulated hospital load:{" "}
                  {hospital.current_load ?? "Unknown"}
                  {hospital.current_load != null ? "%" : ""}
                </p>
              )}

              <p>
                Hospital readiness:{" "}
                {formatStatus(savedCase.hospital_readiness)}
              </p>
            </article>

            <article className="status-card">
              <h3>Ambulance Assignment</h3>
              <p className="status-card-primary">
                {savedCase.ambulance_id
                  ? savedCase.ambulance_id
                  : "Awaiting assignment"}
              </p>
              <p>
                {savedCase.ambulance_id
                  ? "An ambulance is linked to this case."
                  : "No ambulance has been assigned to this case yet."}
              </p>
            </article>

            <article className="status-card">
              <h3>Estimated Hospital Travel</h3>
              <p className="status-card-primary">
                {savedCase.estimated_eta_seconds != null
                  ? `${(savedCase.estimated_eta_seconds / 60).toFixed(1)} min`
                  : "Unavailable"}
              </p>
              <p>
                Estimated route distance:{" "}
                {savedCase.estimated_distance_meters != null
                  ? `${(savedCase.estimated_distance_meters / 1000).toFixed(2)} km`
                  : "Unavailable"}
              </p>
              <small>
                Estimated road-network travel time, not live ambulance tracking.
              </small>
            </article>

            <article className="status-card">
              <h3>Request Details</h3>
              <p>
                Emergency category:{" "}
                {formatStatus(savedCase.emergency_type)}
              </p>
              <p>Priority: {formatStatus(savedCase.priority)}</p>
              <p>
                Submitted:{" "}
                {savedCase.created_at
                  ? new Date(savedCase.created_at).toLocaleString()
                  : "Unknown"}
              </p>
            </article>
          </section>

          <p className="status-disclaimer">
            College demonstration only. This page displays simulated
            emergency-service information and must not be used for real
            emergencies.
          </p>
        </div>
      )}
    </section>
  );
}

export default CitizenStatus;