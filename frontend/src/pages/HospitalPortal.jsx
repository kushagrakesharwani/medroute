import API_BASE_URL from "../api.js";
import { useCallback, useEffect, useState } from "react";
import "./HospitalPortal.css";

function HospitalPortal() {
  const [hospitalId, setHospitalId] = useState("H001");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCaseId, setBusyCaseId] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/cases/active`);
      if (!response.ok) throw new Error("Could not load emergency cases.");

      const data = await response.json();
      setCases(data.cases || []);
    } catch (err) {
      setError(err.message || "Could not connect to MedRoute API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCases();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadCases]);

  const hospitalCases = cases.filter(
    (item) => item.hospital_id === hospitalId
  );

  const awaitingCount = hospitalCases.filter(
    (item) => item.hospital_readiness === "AWAITING_ACKNOWLEDGMENT"
  ).length;

  async function acknowledgeCase(caseId) {
    setBusyCaseId(caseId);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/cases/${caseId}/acknowledge`,
        { method: "PATCH" }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Acknowledgment failed.");
      }

      await loadCases();
    } catch (err) {
      setError(err.message || "Could not acknowledge the case.");
    } finally {
      setBusyCaseId("");
    }
  }

  return (
    <section className="hospital-portal">
      <header className="hospital-header">
        <div>
          <h2>Hospital Operations</h2>
          <p>Review incoming emergencies and confirm hospital readiness.</p>
        </div>
        <div>
          <p>MEDROUTE</p>
          <strong>Emergency Response System</strong>
        </div>
      </header>

      <div className="hospital-selector">
        <label htmlFor="hospitalId">Hospital ID</label>
        <input
          id="hospitalId"
          value={hospitalId}
          onChange={(event) =>
            setHospitalId(event.target.value.toUpperCase().trim())
          }
          placeholder="e.g. H001"
        />
        <button onClick={loadCases} disabled={loading}>
          {loading ? "Loading..." : "Refresh Cases"}
        </button>
      </div>

      <div className="hospital-stats">
        <div className="hospital-stat">
          <strong>{hospitalCases.length}</strong>
          <span>Active incoming cases</span>
        </div>
        <div className="hospital-stat">
          <strong>{awaitingCount}</strong>
          <span>Awaiting acknowledgment</span>
        </div>
      </div>

      <h3 className="hospital-section-title">Incoming Emergency Cases</h3>

      {error && (
        <p className="hospital-message hospital-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="hospital-message">Loading emergency cases...</p>
      ) : hospitalCases.length === 0 ? (
        <p className="hospital-message">
          No active cases found for hospital {hospitalId}.
        </p>
      ) : (
        <div className="hospital-case-list">
          {hospitalCases.map((item) => {
            const awaiting =
              item.hospital_readiness === "AWAITING_ACKNOWLEDGMENT";

            return (
              <article className="hospital-case-card" key={item.id}>
                <h3>
                  {item.emergency_type?.toUpperCase() || "EMERGENCY"}{" "}
                  — {item.priority || "Priority unavailable"}
                </h3>

                <div className="hospital-case-details">
                  <p>
                    <strong>Patient:</strong>{" "}
                    {item.patient_name || "Not provided"}
                  </p>
                  <p className="hospital-case-id">
                    <strong>Case ID:</strong> {item.id}
                  </p>
                  <p>
                    <strong>Pickup:</strong>{" "}
                    {item.landmark || "Location not provided"}
                  </p>
                  <p>
                    <strong>Ambulance:</strong>{" "}
                    {item.ambulance_id || "Not assigned"}
                  </p>
                  <p>
                    <strong>Pickup-to-hospital travel:</strong>{" "}
                    {Number.isFinite(Number(item.estimated_eta_seconds))
                      ? `${Math.ceil(
                          Number(item.estimated_eta_seconds) / 60
                        )} min`
                      : "Unavailable"}
                  </p>
                  <p>
                    <strong>Mission:</strong> {item.mission_status || "Unknown"}
                  </p>
                </div>

                <span
                  className={`hospital-status ${
                    awaiting ? "" : "acknowledged"
                  }`}
                >
                  {item.hospital_readiness || "STATUS UNKNOWN"}
                </span>

                {awaiting ? (
                  <button
                    className="hospital-ack-button"
                    onClick={() => acknowledgeCase(item.id)}
                    disabled={busyCaseId === item.id}
                  >
                    {busyCaseId === item.id
                      ? "Acknowledging..."
                      : "Acknowledge Case"}
                  </button>
                ) : (
                  <p className="hospital-case-details">
                    Hospital acknowledgment recorded.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default HospitalPortal;