// src/components/BoundaryOverlay.tsx
import React, { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

interface BoundaryOverlayProps {
  isDarkMode: boolean;
  geoJsonUrl?: string; // optional, default to light boundary file
}

export const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({
  isDarkMode,
  geoJsonUrl = '/data/boundary.geojson', // your light file path
}) => {
  const [boundaryData, setBoundaryData] = useState<any>(null);
  const map = useMap();

  useEffect(() => {
    fetch(geoJsonUrl)
      .then(res => res.json())
      .then(data => setBoundaryData(data))
      .catch(err => console.error('Failed to load boundary:', err));
  }, [geoJsonUrl]);

  const getStyle = () => ({
    color: isDarkMode ? '#FFD700' : '#444', // boundary stroke color
    weight: 2,
    fillOpacity: 0.05,
    dashArray: '4',
  });

  if (!boundaryData) return null;

  return (
    <GeoJSON
      data={boundaryData}
      style={getStyle()}
      onEachFeature={(feature, layer) => {
        if (feature.properties && feature.properties.name) {
          layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
        }
      }}
    />
  );
};