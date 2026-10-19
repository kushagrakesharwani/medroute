
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [error, setError] = useState("");
  const [emergencyType, setEmergencyType] = useState("trauma");
  const [hospitals, setHospitals] = useState([]);
  const [excludedHospitals, setExcludedHospitals] = useState([]);
  const [recommendationError, setRecommendationError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchRecommendations() {
  setLoading(true);
  setRecommendationError("");

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/hospitals/recommend?emergency_type=${emergencyType}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch hospital recommendations");
    }

    const data = await response.json();

    setHospitals(data.recommendations);
    setExcludedHospitals(data.excluded_hospitals);
  } catch (err) {
    setRecommendationError(err.message);
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setBackendStatus(data.status);
      })
      .catch(() => {
        setError("Could not connect to the backend.");
      });
  }, []);

  return (
    <main>
      <h1>MedRoute</h1>
      <p>Predictive Emergency Dispatch</p>

      <h2>Backend Connection</h2>
      {error ? (
        <p>{error}</p>
      ) : (
        <p>Status: {backendStatus}</p>
      )}
      <hr />

      <h2>Hospital Recommendations</h2>

      <label htmlFor="emergencyType">Emergency Type: </label>

      <select
        id="emergencyType"
        value={emergencyType}
        onChange={(event) => setEmergencyType(event.target.value)}
      >
        <option value="trauma">Trauma</option>
        <option value="cardiac">Cardiac</option>
        <option value="stroke">Stroke</option>
        <option value="general">General Emergency</option>
      </select>

      <button onClick={fetchRecommendations} disabled={loading}>
        {loading ? "Finding Hospitals..." : "Find Hospitals"}
      </button>

      {recommendationError && <p>{recommendationError}</p>}

      {hospitals.length > 0 && (
          <section>
            <h3>Recommended Hospitals</h3>

            {hospitals.map((hospital) => (
              <article key={hospital.id}>
                <h4>{hospital.name}</h4>

                <p>Estimated ETA: {hospital.estimated_eta_minutes} minutes</p>
                <p>Current Load: {hospital.current_load}%</p>
                <p>ETA Score: {hospital.eta_score}</p>
                <p>Load Score: {hospital.load_score}</p>
                <p>Final Score: {hospital.final_score ?? "Unavailable"}</p>
              </article>
            ))}
          </section>
        )}

      {excludedHospitals.length > 0 && (
        <section>
          <h3>Excluded Hospitals</h3>

          {excludedHospitals.map((hospital) => (
            <p key={hospital.hospital}>
              {hospital.hospital} — {hospital.reason}
            </p>
          ))}
        </section>
      )}
      {!recommendationError &&
        !loading &&
        hospitals.length === 0 &&
        excludedHospitals.length > 0 && (
          <p>No eligible hospitals found for this emergency type.</p>
        )}
    </main>
  );
}

export default App;