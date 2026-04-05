// src/components/RoadOverlay.tsx
import { useEffect, useState, useMemo } from "react";
import { useMap, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { apiFetch } from "../api";
import { TravelIncident } from "../types";

interface RoadSegment {
  id: string;
  name?: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  status?: string;
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

  // Fetch roads data
  useEffect(() => {
    const fetchRoads = async () => {
      if (!isVisible) {
        setRoads([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const data = await apiFetch<any>("/roads/all");

        // Handle different possible response formats safely
        let roadData: RoadSegment[] = [];
        if (data?.merged && Array.isArray(data.merged)) {
          roadData = data.merged;
        } else if (Array.isArray(data)) {
          roadData = data;
        } else if (data?.data && Array.isArray(data.data)) {
          roadData = data.data;
        }

        setRoads(roadData);
      } catch (err: any) {
        console.error("[RoadOverlay] Failed to fetch roads:", err);
        setError(err.message || "Failed to load road data");
        setRoads([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoads();
  }, [isVisible]);

  // Determine line color based on status
  const getStatusColor = (status: string = ""): string => {
    const s = status.toLowerCase();
    if (s.includes("block") || s.includes("blocked")) return "#ef4444"; // Red
    if (s.includes("one") || s.includes("oneway") || s.includes("single")) return "#f59e0b"; // Orange
    return "#16a34a"; // Green (clear/resumed)
  };

  // Process and filter roads
  const filteredRoads = useMemo(() => {
    if (!isVisible || roads.length === 0) return [];

    return roads
      .filter((road) => {
        // Must have valid LineString geometry
        if (!road.geometry?.coordinates || road.geometry.type !== "LineString") {
          return false;
        }

        const status = (
          road.status ||
          road.properties?.status ||
          ""
        ).toLowerCase();

        // Apply filters
        if (status.includes("block") && !filters.blocked) return false;
        if ((status.includes("one") || status.includes("oneway")) && !filters.oneway) return false;
        if (!status.includes("block") && !status.includes("one") && !filters.resumed) {
          return false;
        }

        return true;
      })
      .map((road) => {
        try {
          // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
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
            id: road.id || `road-${Math.random().toString(36).substr(2, 9)}`,
            latlngs,
            color,
            weight: 5.5,
            opacity: 0.92,
            roadName,
            statusText,
            properties: road.properties || {},
          };
        } catch (err) {
          console.error("Error processing road segment:", road.id, err);
          return null;
        }
      })
      .filter(Boolean) as any[];
  }, [roads, isVisible, filters]);

  // Do not render anything while loading or if hidden
  if (!isVisible || isLoading) {
    return null;
  }

  if (error) {
    console.warn("[RoadOverlay]", error);
    return null;
  }

  return (
    <>
      {filteredRoads.map((road: any) => (
        <Polyline
          key={road.id}
          positions={road.latlngs}
          pathOptions={{
            color: road.color,
            weight: road.weight,
            opacity: road.opacity,
            lineCap: "round",
            lineJoin: "round",
          }}
        >
          <Popup>
            <div className="text-xs min-w-[220px] max-w-[300px] p-1 leading-relaxed">
              <strong className="block text-base mb-2 text-slate-900 dark:text-white">
                {road.roadName}
              </strong>

              <div
                className="inline-block px-3 py-1 rounded text-xs font-bold mb-3"
                style={{
                  backgroundColor: road.color + "20",
                  color: road.color,
                }}
              >
                {road.statusText}
              </div>

              {road.properties.road_refno && (
                <div className="text-[10px] text-slate-500 mb-1">
                  Ref: <span className="font-mono">{road.properties.road_refno}</span>
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
                <div className="text-emerald-600">Resumed: {road.properties.resumedDate}</div>
              )}
              {road.properties.blockedHours && (
                <div>Blocked Hours: {road.properties.blockedHours}h</div>
              )}
              {road.properties.contactPerson && (
                <div>Contact: {road.properties.contactPerson}</div>
              )}
              {road.properties.remarks && (
                <div className="mt-3 text-[10px] italic text-slate-600 border-t pt-2">
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