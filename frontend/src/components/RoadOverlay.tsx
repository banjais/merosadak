// components/RoadOverlay.tsx
import { useEffect, useState, useMemo } from "react";
import { useMap, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { apiFetch } from "../api";

interface RoadSegment {
  id: string;
  name: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  status: string;
  properties: {
    road_refno?: string;
    road_name?: string;
    incidentDistrict?: string;
    incidentPlace?: string;
    chainage?: string;
    incidentStarted?: string;
    estimatedRestoration?: string;
    resumedDate?: string;
    blockedHours?: string;
    contactPerson?: string;
    restorationEfforts?: string;
    remarks?: string;
    status?: string;
    reportDate?: string;
    div_name?: string;
  };
}

interface RoadOverlayProps {
  isVisible?: boolean;
  filters?: {
    blocked: boolean;
    oneway: boolean;
    resumed: boolean;
  };
}

export const RoadOverlay: React.FC<RoadOverlayProps> = ({
  isVisible = true,
  filters = { blocked: true, oneway: true, resumed: true },
}) => {
  const map = useMap();
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoads = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiFetch<any>("/roads/all");
        setRoads(data.merged || []);
      } catch (err) {
        console.error("[RoadOverlay] Failed to fetch roads:", err);
        setError("Failed to load road data");
      } finally {
        setIsLoading(false);
      }
    };

    if (isVisible) {
      fetchRoads();
    }
  }, [isVisible]);

  const getStatusColor = (status: string): string => {
    const s = status?.toLowerCase() || "";
    if (s.includes("block")) return "#dc2626"; // Red
    if (s.includes("one")) return "#f59e0b";   // Orange
    return "#16a34a";                          // Green
  };

  const filteredRoads = useMemo(() => {
    if (!isVisible || !roads.length) return [];

    return roads
      .filter((road) => {
        if (!road.geometry?.coordinates || road.geometry.type !== "LineString") {
          return false;
        }

        const status = (
          road.status ||
          road.properties?.status ||
          ""
        ).toLowerCase();

        if (status.includes("block") && !filters.blocked) return false;
        if (status.includes("one") && !filters.oneway) return false;
        if (!status.includes("block") && !status.includes("one") && !filters.resumed) {
          return false;
        }

        return true;
      })
      .map((road) => {
        try {
          const latlngs: [number, number][] = road.geometry.coordinates.map(
            (coord) => [coord[1], coord[0]] as [number, number]
          );

          const statusText = road.status || road.properties?.status || "Unknown";
          const color = getStatusColor(statusText);
          const roadName =
            road.properties?.road_name ||
            road.properties?.road_refno ||
            road.name ||
            "Unknown Road";

          return {
            id: road.id,
            latlngs,
            color,
            weight: 4,
            opacity: 0.85,
            roadName,
            statusText,
            properties: road.properties,
          };
        } catch (error) {
          console.error('Error processing road segment:', road.id, error);
          return null;
        }
      }).filter(Boolean)
  }, [roads, isVisible, filters]);

  if (!isVisible || isLoading) {
    return null;
  }

  if (error) {
    console.warn(error);
    return null;
  }

  return (
    <>
      {filteredRoads.map((road) => (
        <Polyline
          key={road.id}
          positions={road.latlngs}
          pathOptions={{
            color: road.color,
            weight: road.weight,
            opacity: road.opacity,
          }}
        >
          <Popup>
            <div className="text-xs min-w-[200px] max-w-[280px]">
              <strong className="block mb-1">{road.roadName}</strong>

              <div
                className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold mb-2"
                style={{
                  backgroundColor: road.color + "20",
                  color: road.color,
                }}
              >
                {road.statusText}
              </div>

              {road.properties.road_refno && (
                <div className="text-[10px] text-gray-500 mb-1">
                  Ref: {road.properties.road_refno}
                </div>
              )}

              {road.properties.incidentDistrict && (
                <div>District: {road.properties.incidentDistrict}</div>
              )}
              {road.properties.incidentPlace && (
                <div>Place: {road.properties.incidentPlace}</div>
              )}
              {road.properties.chainage && (
                <div>Chainage: {road.properties.chainage}</div>
              )}
              {road.properties.incidentStarted && (
                <div>Started: {road.properties.incidentStarted}</div>
              )}
              {road.properties.estimatedRestoration && (
                <div>Est. Restoration: {road.properties.estimatedRestoration}</div>
              )}
              {road.properties.resumedDate && (
                <div>Resumed: {road.properties.resumedDate}</div>
              )}
              {road.properties.blockedHours && (
                <div>Blocked Hours: {road.properties.blockedHours}</div>
              )}
              {road.properties.contactPerson && (
                <div>Contact: {road.properties.contactPerson}</div>
              )}
              {road.properties.remarks && (
                <div className="mt-2 text-[10px] italic text-gray-600">
                  "{road.properties.remarks}"
                </div>
              )}
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
};