// src/components/TrafficFlowOverlay.tsx
// Renders real-time traffic flow with colored polylines on map

import React, { useEffect, useState } from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface TrafficFlowSegment {
  id: string;
  coordinates: [number, number][];
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  color: 'green' | 'yellow' | 'orange' | 'red';
  delay: number;
  confidence: number;
}

interface WazeAlert {
  id: string;
  type: string;
  subtype: string;
  location: { lat: number; lng: number };
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

interface TrafficFlowOverlayProps {
  userLocation: { lat: number; lng: number } | null;
  isVisible: boolean;
}

export const TrafficFlowOverlay: React.FC<TrafficFlowOverlayProps> = ({
  userLocation,
  isVisible
}) => {
  const [flowSegments, setFlowSegments] = useState<TrafficFlowSegment[]>([]);
  const [wazeAlerts, setWazeAlerts] = useState<WazeAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible || !userLocation) {
      setFlowSegments([]);
      setWazeAlerts([]);
      return;
    }

    const fetchTraffic = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const response = await fetch(
          `${apiBaseUrl}/api/v1/traffic/flow?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=20`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch traffic data');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setFlowSegments(result.data.flowSegments || []);
          setWazeAlerts(result.data.wazeAlerts || []);
        }
      } catch (err: any) {
        console.error('[TrafficFlowOverlay] Fetch failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTraffic();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTraffic, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isVisible, userLocation]);

  if (!isVisible || !userLocation) {
    return null;
  }

  return (
    <>
      {/* Traffic Flow Polylines */}
      {flowSegments.map((segment) => (
        <Polyline
          key={segment.id}
          positions={segment.coordinates}
          pathOptions={{
            color: getPolylineColor(segment.color),
            weight: segment.congestionLevel === 'extreme' ? 8 : 
                    segment.congestionLevel === 'high' ? 6 : 5,
            opacity: segment.confidence > 0.7 ? 0.9 : 0.6,
            smoothFactor: 1
          }}
        >
          <Popup>
            <div className="p-2 min-w-[180px]">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${
                  segment.color === 'green' ? 'bg-green-500' :
                  segment.color === 'yellow' ? 'bg-yellow-500' :
                  segment.color === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                }`}></span>
                {segment.congestionLevel.toUpperCase()} Congestion
              </h4>
              <div className="space-y-1 text-xs">
                <p className="text-gray-700 dark:text-gray-300">
                  Current Speed: <span className="font-bold">{segment.currentSpeed} km/h</span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Free Flow Speed: <span className="font-bold">{segment.freeFlowSpeed} km/h</span>
                </p>
                {segment.delay > 0 && (
                  <p className="text-red-600 dark:text-red-400 font-bold">
                    ⏱️ Delay: {Math.round(segment.delay / 60)} min
                  </p>
                )}
                <p className="text-gray-500 dark:text-gray-400">
                  Confidence: {Math.round(segment.confidence * 100)}%
                </p>
              </div>
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Waze Alert Markers */}
      {wazeAlerts.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.location.lat, alert.location.lng]}
          icon={createWazeIcon(alert)}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h4 className="font-bold text-sm mb-1">
                {getWazeIcon(alert.type)} {alert.type.replace(/_/g, ' ')}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                {alert.description}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-bold ${
                  alert.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                  alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                  'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                }`}>
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Loading Indicator */}
      {loading && flowSegments.length === 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🚦 Loading traffic data...
          </p>
        </div>
      )}

      {/* Error Indicator */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full shadow-lg border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            ⚠️ {error}
          </p>
        </div>
      )}

      {/* Traffic Legend */}
      {!loading && flowSegments.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-slate-900 px-3 py-2 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Traffic Flow</p>
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-green-500 rounded"></span> Clear</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-yellow-500 rounded"></span> Moderate</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-orange-500 rounded"></span> Heavy</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-500 rounded"></span> Severe</span>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            {flowSegments.length} segments · {wazeAlerts.length} alerts
          </p>
        </div>
      )}
    </>
  );
};

// Get polyline color based on congestion
function getPolylineColor(color: string): string {
  const colorMap: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444'
  };
  return colorMap[color] || '#6b7280';
}

// Create Waze alert icon
function createWazeIcon(alert: WazeAlert): L.DivIcon {
  const icon = getWazeIcon(alert.type);
  const borderColor = alert.severity === 'high' ? 'red' : 
                      alert.severity === 'medium' ? 'orange' : 'yellow';

  return L.divIcon({
    className: 'waze-alert-marker',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center text-lg border-2 border-${borderColor}-500 animate-pulse">
          ${icon}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

// Get emoji for Waze alert type
function getWazeIcon(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('ACCIDENT')) return '💥';
  if (t.includes('JAM') || t.includes('CONGESTION')) return '🚗';
  if (t.includes('HAZARD')) return '⚠️';
  if (t.includes('ROAD_CLOSED')) return '🚫';
  if (t.includes('CONSTRUCTION')) return '🚧';
  if (t.includes('WEATHER')) return '🌦️';
  if (t.includes('POLICE')) return '🚔';
  return '📍';
}
