// src/components/HighwayHighlightOverlay.tsx
import { useEffect, useState, useMemo } from "react";
import { useMap, Polyline } from "react-leaflet";
import { useHighways, useHighway } from "../hooks/useHighways";
import type { TravelIncident } from "../types";

interface HighwayHighlightOverlayProps {
  incidents: TravelIncident[];
  isVisible?: boolean;
  selectedHighwayCode?: string; // Specific highway to highlight
}

// Sub-component to render a single highway's polylines
function HighwayPolylines({ code, isHighlighted }: { code: string; isHighlighted: boolean }) {
  const { data: highwayData, isLoading, error } = useHighway(code);

  if (isLoading || error || !highwayData?.features) {
    return null;
  }

  return (
    <>
      {highwayData.features.map((feature: any, index: number) => {
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
              color: isHighlighted ? "#ff6b6b" : "#0062a2",
              weight: isHighlighted ? 6 : 3,
              opacity: isHighlighted ? 0.9 : 0.6,
              lineCap: "round",
              lineJoin: "round",
              dashArray: isHighlighted ? "10, 10" : undefined,
            }}
          />
        );
      })}
    </>
  );
}

export const HighwayHighlightOverlay: React.FC<HighwayHighlightOverlayProps> = ({
  incidents,
  isVisible = true,
  selectedHighwayCode,
}) => {
  const map = useMap();
  const { highwayList } = useHighways();

  // Determine which highways to show
  const highwaysToShow = useMemo(() => {
    if (selectedHighwayCode) {
      // Show only the selected highway
      return new Set([selectedHighwayCode]);
    }

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

    return highwayCodes;
  }, [incidents, highwayList, selectedHighwayCode]);

  if (!isVisible || highwaysToShow.size === 0) {
    return null;
  }

  return (
    <>
      {Array.from(highwaysToShow).map(code => (
        <HighwayPolylines
          key={code}
          code={code}
          isHighlighted={!!selectedHighwayCode || incidents.length > 0}
        />
      ))}
    </>
  );
};
