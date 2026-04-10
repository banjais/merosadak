import React from "react";
import { Marker } from "react-leaflet";
import { L } from "../lib/leaflet";

interface MapLabelProps {
  position: [number, number];
  text: string;
  fontSize?: number;
  color?: string;
}

export const MapLabel: React.FC<MapLabelProps> = ({
  position,
  text,
  fontSize = 13,
  color = "#374151",
}) => {
  const icon = L.divIcon({
    className: "map-custom-label",
    html: `<div style="
      font-size:${fontSize}px;
      font-weight:800;
      color:${color};
      text-transform:uppercase;
      letter-spacing:0.15em;
      white-space:nowrap;
      pointer-events:none;
      text-shadow:0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7);
      font-family:system-ui,-apple-system,sans-serif;
    ">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  return <Marker position={position} icon={icon} interactive={false} />;
};
