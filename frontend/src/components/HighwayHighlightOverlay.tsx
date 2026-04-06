// src/components/HighwayHighlightOverlay.tsx
import { useEffect, useState } from "react";
import { useMap, Polyline } from "react-leaflet";
import { useHighway, useHighways } from "../hooks/useHighways";
import type { TravelIncident } from "../types";

interface HighwayHighlightOverlayProps {
  incidents: TravelIncident[];
  isVisible?: boolean;
}

export const HighwayHighlightOverlay: React.FC<HighwayHighlightOverlayProps> = ({
  incidents,
  isVisible = true,
}) => {
  const map = useMap();
  const { highwayList } = useHighways();
  const [highlightedHighways, setHighlightedHighways] = useState<Set<string>>(new Set());

  // Collect unique highway codes from incidents or show all highways
  useEffect(() => {
    const highwayCodes = new Set<string>();

    if (incidents.length === 0) {
      // Show all highways when no incidents provided
      highwayList.forEach(highway => highwayCodes.add(highway.code));
    } else {
      // Show only highways with incidents
      incidents.forEach(incident => {
        if (incident.road_refno) {
          highwayCodes.add(incident.road_refno);
        }
      });
    }

    setHighlightedHighways(highwayCodes);
  }, [incidents, highwayList]);

  // Render each highlighted highway
  const renderHighway = (code: string) => {
    const { data: highwayData, isLoading, error } = useHighway(code);

    if (isLoading || error || !highwayData?.features) {
      return null;
    }

    return highwayData.features.map((feature: any, index: number) => {
      if (feature.geometry?.type !== 'LineString' || !feature.geometry.coordinates) {
        return null;
      }

      // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
      const latlngs: [number, number][] = feature.geometry.coordinates.map(
        (coord: number[]) => [coord[1], coord[0]] as [number, number]
      );

      return (
        <Polyline
          key={`${code}-${index}`}
          positions={latlngs}
          pathOptions={{
            color: "#ff6b6b", // Highlight color for incidents
            weight: 6,
            opacity: 0.8,
            lineCap: "round",
            lineJoin: "round",
            dashArray: "10, 10", // Dashed line to indicate highlight
          }}
        />
      );
    });
  };

  if (!isVisible || highlightedHighways.size === 0) {
    return null;
  }

  return (
    <>
      {Array.from(highlightedHighways).map(code => renderHighway(code))}
    </>
  );
};