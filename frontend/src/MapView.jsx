import API_BASE_URL from "./api.js";
import { useEffect, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const createHospitalIcon = (accepting) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background-color: ${accepting ? "#16a34a" : "#dc2626"};
      width: 18px;
      height: 18px;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 5px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

const ambulanceIcon = L.divIcon({
  className: "",
  html: `<div style="
    font-size: 28px;
    line-height: 32px;
    text-align: center;
    width: 32px;
    height: 32px;
  ">🚑</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

function FitRoute({ coordinates }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [40, 40] });
    }
  }, [coordinates, map]);

  return null;
}

function MapView({emergencyType}) {
  const gwaliorCenter = [26.2183, 78.1828];

  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState("");
  const [ambulance, setAmbulance] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/hospitals/map`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load hospitals");
        }
        return response.json();
      })
      .then((data) => {
        setHospitals(data.hospitals);
       })
      .catch(() => {
        setError("Could not load hospital locations.");
      });
  }, []);
  
  useEffect(() => {
  let cancelled = false;

  const pickupLatitude = 26.2183;
  const pickupLongitude = 78.1828;

  fetch(
    `${API_BASE_URL}/ambulances/assign?emergency_type=${encodeURIComponent(
      emergencyType
    )}&pickup_latitude=${pickupLatitude}&pickup_longitude=${pickupLongitude}`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load ambulance assignment");
      }
      return response.json();
    })
    .then((data) => {
      if (cancelled) return;

      setError("");

      const coordinates = data.selected_route?.coordinates ?? [];

      setAmbulance(data.selected_ambulance ?? null);
      setSelectedHospital(data.selected_hospital ?? null);
      setRouteCoordinates(coordinates);
      setRouteDetails(data.selected_route ?? null);

      if (coordinates.length < 2) {
        setError("No route available. Check ambulance availability and route calculation.");
      }
    })
    .catch((err) => {
      if (cancelled) return;

      console.error("Ambulance assignment request failed:", err);
      setError("Could not load ambulance assignment.");
    });

  return () => {
    cancelled = true;
  };
}, [emergencyType]);

  return (
    <section className="medroute-map-section">
      <h2>Gwalior Emergency Map</h2>

      {error && <p>{error}</p>}

      <MapContainer
        center={gwaliorCenter}
        zoom={13}
        style={{
          height: "420px",
          width: "100%",
          borderRadius: "12px",
          border: "1px solid #dbe3ed",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <FitRoute coordinates={routeCoordinates} />

        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}

        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id || hospital.hospital}
            position={[hospital.latitude, hospital.longitude]}
            icon={createHospitalIcon(hospital.accepting_patients===true)}
          >
            <Popup>
                <strong>{hospital.name}</strong>
                <br />

                <p>
                    <strong>Specialties:</strong>{" "}
                    {hospital.specialties.join(", ")}
                </p>

                <p>
                    <strong>Current load:</strong>{" "}
                    {hospital.current_load == null
                    ? "Unknown"
                    : `${hospital.current_load}% (simulated)`}
                </p>

                <p>
                  <strong>Accepting patients:</strong>{" "}
                  {String(
                    hospital.accepting_patients === true
                      ? "Yes"
                      : hospital.accepting_patients === false
                        ? "No"
                        : "Unknown"
                  )}
                </p>

                <small>Demo hospital — simulated data</small>
            </Popup>
          </Marker>
        ))}
        {ambulance &&
        typeof ambulance.latitude === "number" &&
        typeof ambulance.longitude === "number" && (
          <Marker
            position={[ambulance.latitude, ambulance.longitude]}
            icon={ambulanceIcon}
          >
            <Popup>
              <strong>{ambulance.name}</strong>
              <br />
              Status: {ambulance.status}
              <br />
              ETA: {Math.round(ambulance.eta_seconds / 60)} minutes
              <br />
              <small>Simulated ambulance</small>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {routeDetails && (
        <div className="route-summary">
          <h3>🚑 Active Route Summary</h3>

          <p>
            <strong>Ambulance:</strong>{" "}
            {ambulance?.name ?? "Not assigned"}
          </p>

          <p>
            <strong>Destination Hospital:</strong>{" "}
            {selectedHospital?.name ?? "Not selected"}
          </p>

          <p>
            <strong>Estimated Travel Time:</strong>{" "}
            {Math.floor(routeDetails.eta_seconds / 60)} min{" "}
            {Math.round(routeDetails.eta_seconds % 60)} sec
          </p>

          <p>
            <strong>Route Distance:</strong>{" "}
            {(routeDetails.distance_meters / 1000).toFixed(2)} km
          </p>

          <small>Demo route — simulated ambulance data and estimated road speeds.</small>
        </div>
      )}
    </section>
  );
}

export default MapView;
