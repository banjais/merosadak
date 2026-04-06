// src/components/BoundaryOverlay.tsx
import { useEffect, useMemo } from "react";
import { useMap, GeoJSON } from "react-leaflet";
import { useBoundary } from "../hooks/useBoundary";
import L from "leaflet";

interface BoundaryOverlayProps {
  isDarkMode?: boolean;
}

// World bounds for creating the inverted polygon
const WORLD_BOUNDS = [[-90, -180], [90, 180]];

export const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({
  isDarkMode = false,
}) => {
  const map = useMap();
  const { boundaries, loading, error } = useBoundary();

  // Style for the outside mask - dark/semi-transparent to hide outside areas
  const getOutsideMaskStyle = () => {
    return {
      fillOpacity: 0.7,
      fillColor: isDarkMode ? '#0a0a0a' : '#ffffff',
      weight: 0,
      color: 'transparent',
      opacity: 0,
    };
  };

  // Style for Nepal boundary outline
  const getNepalOutlineStyle = () => {
    return {
      fillOpacity: 0,
      weight: 2,
      color: isDarkMode ? '#4fc3f7' : '#0062a2',
      opacity: 0.8,
      dashArray: '',
    };
  };

  // Create inverted polygon GeoJSON (world minus Nepal)
  const outsideMaskGeoJSON = useMemo(() => {
    if (!boundaries.nepal) return null;

    try {
      // Get Nepal's coordinates from the boundary data
      const nepalFeatures = boundaries.nepal.features;
      if (!nepalFeatures || nepalFeatures.length === 0) return null;

      // Extract Nepal's coordinates
      const nepalCoords = nepalFeatures.map((feature: any) => {
        if (feature.geometry && feature.geometry.type === 'Polygon') {
          return feature.geometry.coordinates;
        } else if (feature.geometry && feature.geometry.type === 'MultiPolygon') {
          return feature.geometry.coordinates;
        }
        return null;
      }).filter(Boolean);

      if (nepalCoords.length === 0) return null;

      // Create an inverted polygon: world rectangle with Nepal holes
      const invertedPolygons: any[] = [];

      for (const nepalPolygon of nepalCoords) {
        if (Array.isArray(nepalPolygon)) {
          // For each Nepal polygon, create a "hole" in the world rectangle
          // The first element is the outer ring (world), the rest are holes (Nepal)
          invertedPolygons.push({
            type: 'Polygon',
            coordinates: [
              // Outer ring: world bounds (clockwise)
              [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]],
              // Inner ring: Nepal boundary (counter-clockwise to create hole)
              ...nepalPolygon.map((ring: any[]) => 
                ring.map((coord: number[]) => [coord[1], coord[0]]).reverse()
              ),
            ],
          });
        }
      }

      return {
        type: 'FeatureCollection',
        features: invertedPolygons.map((polygon: any) => ({
          type: 'Feature',
          geometry: polygon,
          properties: { boundaryType: 'outside-mask' },
        })),
      };
    } catch (e) {
      console.error('[BoundaryOverlay] Error creating outside mask:', e);
      return null;
    }
  }, [boundaries.nepal]);

  // Render boundary layers
  useEffect(() => {
    if (loading || error) return;

    // Clear existing boundary layers
    map.eachLayer((layer: any) => {
      if (layer.options?.boundaryType === 'outside-mask' || layer.options?.boundaryType === 'nepal-outline') {
        map.removeLayer(layer);
      }
    });

    // Add outside mask layer
    if (outsideMaskGeoJSON) {
      const maskLayer = new L.GeoJSON(outsideMaskGeoJSON as any, {
        style: getOutsideMaskStyle(),
        boundaryType: 'outside-mask',
        interactive: false,
      });
      maskLayer.addTo(map);
      // Bring to bottom to ensure it's behind other layers
      maskLayer.bringToBack();
    }

    // Add Nepal outline for visual reference
    if (boundaries.nepal) {
      const outlineLayer = new L.GeoJSON(boundaries.nepal as any, {
        style: getNepalOutlineStyle(),
        boundaryType: 'nepal-outline',
        interactive: false,
      });
      outlineLayer.addTo(map);
      outlineLayer.bringToFront();
    }

    // Cleanup function
    return () => {
      map.eachLayer((layer: any) => {
        if (layer.options?.boundaryType === 'outside-mask' || layer.options?.boundaryType === 'nepal-outline') {
          map.removeLayer(layer);
        }
      });
    };
  }, [boundaries, outsideMaskGeoJSON, isDarkMode, map, loading, error]);

  return null;
};