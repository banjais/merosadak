import React from "react";
import { GeoJSON } from "react-leaflet";
import { useBoundary } from "../hooks/useBoundary";

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const { boundaries, loading, error } = useBoundary();

  // Styling for polygons based on dark/light mode
  const boundaryStyle = {
    color: isDarkMode ? "#ffcc00" : "#0078ff",
    weight: 2,
    fillOpacity: 0.1,
  };

  // Use boundary data from the hook (falls back to local fetch if hook data not available)
  const boundaryData = boundaries.nepal;

  if (loading || error || !boundaryData) return null;

  return <GeoJSON data={boundaryData} style={boundaryStyle} />;
};

export default BoundaryOverlay;