import React, { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import BoundaryOverlay from "./components/BoundaryOverlay";

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      {/* Dark mode toggle button */}
      <button
        onClick={toggleDarkMode}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: "6px 12px",
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        {isDarkMode ? "Light Mode" : "Dark Mode"}
      </button>

      {/* Leaflet Map */}
      <MapContainer
        center={[28.3949, 84.1240]} // Center of Nepal
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        {/* Base tile layer */}
        <TileLayer
          url={
            isDarkMode
              ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Boundary Overlay */}
        <BoundaryOverlay isDarkMode={isDarkMode} />
      </MapContainer>
    </div>
  );
};

export default App;