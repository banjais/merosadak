import React, { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const [boundaryData, setBoundaryData] = useState<any>(null);

  useEffect(() => {
    const loadBoundary = async () => {
      try {
        const res = await fetch("/api/boundary");
        if (!res.ok) throw new Error("Failed to fetch from API");
        const json = await res.json();
        setBoundaryData(json.data || json);
      } catch (primaryErr) {
        console.warn("[BoundaryOverlay] API fetch failed, trying public folder:", primaryErr);
        try {
          const publicRes = await fetch("/boundary.geojson");
          if (publicRes.ok) {
            const data = await publicRes.json();
            setBoundaryData(data);
          }
        } catch (fallbackErr) {
          console.error("[BoundaryOverlay] Public fallback also failed:", fallbackErr);
        }
      }
    };
    loadBoundary();
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