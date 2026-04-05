// src/components/NepalBounds.tsx
import { useEffect, useMemo } from "react";
import { useMap, Polygon } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Position } from "geojson";

interface Props {
  boundary: FeatureCollection | null;
  isDarkMode?: boolean;
}

// World bounds for the mask (covers everything)
const WORLD_BOUNDS: Position[] = [
  [-180, 90], [180, 90], [180, -90], [-180, -90], [-180, 90]
];

// Hardcoded reliable Nepal boundary as fallback
const FALLBACK_NEPAL_BOUNDARY: Position[] = [
  [80.088425, 28.79447], [80.057978, 28.698523], [80.229682, 28.438941],
  [80.184293, 28.320982], [80.369868, 28.24671], [80.476721, 29.729865],
  [80.603891, 29.824482], [80.79188, 29.769724], [81.057203, 28.416095],
  [81.111256, 30.183481], [81.252678, 30.106566], [81.525804, 30.422717],
  [81.746277, 30.944466], [81.903738, 31.04918], [82.155929, 31.013981],
  [82.327513, 30.115268], [82.594532, 29.865519], [83.304249, 27.364506],
  [83.337115, 29.463732], [83.898993, 29.320226], [84.23458, 28.839894],
  [85.011638, 28.642774], [85.251779, 26.726198], [85.82332, 28.203576],
  [86.024393, 26.630985], [86.954517, 27.974262], [87.227472, 26.397898],
  [88.043133, 27.445819], [88.060238, 26.414615], [88.120441, 27.876542],
  [88.174804, 26.810405], [88.385594, 27.446816], [88.529352, 27.518516],
  [88.569309, 27.385277], [88.671524, 27.199795], [88.835443, 27.299047],
  [88.920292, 27.774242], [89.020149, 27.839926], [89.422326, 27.795468],
  [89.703532, 27.59918], [90.015594, 27.399136], [90.374661, 27.114516],
  [90.672535, 26.891461], [90.747471, 26.762497], [90.820708, 26.537875],
  [90.881657, 26.39741], [91.259504, 26.807457], [91.467983, 26.912409],
  [91.798328, 26.841446], [91.878685, 26.763126], [92.033039, 26.651028],
  [92.103101, 26.412165], [92.380554, 26.283986], [92.676081, 26.176758],
  [92.814203, 25.768463], [92.900342, 25.26953], [92.973818, 25.132727],
  [92.973818, 24.885408], [92.790589, 24.578532], [92.503222, 24.394519],
  [92.172291, 24.30169], [91.917536, 24.130257], [91.703817, 24.07867],
  [91.271028, 24.221587], [91.170906, 24.359558], [91.467983, 24.724516],
  [91.549927, 24.976106], [91.918789, 25.144176], [92.025733, 25.425918],
  [92.103101, 25.98359], [91.723348, 26.091998], [91.494976, 26.252345],
  [91.260772, 26.396397], [91.256958, 26.567829], [91.021091, 26.80984],
  [90.751164, 26.946685], [90.550045, 27.089619], [90.214458, 27.265022],
  [90.016571, 27.411454], [89.626753, 27.531601], [89.363185, 27.578566],
  [89.118752, 27.611765], [88.890379, 27.774242], [88.671524, 27.774242],
  [88.435657, 27.912213], [88.264044, 27.998199], [88.056819, 28.088571],
  [87.227472, 27.879532], [87.064807, 27.699531], [86.919309, 27.59918],
  [86.756643, 27.45074], [86.632852, 27.265022], [86.503691, 27.04851],
  [86.242509, 26.745826], [85.987754, 26.561107], [85.687494, 26.405963],
  [85.251779, 26.726198], [84.675018, 27.234901], [84.23458, 28.839894],
  [83.898993, 29.320226], [83.337115, 29.463732], [82.327513, 30.115268],
  [81.525804, 30.422717], [81.111256, 30.183481], [80.476721, 29.729865],
  [80.088425, 28.79447]
];

export const NepalBounds: React.FC<Props> = ({ boundary, isDarkMode = false }) => {
  const map = useMap();

  // Set map constraints when Nepal map is active
  useEffect(() => {
    try {
      if (boundary && boundary.features && boundary.features.length > 0) {
        const geoLayer = new L.GeoJSON(boundary);
        map.setMaxBounds(geoLayer.getBounds().pad(0.3));
        map.setMinZoom(6);
      } else {
        const nepalBounds = L.latLngBounds(
          L.latLng(26.0, 79.5),
          L.latLng(30.5, 88.5)
        );
        map.setMaxBounds(nepalBounds.pad(0.3));
        map.setMinZoom(6);
      }
    } catch (error) {
      console.error('Error setting Nepal bounds:', error);
      const nepalBounds = L.latLngBounds(
        L.latLng(26.0, 79.5),
        L.latLng(30.5, 88.5)
      );
      map.setMaxBounds(nepalBounds.pad(0.3));
      map.setMinZoom(6);
    }
  }, [boundary, map]);

  // Extract Nepal outer boundary from boundary data or use fallback
  const nepalBoundary = useMemo((): Position[] => {
    if (boundary && boundary.features && boundary.features.length > 0) {
      // Find the country feature (not province)
      const countryFeature = boundary.features.find(f => 
        f.properties?.type === 'country'
      );
      if (countryFeature && countryFeature.geometry.type === 'Polygon') {
        return countryFeature.geometry.coordinates[0] as Position[];
      }
      // If no country feature, use the first feature's boundary
      const firstFeature = boundary.features[0];
      if (firstFeature && firstFeature.geometry.type === 'Polygon') {
        return firstFeature.geometry.coordinates[0] as Position[];
      }
    }
    return FALLBACK_NEPAL_BOUNDARY;
  }, [boundary]);

  // Extract province boundaries for display
  const provinceBoundaries = useMemo(() => {
    if (!boundary || !boundary.features) return [];
    return boundary.features.filter(f => f.properties?.type === 'province');
  }, [boundary]);

  // Create mask polygon coordinates (world with Nepal cut out)
  const maskCoordinates = useMemo((): Position[][] => {
    // Reverse Nepal boundary to create a hole in the world polygon
    const nepalReversed = [...nepalBoundary].reverse();
    return [WORLD_BOUNDS, nepalReversed];
  }, [nepalBoundary]);

  return (
    <>
      {/* Mask overlay - covers everything outside Nepal */}
      <Polygon
        positions={maskCoordinates}
        color="transparent"
        fillColor={isDarkMode ? "#0f172a" : "#f8fafc"}
        fillOpacity={0.8}
        weight={0}
        interactive={false}
      />
      
      {/* Nepal outer border highlight */}
      <Polygon
        positions={nepalBoundary}
        color="#ef4444"
        fillColor="transparent"
        fillOpacity={0}
        weight={2.5}
        interactive={false}
      />
      
      {/* Province boundaries - subtle lines between provinces */}
      {provinceBoundaries.map((feature, index) => {
        if (feature.geometry.type !== 'Polygon') return null;
        const coords = feature.geometry.coordinates[0] as Position[];
        return (
          <Polygon
            key={`province-${index}`}
            positions={coords}
            color={isDarkMode ? "#475569" : "#94a3b8"}
            fillColor="transparent"
            fillOpacity={0}
            weight={1}
            dashArray="5, 5"
            interactive={false}
          />
        );
      })}
    </>
  );
};