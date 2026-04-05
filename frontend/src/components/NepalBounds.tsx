// src/components/NepalBounds.tsx
import { useEffect, useMemo } from "react";
import { useMap, Polygon } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry, Position } from "geojson";

interface Props {
  boundary: FeatureCollection | null;
  isDarkMode?: boolean;
}

// Hardcoded reliable Nepal boundary as fallback (always works)
// Note: These are [lat, lng] pairs
const FALLBACK_NEPAL_BOUNDARY: [number, number][] = [
  [30.422717, 81.525804], [30.944466, 81.746277], [31.04918, 81.903738],
  [31.013981, 82.155929], [30.115268, 82.327513], [29.865519, 82.594532],
  [29.320226, 83.898993], [28.839894, 84.23458], [28.642774, 85.011638],
  [28.203576, 85.82332], [26.630985, 86.024393], [27.974262, 86.954517],
  [27.445819, 88.043133], [27.876542, 88.120441], [27.774242, 88.890379],
  [27.912213, 88.435657], [28.088571, 88.056819], [27.879532, 87.227472],
  [27.45074, 86.756643], [27.04851, 86.503691], [26.745826, 86.242509],
  [26.405963, 85.687494], [26.726198, 85.251779], [27.234901, 84.675018],
  [28.839894, 84.23458], [29.463732, 83.337115], [30.115268, 82.327513],
  [30.422717, 81.525804]
];

export const NepalBounds: React.FC<Props> = ({ boundary, isDarkMode = false }) => {
  const map = useMap();

  // Set map constraints when Nepal map is active
  useEffect(() => {
    try {
      if (boundary && boundary.features && boundary.features.length > 0) {
        const geoLayer = new L.GeoJSON(boundary);
        map.setMaxBounds(geoLayer.getBounds().pad(0.2));
        map.setMinZoom(6);
      } else {
        // Use hardcoded fallback bounds for Nepal
        const nepalBounds = L.latLngBounds(
          L.latLng(26.0, 79.5),
          L.latLng(30.5, 88.5)
        );
        map.setMaxBounds(nepalBounds.pad(0.2));
        map.setMinZoom(6);
      }
    } catch (error) {
      console.error('Error setting Nepal bounds:', error);
      const nepalBounds = L.latLngBounds(
        L.latLng(26.0, 79.5),
        L.latLng(30.5, 88.5)
      );
      map.setMaxBounds(nepalBounds.pad(0.2));
      map.setMinZoom(6);
    }
  }, [boundary, map]);

  return null; // No visual overlay - just set bounds
};