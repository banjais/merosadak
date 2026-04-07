import React, { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const [boundaryData, setBoundaryData] = useState<any>(null);

  useEffect(() => {
    // Load boundary.geojson from public folder
    fetch("/data/boundary.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch boundary.geojson");
        return res.json();
      })
      .then((data) => setBoundaryData(data))
      .catch((err) => console.error("[BoundaryOverlay] Error:", err));
  }, []);

  // Styling for polygons based on dark/light mode
  const boundaryStyle = {
    color: isDarkMode ? "#ffcc00" : "#0078ff",
    weight: 2,
    fillOpacity: 0.1,
  };

  if (!boundaryData) return null;

  return <GeoJSON data={boundaryData} style={boundaryStyle} />;
};

export default BoundaryOverlay;