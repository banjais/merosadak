import React, { useState, useEffect, useMemo } from 'react';
import { HighwayWeatherNode, RoutePlanResult } from '../types';
import {
  CloudFog,
  CloudRain,
  AlertTriangle,
  Zap,
  Eye,
  Mountain,
  ChevronRight,
  X,
  MapPin,
  Compass,
  ArrowRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  Layers,
  Thermometer,
  Wind
} from 'lucide-react';

interface RouteWeatherAlertToastProps {
  activeRoute: RoutePlanResult | null;
  weatherNodes: HighwayWeatherNode[];
  onFocusPassOnMap: (node: HighwayWeatherNode) => void;
  onOpenWeatherTab: (nodeId?: string) => void;
}

// Calculate Haversine distance in km between two GPS coordinates
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if a weather node is severe (severe fog or heavy rain/thunderstorm/landslide risk)
export function isSevereWeatherNode(node: HighwayWeatherNode): {
  isSevere: boolean;
  type: 'fog' | 'rain' | 'storm' | 'landslide';
  headline: string;
  severityLevel: 'critical' | 'warning';
} {
  const isDenseFog =
    node.condition === 'dense_fog' ||
    (typeof node.visibilityKm === 'number' && node.visibilityKm <= 1.5) ||
    node.roadGrip === 'fog_low_visibility';

  const isHeavyRainOrStorm =
    node.condition === 'rain_monsoon' ||
    node.condition === 'thunderstorm' ||
    node.rainProbabilityPercent >= 70 ||
    node.landslideRisk === 'severe';

  const isModerateMountainShower =
    node.condition === 'mountain_shower' &&
    (node.rainProbabilityPercent >= 55 || node.landslideRisk === 'high');

  if (isDenseFog) {
    return {
      isSevere: true,
      type: 'fog',
      headline: `Dense Mountain Fog (Visibility: ${node.visibilityKm} km)`,
      severityLevel: node.visibilityKm < 1 ? 'critical' : 'warning',
    };
  }

  if (node.condition === 'thunderstorm' || node.landslideRisk === 'severe') {
    return {
      isSevere: true,
      type: 'storm',
      headline: `Severe Monsoon Storm & High Landslide Hazard`,
      severityLevel: 'critical',
    };
  }

  if (isHeavyRainOrStorm || isModerateMountainShower) {
    return {
      isSevere: true,
      type: 'rain',
      headline: `Heavy Mountain Rain (${node.rainProbabilityPercent}% precip)`,
      severityLevel: node.rainProbabilityPercent >= 75 ? 'critical' : 'warning',
    };
  }

  return {
    isSevere: false,
    type: 'rain',
    headline: 'Normal',
    severityLevel: 'warning',
  };
}

export const RouteWeatherAlertToast: React.FC<RouteWeatherAlertToastProps> = ({
  activeRoute,
  weatherNodes,
  onFocusPassOnMap,
  onOpenWeatherTab,
}) => {
  const [dismissedRouteId, setDismissedRouteId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [selectedPassIndex, setSelectedPassIndex] = useState<number>(0);
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(false);

  // Identify weather nodes along the active route
  const affectedPasses = useMemo(() => {
    if (!activeRoute || !activeRoute.pathCoordinates || activeRoute.pathCoordinates.length === 0) {
      return [];
    }

    const routeCoordinates = activeRoute.pathCoordinates;

    // Filter nodes within 22km of any point along the route path
    const nodesOnRoute = weatherNodes.filter((node) => {
      // Find minimum distance to any route coordinate
      let minDistance = Infinity;
      for (const [rLat, rLng] of routeCoordinates) {
        const dist = calculateDistanceKm(node.lat, node.lng, rLat, rLng);
        if (dist < minDistance) {
          minDistance = dist;
        }
        if (minDistance <= 22) break; // Close enough, no need to check all
      }
      return minDistance <= 22;
    });

    // Check which of these nodes have severe fog or heavy rain
    const severeList = nodesOnRoute
      .map((node) => {
        const evaluation = isSevereWeatherNode(node);
        return {
          node,
          evaluation,
        };
      })
      .filter((item) => item.evaluation.isSevere);

    return severeList;
  }, [activeRoute, weatherNodes]);

  // Reset dismissal if active route changes
  const routeIdentifier = activeRoute
    ? `${activeRoute.origin.id}-${activeRoute.destination.id}-${activeRoute.id}`
    : null;

  useEffect(() => {
    if (routeIdentifier && routeIdentifier !== dismissedRouteId) {
      setSelectedPassIndex(0);
      setIsMinimized(false);
    }
  }, [routeIdentifier, dismissedRouteId]);

  if (!activeRoute || affectedPasses.length === 0) {
    return null;
  }

  // If dismissed for this route
  if (dismissedRouteId === routeIdentifier) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
        <button
          onClick={() => setDismissedRouteId(null)}
          className="px-3 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-2xl border border-amber-400/40 flex items-center space-x-2 transition active:scale-95"
          title="Re-open Mountain Pass Weather Warning"
          id="btn-reopen-weather-toast"
        >
          <AlertTriangle className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>Weather Warning ({affectedPasses.length} Pass{affectedPasses.length > 1 ? 'es' : ''})</span>
        </button>
      </div>
    );
  }

  const currentPass = affectedPasses[selectedPassIndex] || affectedPasses[0];
  const isFog = currentPass.evaluation.type === 'fog';
  const isCritical = currentPass.evaluation.severityLevel === 'critical';

  return (
    <aside
      role="region"
      aria-label="Mountain Pass Weather Warning"
      aria-live="polite"
      id="route-weather-alert-toast"
      className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 transition-all duration-300 ${
        isMinimized ? 'opacity-90' : 'opacity-100'
      }`}
    >
      <div
        className={`rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${
          isCritical
            ? 'bg-slate-950/95 border-rose-500/60 ring-2 ring-rose-500/30'
            : 'bg-slate-950/95 border-amber-500/60 ring-2 ring-amber-500/30'
        }`}
      >
        {/* Top Highlight Indicator Bar */}
        <div
          className={`h-1.5 w-full ${
            isCritical
              ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse'
              : 'bg-gradient-to-r from-amber-400 via-indigo-400 to-cyan-400'
          }`}
        />

        {/* Header Section */}
        <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                isFog
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : isCritical
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}
            >
              {isFog ? (
                <CloudFog className="w-5 h-5 animate-pulse" />
              ) : currentPass.evaluation.type === 'storm' ? (
                <Zap className="w-5 h-5 animate-bounce" />
              ) : (
                <CloudRain className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isCritical
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isFog ? 'Dense Fog Advisory' : 'Monsoon / Storm Alert'}
                </span>

                {affectedPasses.length > 1 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {selectedPassIndex + 1} of {affectedPasses.length} Passes
                  </span>
                )}
              </div>

              <h4 className="text-sm font-extrabold text-white mt-0.5 flex items-center space-x-1.5">
                <span>{currentPass.node.name}</span>
                <span className="text-[11px] font-normal text-slate-400 font-mono">
                  ({currentPass.node.elevationM}m)
                </span>
              </h4>
            </div>
          </div>

          {/* Minimize / Dismiss Controls */}
          <div className="flex items-center space-x-1 text-slate-400">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition text-xs"
              title={isMinimized ? 'Expand notification' : 'Collapse notification'}
              id="btn-toggle-weather-toast-minimized"
            >
              {isMinimized ? 'Expand' : '–'}
            </button>
            <button
              onClick={() => setDismissedRouteId(routeIdentifier)}
              className="p-1 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition"
              title="Dismiss for this route"
              id="btn-dismiss-weather-toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body (Collapsible) */}
        {!isMinimized && (
          <div className="px-3.5 pb-3.5 space-y-3">
            {/* Condition Warning Card */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className={isCritical ? 'text-rose-300' : 'text-amber-300'}>
                  {currentPass.evaluation.headline}
                </span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {currentPass.node.highwayCode}
                </span>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">
                {currentPass.node.summary}
              </p>

              {/* Weather Metrics Pill Grid */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px]">
                <div className="p-1 rounded bg-slate-950/80 border border-slate-800 flex items-center space-x-1 text-slate-300">
                  <Eye className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">Vis: <strong>{currentPass.node.visibilityKm}km</strong></span>
                </div>

                <div className="p-1 rounded bg-slate-950/80 border border-slate-800 flex items-center space-x-1 text-slate-300">
                  <CloudRain className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Rain: <strong>{currentPass.node.rainProbabilityPercent}%</strong></span>
                </div>

                <div className="p-1 rounded bg-slate-950/80 border border-slate-800 flex items-center space-x-1 text-slate-300">
                  <ShieldAlert
                    className={`w-3 h-3 shrink-0 ${
                      currentPass.node.landslideRisk === 'severe'
                        ? 'text-rose-400'
                        : currentPass.node.landslideRisk === 'high'
                        ? 'text-orange-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <span className="truncate capitalize">
                    Slide: <strong>{currentPass.node.landslideRisk}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Pagination for Multiple Affected Passes */}
            {affectedPasses.length > 1 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>Other affected passes on your trip:</span>
                <div className="flex items-center space-x-1">
                  {affectedPasses.map((p, idx) => (
                    <button
                      key={p.node.id}
                      onClick={() => setSelectedPassIndex(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        selectedPassIndex === idx
                          ? 'bg-amber-500 text-slate-950 font-extrabold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Pass {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => onFocusPassOnMap(currentPass.node)}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
                id="btn-weather-toast-focus-map"
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Focus on Map</span>
              </button>

              <button
                onClick={() => onOpenWeatherTab(currentPass.node.id)}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
                id="btn-weather-toast-open-tab"
              >
                <CloudFog className="w-3.5 h-3.5 text-emerald-200" />
                <span>Weather Radar</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
