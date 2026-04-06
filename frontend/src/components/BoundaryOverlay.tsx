// src/components/BoundaryOverlay.tsx
import React, { useEffect, useState } from 'react';
import { GeoJSON, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

interface BoundaryOverlayProps {
  isDarkMode: boolean;
}

export const BoundaryOverlay: React.FC<BoundaryOverlayProps> = ({ isDarkMode }) => {
  const [boundaryData, setBoundaryData] = useState<any>(null);
  const map = useMap();

  useEffect(() => {
    fetch('/data/boundary.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load boundary.geojson');
        return res.json();
      })
      .then((data) => setBoundaryData(data))
      .catch((err) => console.error(err));
  }, []);

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const name = feature.properties?.name || feature.properties?.district || 'Unknown';
    layer.bindTooltip(name, { sticky: true });

    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        const target = e.target;
        target.setStyle({
          weight: 3,
          color: isDarkMode ? '#FFD700' : '#FF4500',
          fillOpacity: 0.1,
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          target.bringToFront();
        }
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        const target = e.target;
        target.setStyle({
          weight: 1,
          color: isDarkMode ? '#888' : '#555',
          fillOpacity: 0,
        });
      },
    });
  };

  const geoStyle = {
    color: isDarkMode ? '#888' : '#555',
    weight: 1,
    fillColor: isDarkMode ? '#333' : '#f5f5f5',
    fillOpacity: 0,
  };

  if (!boundaryData) return null;

  return <GeoJSON data={boundaryData} style={geoStyle} onEachFeature={onEachFeature} />;
};