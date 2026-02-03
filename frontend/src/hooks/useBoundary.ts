import L from "leaflet";
import nepalBoundary from "@/data/nepalBoundary.json";

export function useNepalBoundary(map: L.Map) {
  // 1️⃣ Draw Nepal boundary
  const nepalLayer = L.geoJSON(nepalBoundary as any, {
    interactive: false,
    style: {
      color: "#c62828",
      weight: 2,
      fillOpacity: 0
    }
  }).addTo(map);

  // 2️⃣ Fit & lock bounds
  const bounds = nepalLayer.getBounds();
  map.fitBounds(bounds);
  map.setMaxBounds(bounds);
  map.options.maxBoundsViscosity = 1.0;

  map.on("drag", () => {
    map.panInsideBounds(bounds, { animate: false });
  });

  // 3️⃣ Build MASK (world – Nepal)
  const world: L.LatLngExpression[] = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180],
    [-90, -180]
  ];

  // Extract outer ring from GeoJSON (lon,lat → lat,lon)
  const nepalCoords =
    (nepalBoundary as any).features[0].geometry.coordinates[0][0]
      .map(([lng, lat]: [number, number]) => [lat, lng]);

  const maskLayer = L.polygon(
    [
      world,
      nepalCoords.reverse() // IMPORTANT: hole must be reversed
    ],
    {
      stroke: false,
      fillColor: "#000",
      fillOpacity: 0.55,
      interactive: false
    }
  ).addTo(map);

  // 4️⃣ Ensure mask is always on top
  maskLayer.bringToFront();

  // Cleanup (React-safe)
  return () => {
    map.removeLayer(nepalLayer);
    map.removeLayer(maskLayer);
    map.off("drag");
  };
}
