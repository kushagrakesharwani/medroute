import API_BASE_URL from "../api.js";
import { useCallback, useEffect, useState } from "react";
import MapView from "../MapView";
import "./DispatcherPortal.css";

function DispatcherPortal() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/cases/active`);

      if (!response.ok) {
        throw new Error("Could not load active emergency cases.");
      }

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

  const pendingCount = cases.filter(
    (item) => item.mission_status === "PENDING"
  ).length;

  const assignedCount = cases.filter(
    (item) => item.mission_status === "ASSIGNED"
  ).length;

  const enRouteCount = cases.filter((item) =>
    ["EN_ROUTE", "TO_PICKUP", "AT_PICKUP", "TO_HOSPITAL"].includes(
      item.mission_status
    )
  ).length;

  return (
    <section className="dispatcher-portal">
      <header className="dispatcher-header">
        <div>
          <h2>Emergency Dispatch Center</h2>
          <p>Monitor emergency requests, ambulance assignments, and missions.</p>
        </div>
        <span className="dispatcher-live-label">MEDROUTE DISPATCH</span>
      </header>

      <div className="dispatcher-toolbar">
        <p>Active emergency operations</p>
        <button onClick={loadCases} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Cases"}
        </button>
      </div>

      {error && (
        <p className="dispatcher-message dispatcher-error" role="alert">
          {error}
        </p>
      )}

      <div className="dispatcher-stats">
        <div className="dispatcher-stat">
          <strong>{cases.length}</strong>
          <span>Active cases</span>
        </div>
        <div className="dispatcher-stat">
          <strong>{pendingCount}</strong>
          <span>Pending missions</span>
        </div>
        <div className="dispatcher-stat">
          <strong>{assignedCount}</strong>
          <span>Assigned</span>
        </div>
        <div className="dispatcher-stat">
          <strong>{enRouteCount}</strong>
          <span>En route</span>
        </div>
      </div>

      <div className="dispatcher-map-section">
        <h3>Emergency Map</h3>
        <p>
          Map data and route estimates are simulated or calculated estimates.
        </p>

        {loading ? (
          <p className="dispatcher-message">Loading emergency operations...</p>
        ) : cases.length === 0 ? (
          <p className="dispatcher-message">
            No active routes. Routes will appear when active emergency cases exist.
          </p>
        ) : (
          <MapView emergencyType={cases[0].emergency_type || "general"} />
        )}
      </div>

      <div className="dispatcher-cases-section">
        <h3>Active Emergency Cases</h3>

        {loading ? (
          <p className="dispatcher-message">Loading cases...</p>
        ) : cases.length === 0 ? (
          <p className="dispatcher-message">No active emergency cases found.</p>
        ) : (
          <div className="dispatcher-case-list">
            {cases.map((item) => (
              <article className="dispatcher-case-card" key={item.id}>
                <div className="dispatcher-case-heading">
                  <h4>
                    {item.emergency_type?.toUpperCase() || "EMERGENCY"}{" "}
                    — {item.priority || "Priority unavailable"}
                  </h4>
                  <span
                    className={`dispatcher-status ${
                      item.mission_status?.toLowerCase() || "unknown"
                    }`}
                  >
                    {item.mission_status || "UNKNOWN"}
                  </span>
                </div>

                <p>
                  <strong>Patient:</strong>{" "}
                  {item.patient_name || "Not provided"}
                </p>
                <p className="dispatcher-case-id">
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
                  <strong>Hospital ID:</strong>{" "}
                  {item.hospital_id || "Not selected"}
                </p>
                <p>
                  <strong>Estimated arrival:</strong>{" "}
                  {Number.isFinite(Number(item.estimated_eta_seconds))
                    ? `${Math.ceil(
                        Number(item.estimated_eta_seconds) / 60
                      )} min`
                    : "Unavailable"}
                </p>
                <p>
                  <strong>Hospital readiness:</strong>{" "}
                  {item.hospital_readiness || "Unknown"}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="dispatcher-notice">
        Demonstration mode: ambulance locations and travel estimates are
        simulated or calculated estimates, not live emergency dispatch data.
      </div>
    </section>
  );
}

export default DispatcherPortal;