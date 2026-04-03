import { useEffect, useState, useMemo } from "react";
import { useMap } from "react-leaflet";
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

export const RoadOverlay: React.FC<RoadOverlayProps> = ({ isVisible = true, filters = { blocked: true, oneway: true, resumed: true } }) => {
  const map = useMap();
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoads = async () => {
      try {
        const data = await apiFetch<any>("/roads/all");
        const roadSegments = data.merged || [];
        setRoads(roadSegments);
      } catch (error) {
        console.error("[RoadOverlay] Failed to fetch roads:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoads();
  }, []);

  const getStatusColor = (status: string): string => {
    const s = status?.toLowerCase() || "";
    if (s.includes("block")) return "#dc2626"; // Red for Blocked
    if (s.includes("one")) return "#f59e0b"; // Orange for One-Lane
    return "#16a34a"; // Green for Resumed
  };

  const roadLayers = useMemo(() => {
    if (!isVisible || !roads.length) return null;

    return roads.map((road) => {
      if (!road.geometry?.coordinates || road.geometry.type !== "LineString") {
        return null;
      }

      // Filter based on status
      const status = (road.status || road.properties?.status || "").toLowerCase();
      if (status.includes("block") && !filters.blocked) return null;
      if (status.includes("one") && !filters.oneway) return null;
      if (!status.includes("block") && !status.includes("one") && !filters.resumed) return null;

      const latlngs: [number, number][] = road.geometry.coordinates.map(
        (coord) => [coord[1], coord[0]] as [number, number]
      );

      const color = getStatusColor(road.status || road.properties?.status || "");
      const roadName = road.properties?.road_name || road.properties?.road_refno || road.name || "Unknown Road";

      return (
        <L.Polyline
          key={road.id}
          positions={latlngs}
          pathOptions={{
            color,
            weight: 4,
            opacity: 0.8,
          }}
        >
          <L.Popup>
            <div style={{ fontSize: "12px", minWidth: "180px" }}>
              <strong>{roadName}</strong>
              {road.properties?.road_refno && <div style={{ color: "#666", fontSize: "10px" }}>Ref: {road.properties.road_refno}</div>}
              <div style={{ margin: "4px 0", padding: "2px 6px", borderRadius: "4px", display: "inline-block", background: color + "20", color, fontWeight: "bold" }}>
                {road.status || road.properties?.status || "Unknown"}
              </div>
              {road.properties?.incidentDistrict && <div>District: {road.properties.incidentDistrict}</div>}
              {road.properties?.incidentPlace && <div>Place: {road.properties.incidentPlace}</div>}
              {road.properties?.chainage && <div>Chainage: {road.properties.chainage}</div>}
              {road.properties?.incidentStarted && <div>Started: {road.properties.incidentStarted}</div>}
              {road.properties?.estimatedRestoration && <div>Est. Restoration: {road.properties.estimatedRestoration}</div>}
              {road.properties?.resumedDate && <div>Resumed: {road.properties.resumedDate}</div>}
              {road.properties?.blockedHours && <div>Blocked Hours: {road.properties.blockedHours}</div>}
              {road.properties?.contactPerson && <div>Contact: {road.properties.contactPerson}</div>}
              {road.properties?.restorationEfforts && <div style={{ marginTop: "4px", fontSize: "11px" }}>Efforts: {road.properties.restorationEfforts}</div>}
              {road.properties?.remarks && <div style={{ marginTop: "2px", fontSize: "11px", fontStyle: "italic" }}>Remarks: {road.properties.remarks}</div>}
            </div>
          </L.Popup>
        </L.Polyline>
      );
    }).filter(Boolean);
  }, [roads, isVisible, filters.blocked, filters.oneway, filters.resumed]);

  if (!isVisible || isLoading) return null;

  return <>{roadLayers}</>;
};