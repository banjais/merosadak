import { useEffect, useMemo } from 'react';
import { useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Position } from 'geojson';

interface Props {
  boundary: FeatureCollection;
  isDarkMode?: boolean;
}

export const NepalBounds: React.FC<Props> = ({ boundary, isDarkMode }) => {
  const map = useMap();

  useEffect(() => {
    if (boundary && boundary.features.length > 0) {
      const geoLayer = new L.GeoJSON(boundary);
      map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
      
      // Also set strict max bounds to prevent panning too far away
      map.setMaxBounds(geoLayer.getBounds().pad(0.5));
      map.setMinZoom(6);
    }
  }, [boundary, map]);

  // Construct the "Inverse Mask" to hide everything OUTSIDE Nepal
  const maskPositions = useMemo(() => {
    if (!boundary || !boundary.features) return null;

    // 1. World Bounds (The "Solid" part)
    // Note: Leaflet uses [lat, lng], GeoJSON uses [lng, lat]
    const worldBounds: [number, number][] = [
      [90, -180],
      [90, 180],
      [-90, 180],
      [-90, -180]
    ];

    // 2. Holes (Nepal)
    const holes: [number, number][][] = [];

    boundary.features.forEach(feature => {
      const geometry = feature.geometry as Geometry;
      
      const addPolygonHole = (coords: Position[][]) => {
        // GeoJSON Polygon linear rings: [OuterRing, InnerRing1, ...]
        // We only care about the OuterRing of the country shape to make it a "hole" in our world mask
        const outerRing = coords[0]; 
        const latLngs = outerRing.map(p => [p[1], p[0]] as [number, number]);
        holes.push(latLngs);
      };

      if (geometry.type === 'Polygon') {
        addPolygonHole(geometry.coordinates as Position[][]);
      } else if (geometry.type === 'MultiPolygon') {
        (geometry.coordinates as Position[][][]).forEach(polygonCoords => {
          addPolygonHole(polygonCoords);
        });
      }
    });

    // Leaflet Polygon structure for holes: [OuterPoly, Hole1, Hole2, ...]
    return [worldBounds, ...holes];
  }, [boundary]);

  if (!maskPositions) return null;

  return (
    <Polygon
      positions={maskPositions as any} // 'any' cast avoids complex Leaflet type mismatch for holes
      pathOptions={{
        color: 'transparent',    // No border lines for the mask itself
        fillColor: isDarkMode ? '#020617' : '#f8fafc', // Match bg-slate-950 or bg-slate-50
        fillOpacity: 1,          // Solid fill to hide the world
        interactive: false       // Let clicks pass through (though tiles underneath are hidden)
      }}
    />
  );
};
