// src/components/RouteDisplay.tsx
// Displays route, alternatives, and status on map

import React from 'react';
import { Polyline, Popup, Marker } from 'react-leaflet';
import { RouteInfo } from '../services/enhancedSearchService';
import { L } from '../lib/leaflet';

interface RouteDisplayProps {
  route: RouteInfo;
  showAlternatives?: boolean;
  userLocation: { lat: number; lng: number };
  pathAnalytics?: { duration: number; delay: number; landslides: number; hazards?: any[] } | null;
}

export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  route,
  showAlternatives = true,
  userLocation,
  pathAnalytics
}) => {
  // Calculate route points (simplified - in production, use real routing API)
  const routePoints = calculateRoutePoints(
    userLocation,
    { lat: route.to.lat, lng: route.to.lng },
    route.highways
  );

  return (
    <>
      {/* Main Route */}
      <Polyline
        positions={routePoints}
        pathOptions={{
          color: route.status === 'clear' ? '#3B82F6' : route.status === 'partial' ? '#F59E0B' : '#EF4444',
          weight: route.status === 'blocked' ? 6 : 5,
          opacity: 0.9,
          dashArray: route.status === 'partial' ? '10, 6' : undefined
        }}
      >
        <Popup>
          <div className="p-2">
            <h4 className="font-bold text-sm">
              {route.from.name} → {route.to.name}
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              {route.distance.toFixed(0)} km · {route.duration.toFixed(1)} hours
            </p>
            {route.blockedSections > 0 && (
              <p className="text-xs text-red-600 font-bold mt-1">
                ⚠️ {route.blockedSections} blocked section{route.blockedSections > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </Popup>
      </Polyline>

      {/* Real-time Hazard Highlighting */}
      {pathAnalytics?.hazards?.map((hazard, idx) => (
        <Marker
          key={`hazard-${idx}`}
          position={[hazard.lat, hazard.lng]}
          icon={L.divIcon({
            className: 'route-hazard-marker',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 bg-red-500/20 rounded-full animate-ping"></div>
                <div class="w-5 h-5 bg-white rounded-full border-2 border-red-600 flex items-center justify-center shadow-lg">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                </div>
              </div>
            `
          })}
        >
          <Popup>
            <div className="text-xs font-bold text-red-600">Route Hazard: ${hazard.type}</div>
          </Popup>
        </Marker>
      ))}

      {/* Alternative Routes */}
      {showAlternatives && route.alternatives?.map((alt, idx) => {
        const altPoints = calculateRoutePoints(
          userLocation,
          { lat: alt.to.lat, lng: alt.to.lng },
          alt.highways
        );

        const colors = ['#10B981', '#8B5CF6', '#06B6D4']; // Green, Purple, Cyan

        return (
          <Polyline
            key={`alt-${idx}`}
            positions={altPoints}
            pathOptions={{
              color: colors[idx % colors.length],
              weight: 4,
              opacity: 0.7,
              dashArray: '8, 8'
            }}
          >
            <Popup>
              <div className="p-2">
                <h4 className="font-bold text-sm">
                  Alternative Route {idx + 1}
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {alt.distance.toFixed(0)} km · {alt.duration.toFixed(1)} hours
                </p>
                <p className={`text-xs font-bold mt-1 ${alt.status === 'clear' ? 'text-green-600' :
                  alt.status === 'partial' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                  {alt.status === 'clear' ? '✅ Clear' :
                    alt.status === 'partial' ? '⚠️ Partial blocks' : '🔴 Blocked'}
                </p>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
};

// Simplified route calculation (creates intermediate waypoints)
function calculateRoutePoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  highways: string[]
): [number, number][] {
  // In production, this would call a routing API
  // For now, create a simple curved path with midpoint offset

  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;

  // Add slight curve (perpendicular offset)
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  const offset = len * 0.1; // 10% curve

  const perpX = -dy / len * offset;
  const perpY = dx / len * offset;

  const midPoint: [number, number] = [midLat + perpY, midLng + perpX];

  return [
    [from.lat, from.lng],
    midPoint,
    [to.lat, to.lng]
  ];
}
