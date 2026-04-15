import React, { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import { useBoundary } from "../hooks/useBoundary";
import * as turf from "@turf/turf";

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const { boundaries, loading, error } = useBoundary();

  // The mask style covers the OUTSIDE world in solid colors
  const maskStyle = {
    fillColor: isDarkMode ? "#0f172a" : "#e2e8f0", 
    fillOpacity: 0.9, 
    color: "transparent", 
    weight: 0,
    interactive: false,
  };

  // The border style outlines Nepal clearly, exact to every corner
  const borderStyle = {
    color: isDarkMode ? "#60a5fa" : "#1d4ed8", // Bright glowing blue in dark mode, deep rich blue in light mode
    weight: 5, // Thicker, highly highlighted border
    opacity: 1, // 100% solid line opacity
    fillOpacity: 0, // Completely transparent inside so you can see the precise roads
    interactive: false,
  };

  const boundaryData = boundaries.nepal;

  const maskGeoJSON = useMemo(() => {
    if (!boundaryData) return null;
    try {
      // Create a massive polygon covering the whole world
      const worldPolygon = turf.polygon([[
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90]
      ]]);
      
      // turf.mask takes a polygon/feature collection and masks it over the world
      return turf.mask(boundaryData as any);
    } catch (e) {
      console.warn("Turf mask failed, using fallback", e);
      return null;
    }
  }, [boundaryData]);

  if (loading || error || !boundaryData) return null;

  return (
    <>
      {maskGeoJSON && <GeoJSON key="nepal-mask" data={maskGeoJSON} style={maskStyle} />}
      <GeoJSON key="nepal-border" data={boundaryData} style={borderStyle} />
    </>
  );
};

export default BoundaryOverlay;