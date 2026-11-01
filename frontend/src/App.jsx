import API_BASE_URL from "./api.js";
import { useEffect, useState } from "react";
import "./App.css";
import CitizenPortal from "./pages/CitizenPortal";
import DriverPortal from "./pages/DriverPortal";
import HospitalPortal from "./pages/HospitalPortal";
import DispatcherPortal from "./pages/DispatcherPortal";
import CitizenStatus from "./pages/CitizenStatus";

function App() {
  const [activePage, setActivePage] = useState("home");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setBackendStatus(data.status);
        setError("");
      })
      .catch(() => {
        setError("Could not connect to the backend.");
      });
  }, []);

  const portalPages = [
    "citizen",
    "citizen-status",
    "driver",
    "hospital",
    "dispatcher",
  ];

  return (
    <main>
      {activePage === "home" ? (
        <section className="home-page">
          <header className="home-nav">
            <div className="home-brand">
              <img
                src="/medroute-logo.png"
                alt="MedRoute"
                className="home-brand-icon"
              />
              <div>
                <strong>MedRoute</strong>
                <span>Emergency Coordination System</span>
              </div>
            </div>

            <div
              className={`backend-indicator ${
                error
                  ? "backend-offline"
                  : backendStatus === "Checking..."
                    ? ""
                    : "backend-online"
              }`}
            >
              <span className="backend-dot"></span>
              {error
                ? "API Disconnected"
                : backendStatus === "Checking..."
                  ? "Checking API..."
                  : "API Connected"}
            </div>
          </header>

          <section className="home-hero">
            <div className="home-hero-content">
              <span className="home-eyebrow">
                SMART EMERGENCY RESPONSE
              </span>
              <h1>Every Second Matters.</h1>
              <p>
                Coordinate emergency requests, match ambulances, and identify
                suitable hospitals through one connected dispatch platform.
              </p>

              <div className="home-hero-actions">
                <button
                  className="home-primary-button"
                  onClick={() => setActivePage("citizen")}
                >
                  Request Emergency Assistance <span>→</span>
                </button>

                <button
                  className="home-secondary-button"
                  onClick={() => {
                    setSelectedCaseId("");
                    setActivePage("citizen-status");
                  }}
                >
                  Track a Request
                </button>
              </div>

              <p className="home-demo-note">
                College demonstration · Simulated emergency operations
              </p>
            </div>

            <div className="home-hero-visual" aria-hidden="true">
              <div className="hero-orbit orbit-one"></div>
              <div className="hero-orbit orbit-two"></div>
              <div className="hero-cross">+</div>
              <div className="hero-emergency-icon">✚</div>

              <div className="hero-floating-card hero-card-top">
                <span>01</span>
                <div>
                  <strong>Dispatch</strong>
                  <small>Coordinate response</small>
                </div>
              </div>

              <div className="hero-floating-card hero-card-bottom">
                <span>02</span>
                <div>
                  <strong>Hospital routing</strong>
                  <small>Review suitable destinations</small>
                </div>
              </div>
            </div>
          </section>

          <section className="home-portals">
            <div className="home-section-heading">
              <div>
                <span className="home-eyebrow">MEDROUTE WORKSPACE</span>
                <h2>Choose your workspace</h2>
                <p>Access the tools relevant to your role.</p>
              </div>
            </div>

            <div className="home-portal-grid">
              <button
                className="home-portal-card citizen-card"
                onClick={() => setActivePage("citizen")}
              >
                <span className="portal-icon">＋</span>
                <span className="portal-card-title">Citizen Portal</span>
                <span className="portal-card-description">
                  Submit a simulated emergency request and view its details.
                </span>
                <span className="portal-card-link">Create a request ↗</span>
              </button>

              <button
                className="home-portal-card tracking-card"
                onClick={() => {
                  setSelectedCaseId("");
                  setActivePage("citizen-status");
                }}
              >
                <span className="portal-icon">⌕</span>
                <span className="portal-card-title">Track Emergency</span>
                <span className="portal-card-description">
                  Check mission status, ambulance assignment, and hospital
                  readiness.
                </span>
                <span className="portal-card-link">Track a request ↗</span>
              </button>

              <button
                className="home-portal-card driver-card"
                onClick={() => setActivePage("driver")}
              >
                <span className="portal-icon">➤</span>
                <span className="portal-card-title">Driver Portal</span>
                <span className="portal-card-description">
                  View assigned emergency missions and route information.
                </span>
                <span className="portal-card-link">
                  Open driver workspace ↗
                </span>
              </button>

              <button
                className="home-portal-card hospital-card"
                onClick={() => setActivePage("hospital")}
              >
                <span className="portal-icon">✚</span>
                <span className="portal-card-title">Hospital Portal</span>
                <span className="portal-card-description">
                  Review incoming cases and acknowledge hospital readiness.
                </span>
                <span className="portal-card-link">
                  Open hospital workspace ↗
                </span>
              </button>

              <button
                className="home-portal-card dispatcher-card"
                onClick={() => setActivePage("dispatcher")}
              >
                <span className="portal-icon">⌖</span>
                <span className="portal-card-title">Dispatcher Portal</span>
                <span className="portal-card-description">
                  Monitor active cases, ambulance assignments, and the
                  emergency map.
                </span>
                <span className="portal-card-link">
                  Open dispatch center ↗
                </span>
              </button>
            </div>
          </section>

          <footer className="home-footer">
            <div>
              <strong>MedRoute</strong>
              <span>
                Predictive Emergency Dispatch &amp; Hospital Selection
              </span>
            </div>
            <p>
              Academic project demonstration. Not for real emergency use.
            </p>
          </footer>
        </section>
      ) : portalPages.includes(activePage) ? (
        <section className="portal-page">
          <header className="portal-header">
            <div className="portal-header-brand">
              <img
                src="/medroute-logo.png"
                alt="MedRoute"
                className="portal-header-icon"
              />
              <div>
                <strong>MedRoute</strong>
                <span>Emergency Coordination System</span>
              </div>
            </div>

            <div className="portal-header-status">
              {error
                ? "API Disconnected"
                : backendStatus === "Checking..."
                  ? "Checking API..."
                  : "API Connected"}
            </div>
          </header>

          <div className="portal-content">
            <button
              className="back-home-button"
              onClick={() => setActivePage("home")}
            >
              ← Back to Home
            </button>

            {activePage === "citizen" ? (
              <CitizenPortal
                onCaseCreated={(caseId) => {
                  setSelectedCaseId(caseId);
                  setActivePage("citizen-status");
                }}
              />
            ) : activePage === "citizen-status" ? (
              <CitizenStatus caseId={selectedCaseId} />
            ) : activePage === "driver" ? (
              <DriverPortal />
            ) : activePage === "hospital" ? (
              <HospitalPortal />
            ) : (
              <DispatcherPortal />
            )}
          </div>
        </section>
      ) : (
        <section className="home-page">
          <p>Page not found.</p>
          <button onClick={() => setActivePage("home")}>
            Return Home
          </button>
        </section>
      )}
    </main>
  );
}

export default App;