import React, { useEffect, useState } from "react";
import { GeoJSON, useMapEvents } from "react-leaflet";
import { apiFetch } from "../api";

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

/**
 * 🇳🇵 BoundaryOverlay: Implements the "Spotlight" effect for Nepal.
 * 1. Renders an inverted mask (World minus Nepal) to dim surrounding countries.
 * 2. Renders sharp district lines inside Nepal for administrative context.
 */
const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const [districtData, setDistrictData] = useState<any>(null);
  const [maskData, setMaskData] = useState<any>(null);
  const [currentZoom, setCurrentZoom] = useState(8);

  // Monitor zoom level to optimize rendering
  useMapEvents({
    zoomend: (e) => setCurrentZoom(e.target.getZoom()),
  });

  useEffect(() => {
    // 1. Fetch District Boundaries for the sharp lines
    const fetchDistricts = async () => {
      try {
        const res = await apiFetch("/v1/boundary/districts");
        if (res.data) setDistrictData(res.data);
      } catch (err) {
        console.error("Failed to load district boundaries", err);
      }
    };

    // 2. Fetch the Pre-generated Inverted Nepal Mask
    const fetchMask = async () => {
      try {
        const res = await apiFetch("/v1/boundary/mask");
        if (res.data) setMaskData(res.data);
      } catch (err) {
        console.error("Failed to load map mask", err);
      }
    };

    fetchDistricts();
    fetchMask();
  }, []);

  return (
    <>
      {/* 🌑 The Mask: Dims/Blurs the world OUTSIDE Nepal */}
      {maskData && (
        <GeoJSON
          data={maskData}
          interactive={false}
          style={{
            fillColor: isDarkMode ? "#0f172a" : "#64748b",
            fillOpacity: 0.85,
            stroke: false,
          }}
        />
      )}

      {/* 🧭 The Lines: Only visible at zoom > 9 for performance */}
      {districtData && currentZoom > 9 && (
        <GeoJSON
          data={districtData}
          interactive={true}
          style={{
            color: isDarkMode ? "#6366f1" : "#4f46e5",
            weight: 1.2,
            fillOpacity: 0,
          }}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.dist_name) {
              layer.bindPopup(`<strong>${feature.properties.dist_name}</strong> District`);
            }
          }}
        />
      )}
    </>
  );
};

export default BoundaryOverlay;