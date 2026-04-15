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

  const maskGeoJSON = useMemo(() => {
    if (!boundaryData) return null;
    try {
      let polygonToMask = boundaryData;

      // If boundaryData is a FeatureCollection, we union polygons to create a clean mask.
      // We filter for Polygon/MultiPolygon to prevent turf.union from failing on mixed geometries.
      if (boundaryData.type === 'FeatureCollection') {
        const polyFeatures = boundaryData.features.filter(f =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );
        if (polyFeatures.length > 0) {
          let unioned = polyFeatures[0];
          for (let i = 1; i < polyFeatures.length; i++) {
            unioned = turf.union(unioned as any, polyFeatures[i] as any) as any;
          }
          polygonToMask = unioned;
        }
      }

      // turf.mask takes a polygon and creates an inverted world-sized polygon
      return turf.mask(polygonToMask as any);
    } catch (e) {
      console.warn("Turf mask failed, using fallback", e);
      return null;
    }
  }, [boundaryData]);

  if (loading || error || !boundaryData) return null;

  return (
    <>
      {maskGeoJSON && <GeoJSON key={`nepal-mask-${isDarkMode}`} data={maskGeoJSON} style={maskStyle} />}
      <GeoJSON key={`nepal-border-${isDarkMode}`} data={boundaryData} style={borderStyle} />
    </>
  );
};

export default BoundaryOverlay;