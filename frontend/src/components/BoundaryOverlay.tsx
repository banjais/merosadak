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
  const maskStyle = useMemo(() => ({
    fillColor: isDarkMode ? "#0f172a" : "#e2e8f0",
    fillOpacity: 0.9,
    color: "transparent",
    weight: 0,
    interactive: false,
  }), [isDarkMode]);

  // The border style outlines Nepal clearly, exact to every corner
  const borderStyle = useMemo(() => ({
    color: isDarkMode ? "#60a5fa" : "#1d4ed8", // Bright glowing blue in dark mode, deep rich blue in light mode
    weight: 5, // Thicker, highly highlighted border
    opacity: 1, // 100% solid line opacity
    fillOpacity: 0, // Completely transparent inside so you can see the precise roads
    interactive: false,
  }), [isDarkMode]);

  const boundaryData = boundaries.nepal;

  const { outerBoundary, maskGeoJSON } = useMemo(() => {
    if (!boundaryData) return { outerBoundary: null, maskGeoJSON: null };
    try {
      let unified = boundaryData;

      // Filter for Polygon/MultiPolygon features and union them into one single shape
      if (boundaryData.type === 'FeatureCollection') {
        const polyFeatures = boundaryData.features.filter(f =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );
        
        if (polyFeatures.length > 0) {
          let unioned = polyFeatures[0];
          for (let i = 1; i < polyFeatures.length; i++) {
            try {
              const result = turf.union(unioned as any, polyFeatures[i] as any);
              if (result) unioned = result as any;
            } catch (unionError) {
              // Silently skip problematic geometries
            }
          }
          unified = unioned;
        }
      }

      return {
        outerBoundary: unified,
        maskGeoJSON: turf.mask(unified as any)
      };
    } catch (e) {
      console.warn("[BoundaryOverlay] Geometry processing failed", e);
      return { outerBoundary: boundaryData, maskGeoJSON: null };
    }
  }, [boundaryData]);

  if (loading || error || !boundaryData) return null;

  return (
    <>
      {maskGeoJSON && <GeoJSON key={`nepal-mask-${isDarkMode}`} data={maskGeoJSON} style={maskStyle} />}
      {outerBoundary && <GeoJSON key={`nepal-border-${isDarkMode}`} data={outerBoundary} style={borderStyle} />}
    </>
  );
};

export default BoundaryOverlay;