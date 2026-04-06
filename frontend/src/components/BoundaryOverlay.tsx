// src/components/BoundaryOverlay.tsx
import { useEffect } from "react";
import { useMap, GeoJSON } from "react-leaflet";
import { useBoundary } from "../hooks/useBoundary";

interface BoundaryOverlayProps {
  showDistricts?: boolean;
  showProvinces?: boolean;
  showLocal?: boolean;
  isDarkMode?: boolean;
}

export const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({
  showDistricts = false,
  showProvinces = true,
  showLocal = false,
  isDarkMode = false,
}) => {
  const map = useMap();
  const { boundaries, loading, error } = useBoundary();

  // Style for different boundary types
  const getBoundaryStyle = (type: string) => {
    const baseStyle = {
      fillOpacity: 0,
      weight: type === 'districts' ? 1 : type === 'provinces' ? 2 : 0.5,
      opacity: isDarkMode ? 0.6 : 0.8,
    };

    if (type === 'districts') {
      return {
        ...baseStyle,
        color: isDarkMode ? '#64748b' : '#94a3b8',
      };
    } else if (type === 'provinces') {
      return {
        ...baseStyle,
        color: isDarkMode ? '#f1f5f9' : '#334155',
      };
    } else if (type === 'local') {
      return {
        ...baseStyle,
        color: isDarkMode ? '#cbd5e1' : '#64748b',
      };
    } else if (type === 'country') {
      // Nepal country border - more prominent
      return {
        fillOpacity: 0.05,
        fillColor: isDarkMode ? '#0062a2' : '#0062a2',
        weight: 3,
        color: isDarkMode ? '#4fc3f7' : '#0062a2',
        opacity: 0.9,
        dashArray: '',
      };
    }

    return baseStyle;
  };

  // Render boundary layers
  useEffect(() => {
    if (loading || error) return;

    // Clear existing boundary layers
    map.eachLayer((layer: any) => {
      if (layer.options?.boundaryType) {
        map.removeLayer(layer);
      }
    });

    // Add boundary layers
    const layersToAdd: any[] = [];

    if (showDistricts && boundaries.districts) {
      const districtsLayer = new L.GeoJSON(boundaries.districts as any, {
        style: () => getBoundaryStyle('districts'),
        boundaryType: 'districts',
      });
      layersToAdd.push(districtsLayer);
    }

    if (showProvinces && boundaries.provinces) {
      const provincesLayer = new L.GeoJSON(boundaries.provinces as any, {
        style: () => getBoundaryStyle('provinces'),
        boundaryType: 'provinces',
      });
      layersToAdd.push(provincesLayer);
    }

    if (showLocal && boundaries.local) {
      const localLayer = new L.GeoJSON(boundaries.local as any, {
        style: () => getBoundaryStyle('local'),
        boundaryType: 'local',
      });
      layersToAdd.push(localLayer);
    }

    // Add layers to map
    layersToAdd.forEach(layer => {
      layer.addTo(map);
    });

    // Cleanup function
    return () => {
      layersToAdd.forEach(layer => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    };
  }, [boundaries, showDistricts, showProvinces, showLocal, isDarkMode, map, loading, error]);

  return null; // This component doesn't render anything directly
};