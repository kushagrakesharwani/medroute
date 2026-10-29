import API_BASE_URL from "../api.js";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./DriverPortal.css";

function MissionMapBounds({ routeData }) {
  const map = useMap();

  useEffect(() => {
    if (!routeData) return;

    const coordinates = [
      ...(routeData.route_to_pickup?.coordinates ?? []),
      ...(routeData.route_to_hospital?.coordinates ?? []),
      [
        routeData.pickup.latitude,
        routeData.pickup.longitude,
      ],
      [
        routeData.hospital.latitude,
        routeData.hospital.longitude,
      ],
    ];

    if (coordinates.length > 0) {
      map.fitBounds(coordinates, { padding: [30, 30] });
    }
  }, [map, routeData]);

  return null;
}

function MissionRouteMap({ routeData, error }) {
  if (error) {
    return (
      <p className="mission-map-message">
        Route map unavailable: {error}
      </p>
    );
  }

  if (!routeData) {
    return (
      <p className="mission-map-message">
        Loading mission route...
      </p>
    );
  }

  const ambulance = routeData.ambulance;
  const pickup = routeData.pickup;
  const hospital = routeData.hospital;

  const pickupRoute =
    routeData.route_to_pickup?.coordinates ?? [];

  const hospitalRoute =
    routeData.route_to_hospital?.coordinates ?? [];

  return (
    <div className="mission-map-container">
      <h4>Mission Route Guidance</h4>

      <div className="mission-map-legend">
        <span>🔵 Ambulance → Pickup</span>
        <span>🟢 Pickup → Hospital</span>
      </div>

      <MapContainer
        center={[pickup.latitude, pickup.longitude]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "340px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MissionMapBounds routeData={routeData} />

        {pickupRoute.length > 1 && (
          <Polyline
            positions={pickupRoute}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.9,
            }}
          />
        )}

        {hospitalRoute.length > 1 && (
          <Polyline
            positions={hospitalRoute}
            pathOptions={{
              color: "#16a34a",
              weight: 5,
              opacity: 0.9,
            }}
          />
        )}

        <CircleMarker
          center={[ambulance.latitude, ambulance.longitude]}
          radius={9}
          pathOptions={{
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{ambulance.name}</strong>
            <br />
            Ambulance ID: {ambulance.id}
            <br />
            <small>Simulated ambulance location</small>
          </Popup>
        </CircleMarker>

        <CircleMarker
          center={[pickup.latitude, pickup.longitude]}
          radius={8}
          pathOptions={{
            color: "#15803d",
            fillColor: "#22c55e",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>Pickup Location</strong>
            <br />
            {pickup.landmark || "Landmark not provided"}
            <br />
            {pickup.latitude}, {pickup.longitude}
          </Popup>
        </CircleMarker>

        <CircleMarker
          center={[hospital.latitude, hospital.longitude]}
          radius={9}
          pathOptions={{
            color: "#991b1b",
            fillColor: "#ef4444",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{hospital.name}</strong>
            <br />
            Destination hospital
          </Popup>
        </CircleMarker>
      </MapContainer>

      <div className="mission-route-details">
        <div>
          <span>Ambulance to pickup</span>
          <strong>
            {(
              routeData.route_to_pickup.distance_meters / 1000
            ).toFixed(2)}{" "}
            km ·{" "}
            {Math.round(
              routeData.route_to_pickup.eta_seconds / 60
            )}{" "}
            min
          </strong>
        </div>

        <div>
          <span>Pickup to hospital</span>
          <strong>
            {(
              routeData.route_to_hospital.distance_meters / 1000
            ).toFixed(2)}{" "}
            km ·{" "}
            {Math.round(
              routeData.route_to_hospital.eta_seconds / 60
            )}{" "}
            min
          </strong>
        </div>
      </div>

      <p className="mission-map-disclaimer">
        Illustrative route guidance using simulated ambulance
        coordinates and estimated road speeds. This is not live GPS
        navigation or real-time traffic information.
      </p>
    </div>
  );
}

function DriverPortal() {
  const [ambulances, setAmbulances] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  
async function loadData() {
  setLoading(true);
  setError("");

  try {
    const [fleetResponse, missionsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/ambulances`),
      fetch(`${API_BASE_URL}/cases/active`),
    ]);

    if (!fleetResponse.ok) {
      throw new Error("Could not load ambulance records.");
    }

    if (!missionsResponse.ok) {
      throw new Error("Could not load active missions.");
    }

    const fleetData = await fleetResponse.json();
    const missionData = await missionsResponse.json();

    const fleet = fleetData.ambulances ?? [];
    const cases = missionData.cases ?? [];

    setAmbulances(fleet);

    const detailedMissions = await Promise.all(
      cases.map(async (item) => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/cases/${encodeURIComponent(item.id)}`
          );

          if (!response.ok) {
            return {
              ...item,
              hospital: null,
              routeData: null,
              routeError: "Could not load mission details.",
            };
          }

          const details = await response.json();

          let routeData = null;
          let routeError = "";

          try {
            const routeResponse = await fetch(
              `${API_BASE_URL}/cases/${encodeURIComponent(item.id)}/route`
            );

            if (!routeResponse.ok) {
              const body = await routeResponse.json().catch(() => ({}));
              throw new Error(
                body.detail || "Could not calculate this mission's route."
              );
            }

            routeData = await routeResponse.json();
          } catch (err) {
            routeError = err.message || "Could not load mission route.";
          }

          return {
            ...details.case,
            hospital: details.hospital ?? null,
            routeData,
            routeError,
          };
        } catch {
          return {
            ...item,
            hospital: null,
            routeData: null,
            routeError: "Could not load mission details.",
          };
        }
      })
    );

    setMissions(
      detailedMissions.filter((mission) => mission.ambulance_id)
    );
  } catch (err) {
    setError(err.message || "Unable to connect to the MedRoute API.");
  } finally {
    setLoading(false);
  }
}

async function updateMissionStatus(mission) {
  const nextStatus = {
    ASSIGNED: "TO_PICKUP",
    TO_PICKUP: "AT_PICKUP",
    AT_PICKUP: "TO_HOSPITAL",
    TO_HOSPITAL: "COMPLETED",
  }[mission.mission_status];

  if (!nextStatus) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/cases/${encodeURIComponent(mission.id)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ambulance_id: mission.ambulance_id,
          status: nextStatus,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not update mission status.");
    }

    await loadData();
  } catch (err) {
    alert(err.message || "Failed to update mission status.");
  }
}

useEffect(() => {
  const timer = setTimeout(() => {
    loadData();
  }, 0);

  return () => clearTimeout(timer);
}, []);

  const available = ambulances.filter(
    (ambulance) =>
      ambulance.operational && ambulance.status === "available"
  ).length;

  const assigned = ambulances.filter(
    (ambulance) =>
      ambulance.operational && ambulance.status === "assigned"
  ).length;

  const unavailable = ambulances.filter(
    (ambulance) =>
      !ambulance.operational || ambulance.status === "unavailable"
  ).length;

  function ambulanceName(id) {
    const ambulance = ambulances.find((item) => item.id === id);
    return ambulance ? `${ambulance.id} · ${ambulance.name}` : id;
  }

  function formatEta(seconds) {
    if (typeof seconds !== "number" || seconds < 0) {
      return "Not available";
    }

    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  return (
    <main className="driver-portal">
      <header>
        <p>MEDROUTE / DRIVER SERVICES</p>
        <h1>Driver Portal</h1>
        <p>
          View ambulance availability, assigned emergencies, and
          pickup and hospital details. Fleet locations and travel
          estimates are simulated.
        </p>

        <button onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Fleet & Missions"}
        </button>
      </header>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading fleet and mission information...</p>
      ) : (
        <>
          <section className="fleet-summary">
            <article>
              <h3>Total Ambulances</h3>
              <strong>{ambulances.length}</strong>
            </article>

            <article>
              <h3>Available</h3>
              <strong>{available}</strong>
            </article>

            <article>
              <h3>Assigned</h3>
              <strong>{assigned}</strong>
            </article>

            <article>
              <h3>Unavailable</h3>
              <strong>{unavailable}</strong>
            </article>
          </section>

          <section className="missions-section">
            <div className="section-heading">
              <div>
                <h2>Active Missions</h2>
                <p>Emergency cases currently linked to an ambulance.</p>
              </div>

              <span className="mission-count">
                {missions.length} missions
              </span>
            </div>

            {missions.length === 0 ? (
              <div className="empty-missions">
                <h3>No Active Missions</h3>
                <p>
                  No active emergency cases with an assigned ambulance
                  were found.
                </p>
              </div>
            ) : (
              <div className="mission-list">
                {missions.map((mission) => (
                  <article className="mission-card" key={mission.id}>
                    <div className="mission-card-header">
                      <div>
                        <span className="mission-label">
                          {mission.emergency_type} emergency
                        </span>
                        <h3>
                          Case {mission.id.slice(0, 8)}
                        </h3>
                      </div>

                      <div className="mission-status-actions">
                        <span className="mission-status">
                          {mission.mission_status || "PENDING"}
                        </span>

                        {{
                          ASSIGNED: "Start Response",
                          TO_PICKUP: "Arrived at Pickup",
                          AT_PICKUP: "Transport Patient",
                          TO_HOSPITAL: "Complete Handover",
                        }[mission.mission_status] && (
                          <button
                            type="button"
                            onClick={() => updateMissionStatus(mission)}
                          >
                            {{
                              ASSIGNED: "Start Response",
                              TO_PICKUP: "Arrived at Pickup",
                              AT_PICKUP: "Transport Patient",
                              TO_HOSPITAL: "Complete Handover",
                            }[mission.mission_status]}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mission-details-grid">
                      <div>
                        <span>Assigned Ambulance</span>
                        <strong>
                          {ambulanceName(mission.ambulance_id)}
                        </strong>
                      </div>

                      <div>
                        <span>Priority</span>
                        <strong>{mission.priority || "Not specified"}</strong>
                      </div>

                      <div>
                        <span>Pickup Location</span>
                        <strong>
                          {mission.landmark?.trim()
                            ? mission.landmark
                            : mission.pickup_location_id || "Location not provided"}
                        </strong>
                        <small>
                          {mission.pickup_latitude != null &&
                          mission.pickup_longitude != null
                            ? `${mission.pickup_latitude}, ${mission.pickup_longitude}`
                            : "Coordinates not available"}
                        </small>
                      </div>

                      <div>
                        <span>Destination Hospital</span>
                        <strong>
                          {mission.hospital?.name ||
                            mission.hospital_id ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div>
                        <span>Estimated Hospital Travel</span>
                        <strong>
                          {formatEta(mission.estimated_eta_seconds)}
                        </strong>
                      </div>

                      <div>
                        <span>Hospital Readiness</span>
                        <strong>
                          {(
                            mission.hospital_readiness || "Unknown"
                          ).replaceAll("_", " ")}
                        </strong>
                      </div>
                    </div>

                    <p className="mission-disclaimer">
                      Simulated mission information. The displayed
                      hospital travel estimate is not the ambulance's
                      live position or its route-to-pickup ETA.
                    </p>
                    <MissionRouteMap
                      routeData={mission.routeData}
                      error={mission.routeError}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="fleet-section">
            <h2>Fleet Overview</h2>

            {ambulances.length === 0 ? (
              <p>No ambulance records were found.</p>
            ) : (
              <div className="fleet-table-wrapper">
                <table className="fleet-table">
                  <thead>
                    <tr>
                      <th>Ambulance</th>
                      <th>Type</th>
                      <th>Operational</th>
                      <th>Status</th>
                      <th>Capabilities</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ambulances.map((ambulance) => {
                      const usable =
                        ambulance.operational &&
                        ambulance.status === "available";

                      const displayStatus = !ambulance.operational
                        ? "Not operational"
                        : ambulance.status;

                      return (
                        <tr key={ambulance.id}>
                          <td>
                            <strong>{ambulance.id}</strong>
                            <br />
                            {ambulance.name}
                          </td>

                          <td>{ambulance.ambulance_type || "—"}</td>

                          <td>
                            {ambulance.operational ? "Yes" : "No"}
                          </td>

                          <td>
                            <span
                              className={`fleet-status ${
                                usable ? "status-available" : ""
                              }`}
                            >
                              {displayStatus}
                            </span>
                          </td>

                          <td>
                            {(ambulance.capabilities ?? []).join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default DriverPortal;