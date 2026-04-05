import { useEffect, useMemo } from "react";
import { useMap, Polygon } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry, Position } from "geojson";

interface Props {
  boundary: FeatureCollection | null;
  isDarkMode?: boolean;
}

// Hardcoded Nepal boundary fallback — ensures mask ALWAYS renders even if API fails
// Coordinates: [lng, lat] from GeoJSON, converted to [lat, lng] for Leaflet
const FALLBACK_NEPAL_BOUNDARY: [number, number][] = [
  [28.79447, 80.088425],
  [28.698523, 80.057978],
  [28.438941, 80.229682],
  [28.320982, 80.184293],
  [28.24671, 80.369868],
  [29.729865, 80.476721],
  [29.824482, 80.603891],
  [29.769724, 80.79188],
  [28.416095, 81.057203],
  [30.183481, 81.111256],
  [30.106566, 81.252678],
  [30.422717, 81.525804],
  [30.944466, 81.746277],
  [31.04918, 81.903738],
  [31.013981, 82.155929],
  [30.115268, 82.327513],
  [29.865519, 82.594532],
  [27.364506, 83.304249],
  [29.463732, 83.337115],
  [29.320226, 83.898993],
  [28.839894, 84.23458],
  [28.642774, 85.011638],
  [26.726198, 85.251779],
  [28.203576, 85.82332],
  [26.630985, 86.024393],
  [27.974262, 86.954517],
  [26.397898, 87.227472],
  [27.445819, 88.043133],
  [26.414615, 88.060238],
  [27.876542, 88.120441],
  [26.810405, 88.174804],
  [27.446816, 88.385594],
  [27.518516, 88.529352],
  [27.385277, 88.569309],
  [27.199795, 88.671524],
  [27.299047, 88.835443],
  [27.774242, 88.920292],
  [27.839926, 89.020149],
  [27.795468, 89.422326],
  [27.59918, 89.703532],
  [27.399136, 90.015594],
  [27.114516, 90.374661],
  [26.891461, 90.672535],
  [26.762497, 90.747471],
  [26.537875, 90.820708],
  [26.39741, 90.881657],
  [26.807457, 91.259504],
  [26.912409, 91.467983],
  [26.841446, 91.798328],
  [26.763126, 91.878685],
  [26.651028, 92.033039],
  [26.412165, 92.103101],
  [26.283986, 92.380554],
  [26.176758, 92.676081],
  [25.768463, 92.814203],
  [25.26953, 92.900342],
  [25.132727, 92.973818],
  [24.885408, 92.973818],
  [24.578532, 92.790589],
  [24.394519, 92.503222],
  [24.30169, 92.172291],
  [24.130257, 91.917536],
  [24.07867, 91.703817],
  [24.221587, 91.271028],
  [24.359558, 91.170906],
  [24.724516, 91.467983],
  [24.976106, 91.549927],
  [25.144176, 91.918789],
  [25.425918, 92.025733],
  [25.98359, 92.103101],
  [26.091998, 91.723348],
  [26.252345, 91.494976],
  [26.396397, 91.260772],
  [26.567829, 91.256958],
  [26.80984, 91.021091],
  [26.946685, 90.751164],
  [27.089619, 90.550045],
  [27.265022, 90.214458],
  [27.411454, 90.016571],
  [27.531601, 89.626753],
  [27.578566, 89.363185],
  [27.611765, 89.118752],
  [27.774242, 88.890379],
  [27.774242, 88.671524],
  [27.912213, 88.435657],
  [27.998199, 88.264044],
  [28.088571, 88.056819],
  [27.879532, 87.227472],
  [27.699531, 87.064807],
  [27.59918, 86.919309],
  [27.45074, 86.756643],
  [27.265022, 86.632852],
  [27.04851, 86.503691],
  [26.745826, 86.242509],
  [26.561107, 85.987754],
  [26.405963, 85.687494],
  [26.726198, 85.251779],
  [27.234901, 84.675018],
  [28.839894, 84.23458],
  [29.320226, 83.898993],
  [29.463732, 83.337115],
  [30.115268, 82.327513],
  [30.422717, 81.525804],
  [30.183481, 81.111256],
  [29.729865, 80.476721],
  [28.79447, 80.088425],
];

const WORLD_BOUNDS: [number, number][] = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180],
];

export const NepalBounds: React.FC<Props> = ({ boundary, isDarkMode }) => {
  const map = useMap();

  useEffect(() => {
    try {
      if (boundary && boundary.features && boundary.features.length > 0) {
        const geoLayer = new L.GeoJSON(boundary);
        // Only constrain bounds — do NOT fitBounds here, GeoAutoCenter handles centering to user's city
        map.setMaxBounds(geoLayer.getBounds());
        map.setMinZoom(6);
      } else {
        // Fallback: use hardcoded Nepal bounds for map constraints
        const fallbackLayer = new L.GeoJSON({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [FALLBACK_NEPAL_BOUNDARY.map(([lat, lng]) => [lng, lat])],
            },
          }],
        } as any);
        map.setMaxBounds(fallbackLayer.getBounds());
        map.setMinZoom(6);
      }
    } catch (error) {
      console.error('Error setting map bounds:', error);
      // Fallback to hardcoded bounds
      const fallbackLayer = new L.GeoJSON({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [FALLBACK_NEPAL_BOUNDARY.map(([lat, lng]) => [lng, lat])],
          },
        }],
      } as any);
      map.setMaxBounds(fallbackLayer.getBounds());
      map.setMinZoom(6);
    }
  }, [boundary, map]);

  const maskPositions = useMemo(() => {
    const holes: [number, number][][] = [];

    // Use API boundary data if available, otherwise use hardcoded fallback
    if (boundary && boundary.features && boundary.features.length > 0) {
      boundary.features.forEach((feature) => {
        const geometry = feature.geometry as Geometry;

        const addPolygonHole = (coords: Position[][]) => {
          const outerRing = coords[0];
          const latLngs = outerRing.map((p) => [p[1], p[0]] as [number, number]);
          holes.push(latLngs);
        };

        if (geometry.type === "Polygon") addPolygonHole(geometry.coordinates as Position[][]);
        else if (geometry.type === "MultiPolygon")
          (geometry.coordinates as Position[][][]).forEach((poly) => addPolygonHole(poly));
      });
    } else {
      // Fallback: always use hardcoded Nepal boundary so mask renders
      holes.push(FALLBACK_NEPAL_BOUNDARY);
    }

    return [WORLD_BOUNDS, ...holes];
  }, [boundary]);

  return (
    <Polygon
      positions={maskPositions as any}
      pathOptions={{
        color: "transparent",
        fillColor: isDarkMode ? "#0d1117" : "#f0f0f0",
        fillOpacity: 1.0,
        interactive: false,
        stroke: false,
      }}
    />
  );
};
