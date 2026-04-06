// src/components/BoundaryOverlay.tsx
import { useEffect } from "react";
import { useMap, GeoJSON } from "react-leaflet";
import { useBoundary } from "../hooks/useBoundary";

interface BoundaryOverlayProps {
  isDarkMode?: boolean;
}

export const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({
  isDarkMode = false,
}) => {
  const map = useMap();
  const { boundaries, loading, error } = useBoundary();

  // Style for Nepal boundary - filled to hide outside areas
  const getNepalStyle = () => {
    return {
      fillOpacity: 0.15,
      fillColor: isDarkMode ? '#0062a2' : '#0062a2',
      weight: 2,
      color: isDarkMode ? '#4fc3f7' : '#0062a2',
      opacity: 1,
      dashArray: '',
    };
  };

  // Render Nepal boundary layer
  useEffect(() => {
    if (loading || error) return;

    // Clear existing boundary layers
    map.eachLayer((layer: any) => {
      if (layer.options?.boundaryType === 'nepal') {
        map.removeLayer(layer);
      }
    });

    // Add Nepal boundary layer
    if (boundaries.nepal) {
      const nepalLayer = new L.GeoJSON(boundaries.nepal as any, {
        style: () => getNepalStyle(),
        boundaryType: 'nepal',
      });
      nepalLayer.addTo(map);
    }

    // Cleanup function
    return () => {
      if (boundaries.nepal) {
        map.eachLayer((layer: any) => {
          if (layer.options?.boundaryType === 'nepal') {
            map.removeLayer(layer);
          }
        });
      }
    };
  }, [boundaries, isDarkMode, map, loading, error]);

  return null;
};