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
        const res = await fetch("/data/boundary.geojson");
        if (!res.ok) throw new Error("Failed to fetch from public");
        const data = await res.json();
        setBoundaryData(data);
      } catch (primaryErr) {
        console.warn("[BoundaryOverlay] Public fetch failed, trying API:", primaryErr);
        try {
          const apiRes = await fetch("/api/v1/boundary");
          if (apiRes.ok) {
            const data = await apiRes.json();
            setBoundaryData(data);
          }
        } catch (fallbackErr) {
          console.error("[BoundaryOverlay] API fallback also failed:", fallbackErr);
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