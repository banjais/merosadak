import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X, ChevronUp, ChevronDown, MapPin, Eye, EyeOff,
  Clock, ArrowRight, Zap, Mountain, Activity, Shield,
  Fuel, Car, Wrench, BatteryCharging, HeartPulse, AlertTriangle, ShieldAlert, Navigation
  , Mic, MicOff, RadioTower, Share2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Circle, Rectangle, GeoJSON, useMap, useMapEvents, Polyline } from "react-leaflet";
import { L } from "./lib/leaflet";
import LZString from "lz-string";
import RBush from "rbush";
import "leaflet/dist/leaflet.css";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useNepalData } from "./hooks/useNepalData";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useWebSocket, WebSocketMessage, SendMessage } from "./hooks/useWebSocket";
import { useAlert } from "./hooks/useAlert";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useUserProfile, useLeaderboard } from "./hooks/useUserProfile";
import { useAnalytics } from "./hooks/useAnalytics";
import { useSuperadmin } from "./hooks/useSuperadmin";
import { useGemini } from "./hooks/useGemini";
import { useRoutePlanning } from "./hooks/useRoutePlanning";
import { useOfflineChat } from "./useOfflineChat";
import { useAdminResolution, type ExtendedSearchResult } from "./useAdminResolution";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useETA, useQuickETA } from "./hooks/useETA";

import type { TravelIncident, ChatMessage } from "./types";
import { apiFetch } from "./api";
import { useTranslation } from "./i18n";

import {
  initializeStorage,
  themeService,
  clearAllStorage,
  purgeAppData
} from "./services/storageIndexService";
import { persistentStorage } from "./persistentOfflineService";

import { HotUpdateManager } from "./services/hotUpdateManager";
import { fetchServiceData } from "./services/gasService";

import BoundaryOverlay from "./components/BoundaryOverlay";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { FloatingMenu } from "./components/FloatingMenu";
import SearchOverlay from "./components/SearchOverlay";
import { WeatherMonsoonProvider, useWeatherMonsoon } from "./WeatherMonsoonContext";
import { WeatherWidget } from "./components/WeatherWidget";
import { SystemMenu } from "./components/SystemMenu";
import { BottomInfoArea } from "./components/BottomInfoArea";
import { MapControls } from "./components/MapControls";
import { ReportIncidentOverlay } from "./components/ReportIncidentOverlay";
import { SOSOverlay } from "./components/SOSOverlay";
import { HighwayBrowser } from "./components/HighwayBrowser";
import { PreTripChecklistModal } from "./PreTripChecklistModal";
import { HighwayHighlightOverlay } from "./components/HighwayHighlightOverlay";
import { SafeTripReport } from "./components/SafeTripReport";
import { useToast } from "./ToastContext";
import { OfflineBanner } from "./components/OfflineBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";
import { MapLayersPanel } from "./components/MapLayersPanel";
import { MonsoonRiskOverlay } from "./components/MonsoonRiskOverlay";
import { DriverDashboard } from "./components/DriverDashboard";
import { DistanceCalculator } from "./DistanceCalculator";
import { SearchOverlayIntent } from "./components/SearchOverlayIntent";
import { RouteDisplay } from "./components/RouteDisplay";
import { ContextualInfoCards } from "./components/ContextualInfoCards";
import { MyPlansPanel } from "./components/MyPlansPanel";
import { PreTripBriefing } from "./components/PreTripBriefing";
import { BelongingsChecklist } from "./components/BelongingsChecklist";
import { UserPreferencesScreen } from "./components/UserPreferencesScreen";
import { TrafficFlowOverlay } from "./components/TrafficFlowOverlay";
import DeployDashboard from "./components/DeployDashboard";
import { UptimeRobotStats } from "./components/UptimeRobotStats";
import {
  MapLayersToggle,
  type MapLayerType
} from "./components/MapLayersToggle";
import { InfoBoard } from "./components/InfoBoard";
import { BatterySaverModal } from "./components/BatterySaverModal";
import { UpdateBanner } from "./components/UpdateBanner";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { haversineDistance } from "./services/geoUtils";

import {
  saveTravelPlan,
  getActivePlansCount,
  generateChecklist,
  generateTripBriefing,
  markBriefingShown
} from "./services/travelPlanService";

import {
  hasCompletedOnboarding,
  getUserPOIPreferences,
  updatePOIPreference
} from "./services/userPreferencesService";

import type {
  TravelPlan,
  TripBriefing,
  ChecklistItem
} from "./types/travelPlan";

/**
 * GradeHUD: A real-time inclinometer showing the pitch of the vehicle
 */
const GradeHUD: React.FC<{ grade: number; roll: number; roadQuality?: string; precipitation?: number; isNightVision: boolean; isStealthMode: boolean }> = ({ grade, roll, roadQuality, precipitation = 0, isNightVision, isStealthMode }) => {
  const rotation = useMemo(() => Math.atan(grade / 100) * (180 / Math.PI), [grade]);
  const gradeColor = Math.abs(grade) > 10 ? 'text-error' : 'text-emerald-500';
  const hasAlertedRef = useRef(false);
  const prevNearSkidLimitRef = useRef(false);

  // 🏎️ Tire Friction / Traction Logic
  const tractionRisk = useMemo(() => Math.abs(grade) + Math.abs(roll), [grade, roll]);
  const tractionLimit = useMemo(() => {
    const q = roadQuality?.toUpperCase() || 'B';
    let base = 35;
    if (q === 'A') base = 45; // High grip
    else if (q === 'B') base = 35;
    else if (q === 'C') base = 25;
    else if (q === 'D') base = 18;
    else base = 12; // Grade F/Earthen

    const stealthFactor = isStealthMode ? 1.5 : 1.0; // Reduce sensitivity in Stealth Mode
    return base * stealthFactor * Math.max(0.5, 1 - (precipitation / 40));
  }, [roadQuality, isStealthMode, precipitation]);

  const isLosingTraction = tractionRisk > tractionLimit;
  const isNearSkidLimit = tractionRisk >= tractionLimit * 0.9;

  // 🔊 Tactical Audio Alert: Triggers once when entering warning zone
  useEffect(() => {
    if (isNearSkidLimit && !hasAlertedRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Alert Sound (High Pitch)
        if (isNearSkidLimit && !hasAlertedRef.current) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(950, ctx.currentTime); // Tactical high-pitch
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          hasAlertedRef.current = true;
        }
        // Recovery Sound (Low Pitch Confirmation)
        else if (!isNearSkidLimit && prevNearSkidLimitRef.current) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime); // Low-frequency confirmation (A4)
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
          hasAlertedRef.current = false;
        }
      } catch (e) { console.warn("Audio feedback failed", e); }
    }
    prevNearSkidLimitRef.current = isNearSkidLimit;
  }, [isNearSkidLimit]);

  return (
    <div className="relative flex items-center gap-4 bg-black/60 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 shadow-2xl">
      <AnimatePresence>
        {isNearSkidLimit && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: -64, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-error text-white rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-3 z-[50]"
          >
            <div className="p-1.5 bg-white/20 rounded-lg animate-pulse">
              <ShieldAlert size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Anti-Skid Warning</span>
              <span className="text-[8px] font-bold opacity-80 uppercase leading-none mt-1">Traction Limit Critical</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col items-center gap-1">
        <div className={`relative w-14 h-14 rounded-full border-2 border-white/20 overflow-hidden flex items-center justify-center`}>
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${-rotation}deg)` }}
          >
            <div className="w-[150%] h-px bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4 h-4 border-t-2 border-primary" style={{ transform: 'translateY(-10px)' }} />
          </div>
          <div className={`z-10 w-7 h-1 bg-current ${gradeColor} shadow-lg rounded-full transition-transform duration-500`} style={{ transform: `rotate(${-rotation}deg)` }} />
        </div>
        <span className={`text-[8px] font-black ${gradeColor}`}>PITCH</span>
      </div>

      {/* ⚠️ Tire Friction Indicator */}
      <div className="flex flex-col items-center gap-1">
        <div className={`
          w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300
          ${isLosingTraction
            ? 'bg-error border-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]'
            : 'bg-white/10 border-white/20 text-white/40'}
        `}>
          <Activity size={16} className={isLosingTraction ? 'text-white' : 'text-white/40'} />
        </div>
        <span className={`text-[8px] font-black ${isLosingTraction ? 'text-error animate-pulse' : 'text-white/40'}`}>
          FRICTION
        </span>
      </div>
    </div>
  );
};

/**
 * FollowerTacticalHUD: Displays leader telemetry for followers during convoy missions
 */
const FollowerTacticalHUD: React.FC<{
  leaderTelemetry: TelemetryData;
  currentUserLocation: { lat: number; lng: number } | null;
  followerSpeedKmh: number;
  isFollowLeader: boolean;
  onToggleFollow: () => void;
  onLeaderVision: () => void;
}> = ({ leaderTelemetry, currentUserLocation, followerSpeedKmh, isFollowLeader, onToggleFollow, onLeaderVision }) => {
  const distance = useMemo(() => {
    if (!currentUserLocation || !leaderTelemetry.lat || !leaderTelemetry.lng) return null;
    return haversineDistance(currentUserLocation.lat, currentUserLocation.lng, leaderTelemetry.lat, leaderTelemetry.lng);
  }, [currentUserLocation, leaderTelemetry]);

  const speedDiff = Math.abs(leaderTelemetry.speed - followerSpeedKmh);
  const isSpeedMismatch = speedDiff > 15 && followerSpeedKmh > 5;
  const isOutOfFormation = distance !== null && distance > 5;
  const lastAlertRef = useRef<number>(0);

  // 🔊 Formation Warning Audio Cue: Triggers if separation exceeds 5km
  useEffect(() => {
    if (isOutOfFormation && Date.now() - lastAlertRef.current > 60000) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        lastAlertRef.current = Date.now();
      } catch (e) { console.warn("Formation audio cue failed", e); }
    }
  }, [isOutOfFormation]);

  return (
    <div className="absolute top-24 left-4 z-[1002] bg-slate-950/80 backdrop-blur-md p-4 rounded-3xl border border-indigo-500/30 shadow-2xl flex flex-col gap-2 min-w-[140px] animate-in fade-in slide-in-from-left-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_#6366f1]" />
        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Convoy Tactical HUD</span>
      </div>

      {isOutOfFormation && (
        <div className="flex items-center gap-1.5 text-[8px] font-black text-error uppercase animate-pulse mb-1">
          <AlertTriangle size={10} /> Formation Warning: {distance?.toFixed(1)}km Gap
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter mb-0.5">Leader Velocity</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-white tabular-nums">{Math.round(leaderTelemetry.speed)}</span>
            <span className="text-[8px] font-bold text-white/40 uppercase">KM/H</span>
          </div>
        </div>
        <div className="flex flex-col border-l border-white/5 pl-4">
          <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter mb-0.5">Separation</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-indigo-400 tabular-nums">{distance !== null ? distance.toFixed(2) : '--'}</span>
            <span className="text-[8px] font-bold text-white/40 uppercase">KM</span>
          </div>
        </div>
      </div>

      {/* Speed Match Indicator */}
      <div className="flex items-center justify-between px-1 mt-1 border-t border-white/5 pt-2">
        <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter">Speed Match</span>
        {isSpeedMismatch ? (
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="flex items-center gap-1 text-[8px] font-black text-error uppercase"
          >
            <AlertTriangle size={8} /> Mismatch
          </motion.div>
        ) : (
          <span className="text-[8px] font-black text-emerald-500 uppercase">Synced</span>
        )}
      </div>

      <button
        onClick={onToggleFollow}
        className={`mt-2 w-full py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${isFollowLeader ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40'}`}
      >
        <div className="flex items-center justify-center gap-2">
          <Navigation size={10} className={isFollowLeader ? 'animate-pulse' : ''} />
          {isFollowLeader ? 'Following Leader' : 'Follow Leader Zoom'}
        </div>
      </button>

      <button
        onClick={onLeaderVision}
        className="mt-1 w-full py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
      >
        <Eye size={10} /> Leader Vision
      </button>
    </div>
  );
};

/**
 * LeaderVisionManager: Temporarily centers map on leader's location
 */
const LeaderVisionManager: React.FC<{
  trigger: number;
  leaderLocation: { lat: number; lng: number } | null;
}> = ({ trigger, leaderLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && leaderLocation) {
      map.flyTo([leaderLocation.lat, leaderLocation.lng], 15, { animate: true, duration: 1.5 });
    }
  }, [trigger, leaderLocation, map]);
  return null;
};

/**
 * FollowLeaderManager: Automatically adjusts map bounds to keep leader and follower in view
 */
const FollowLeaderManager: React.FC<{
  isActive: boolean;
  currentUserLocation: { lat: number; lng: number } | null;
  leaderLocation: { lat: number; lng: number } | null;
}> = ({ isActive, currentUserLocation, leaderLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (isActive && currentUserLocation && leaderLocation) {
      const bounds = L.latLngBounds([currentUserLocation.lat, currentUserLocation.lng], [leaderLocation.lat, leaderLocation.lng]);
      map.fitBounds(bounds, { padding: [100, 100], animate: true });
    }
  }, [isActive, currentUserLocation, leaderLocation, map]);
  return null;
};

/**
 * FollowMeHandler: Automatically pans the map to follow the user's location.
 */
const FollowMeHandler: React.FC<{ position: { lat: number; lng: number } | null, isActive: boolean }> = ({ position, isActive }) => {
  const map = useMap();
  useEffect(() => {
    if (isActive && position) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 1 });
    }
  }, [position, isActive, map]);
  return null;
};

const MapZoomHandler: React.FC<{ zoom: number }> = ({ zoom }) => {
  const map = useMap();
  useEffect(() => {
    // flyTo provides a smoother, more "organic" transition than setZoom
    map.flyTo(map.getCenter(), zoom, {
      animate: true,
      duration: 0.6,
      easeLinearity: 0.25
    });
  }, [zoom, map]);
  return null;
};

/**
 * SyncMarker: Renders a custom SVG marker with a height-variable altitude beam
 * and handles the Shift + Hover fly-to logic.
 */
const SyncMarker: React.FC<{
  point: L.LatLng;
  elevation: number | null;
  grade: number | null;
  isShiftPressed: boolean;
}> = ({ point, elevation, grade, isShiftPressed }) => { // Destructure grade here
  const map = useMap();

  useEffect(() => {
    if (isShiftPressed && point) {
      map.flyTo(point, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [point, isShiftPressed, map]);

  const beamHeight = useMemo(() => {
    if (elevation === null) return 60;
    // Scale logic: min 60px, max 200px based on altitude (relative to Nepal's peaks, 0-6000m range)
    return Math.max(60, Math.min(200, (elevation / 6000) * 200));
  }, [elevation]);

  const isSteep = grade !== null && Math.abs(grade) > 10;
  const beamColor = isSteep ? '#ef4444' : '#f59e0b';

  const icon = useMemo(() => L.divIcon({
    className: 'sync-altitude-marker',
    html: `
      <div class="relative flex flex-col items-center justify-end" style="height: ${beamHeight + 40}px; transform: translateY(-100%);">
        <!-- Elevation Label -->
        <div class="${isSteep ? 'bg-error' : 'bg-amber-500'} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xl mb-1 whitespace-nowrap border border-white/40 ring-2 ${isSteep ? 'ring-error/20' : 'ring-amber-500/20'}">
          ${Math.round(elevation || 0)}m ${grade !== null ? `(${Math.round(grade)}%)` : ''}
        </div>
        
        <!-- Altitude Beam SVG -->
        <svg width="24" height="${beamHeight}" viewBox="0 0 24 ${beamHeight}" class="drop-shadow-2xl overflow-visible">
          <defs>
            <linearGradient id="beamGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="${beamColor}" stop-opacity="0" />
              <stop offset="100%" stop-color="${beamColor}" stop-opacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <!-- Tapered Beam -->
          <path d="M12 0 L24 ${beamHeight} L0 ${beamHeight} Z" fill="url(#beamGradient)" filter="url(#glow)" />
          <!-- Core Line -->
          <line x1="12" y1="0" x2="12" y2="${beamHeight}" stroke="${beamColor}" stroke-width="1.5" stroke-dasharray="2 2" />
        </svg>
        
        <!-- Ground Point Impact -->
        <div class="w-4 h-4 bg-white rounded-full border-2 ${isSteep ? 'border-error' : 'border-amber-500'} shadow-xl ring-4 ${isSteep ? 'ring-error/30' : 'ring-amber-500/30'} -mt-2 relative z-10 animate-pulse"></div>
      </div>
    `,
    iconSize: [60, beamHeight + 40],
    iconAnchor: [30, beamHeight + 40]
  }), [elevation, beamHeight, grade, isSteep, beamColor]);

  return <Marker position={point} icon={icon} zIndexOffset={3000} />;
};

import type { SearchResult, RouteInfo } from "./services/enhancedSearchService";
import type { UserPOIPreferences } from "./types/poi";
import { reminderService, Reminder, SyncContext, TelemetryData } from "./reminderService";

// Define an enum for the board's display states
enum BoardDisplayState {
  HIDDEN = 'hidden',
  MINIMIZED = 'minimized', // Small bar at the bottom, just the handle
  SPLIT = 'split', // 50/50 split
  EXPANDED = 'expanded', // 80% board, 20% map
}


/* ---------------- MAP EVENT HANDLER ---------------- */

/**
 * MapViewControl manages the spatial focus of the map.
 * It ensures the map is centered on the user initially and adjusts the view
 * to show the full extent of selected roads or routes.
 */
const MapFocusManager: React.FC<{
  currentUserLocation: { lat: number; lng: number; speed?: number | null; heading?: number | null } | null;
  geoJSON: RouteInfo | null;
  selectedIncident: TravelIncident | null;
  isTilted: boolean;
  isHighContrast: boolean;
}> = ({ currentUserLocation, geoJSON, selectedIncident, isTilted, isHighContrast }) => {
  const map = useMap();
  const isInitialLoad = useRef(true);

  // Initial focus on User Geolocation
  useEffect(() => {
    if (currentUserLocation && isInitialLoad.current) {
      const targetLat = isTilted ? currentUserLocation.lat + 0.008 : currentUserLocation.lat;
      map.setView([targetLat, currentUserLocation.lng], 16);
      isInitialLoad.current = false;
    }
  }, [currentUserLocation, map, isTilted]);

  // Adjust View for Road Length / Route Focus
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    // Increase padding in high contrast mode to help route visibility against glare
    const paddingValue = (isMobile ? 20 : 80) + (isHighContrast ? 20 : 0);

    if (geoJSON && currentUserLocation) {
      const bounds = L.latLngBounds(
        [currentUserLocation.lat, currentUserLocation.lng],
        [geoJSON.to.lat, geoJSON.to.lng]
      );
      const paddingOptions: any = isTilted
        ? [paddingValue * 5, paddingValue, paddingValue, paddingValue]
        : [paddingValue, paddingValue];

      map.fitBounds(bounds, { padding: paddingOptions, animate: true });
    } else if (selectedIncident?.lat && selectedIncident?.lng) {
      const targetLat = isTilted ? selectedIncident.lat + 0.003 : selectedIncident.lat;
      map.flyTo([targetLat, selectedIncident.lng], 15, { duration: 1.5 });
    }
  }, [geoJSON, selectedIncident, currentUserLocation, map, isTilted]);

  return null;
};

/**
 * SafetyBuffer: Renders a dynamic zone around the user that reacts to 
 * vehicle speed, proximity hazards, and real-time weather visibility.
 */
const SafetyBuffer: React.FC<{
  currentUserLocation: { lat: number; lng: number; speed?: number | null } | null;
  pilotMode: boolean;
  isHazardNearby: boolean;
  isCollisionRisk: boolean;
  isMuted: boolean;
}> = ({ currentUserLocation, pilotMode, isHazardNearby, isCollisionRisk, isMuted }) => {
  const { weatherData } = useWeatherMonsoon();
  const lastWeatherAlertRef = useRef<number>(0);

  if (!pilotMode || !currentUserLocation) return null;

  const speedKmh = (currentUserLocation.speed || 0) * 3.6;
  // Buffer size: 150m minimum, scales up to 750m at 100km/h
  const dynamicRadius = Math.max(150, 200 + (speedKmh * 5.5));

  // Calculate visibility-based opacity factor from current weather
  const visibilityFactor = (() => {
    if (!weatherData) return 1.0;
    const cond = (weatherData.condition || "").toLowerCase();
    if (cond.includes('fog') || cond.includes('heavy rain') || cond.includes('snow')) return 2.5;
    if (cond.includes('rain') || cond.includes('mist') || cond.includes('haze')) return 1.5;
    return 1.0;
  })();

  // 🌦️ Severe Weather Audio Alert
  React.useEffect(() => {
    if (!weatherData || isMuted || !('speechSynthesis' in window)) return;

    const cond = (weatherData.condition || "").toLowerCase();
    const isSevere = cond.includes('fog') || cond.includes('heavy rain') || cond.includes('snow');

    if (isSevere && Date.now() - lastWeatherAlertRef.current > 600000) { // 10 min throttle
      const msg = `Visibility Warning: ${weatherData.condition} is severely limiting visibility. Please reduce speed and use your lights.`;
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
      lastWeatherAlertRef.current = Date.now();
    }
  }, [weatherData, isMuted]);

  return (
    <Circle
      center={[currentUserLocation.lat, currentUserLocation.lng]}
      radius={dynamicRadius}
      pathOptions={{
        color: isCollisionRisk ? '#f87171' : (isHazardNearby ? '#ef4444' : '#10b981'),
        fillColor: isCollisionRisk ? '#f87171' : (isHazardNearby ? '#ef4444' : '#10b981'),
        fillOpacity: Math.min(0.7, (isCollisionRisk ? 0.35 : 0.15) * visibilityFactor),
        weight: 2,
        dashArray: (isHazardNearby || isCollisionRisk) ? '5, 10' : undefined,
        interactive: false
      }}
    />
  );
};

/**
 * FogOverlay: Dynamically overlays a semi-opaque layer on the map 
 * based on weather-driven visibility conditions (Fog, Mist, Haze).
 */
const FogOverlay: React.FC<{ isStealthMode: boolean }> = ({ isStealthMode }) => {
  const { weatherData } = useWeatherMonsoon();
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds())
  });

  if (!weatherData || isStealthMode) return null;

  const condition = (weatherData.condition || "").toLowerCase();
  const visibility = weatherData.visibility || 10000; // in meters

  let opacity = 0;
  // Scale opacity based on condition strings or raw visibility data
  if (condition.includes('fog')) opacity = 0.45;
  else if (condition.includes('mist') || condition.includes('haze')) opacity = 0.2;

  if (visibility < 500) opacity = Math.max(opacity, 0.6);
  else if (visibility < 2000) opacity = Math.max(opacity, 0.3);

  if (opacity === 0) return null;

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        fillColor: '#ffffff',
        fillOpacity: opacity,
        stroke: false,
        interactive: false
      }}
    />
  );
};

/**
 * RainOverlay: Renders a blue-tinted overlay with a pulsing animation 
 * when precipitation levels or weather conditions indicate rain.
 */
const RainOverlay: React.FC<{ isStealthMode: boolean }> = ({ isStealthMode }) => {
  const { weatherData } = useWeatherMonsoon();
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds())
  });

  if (!weatherData || isStealthMode) return null;

  const condition = (weatherData.condition || "").toLowerCase();
  const precipitation = weatherData.precipitation || 0;
  const isRaining = condition.includes('rain') || condition.includes('drizzle') || precipitation > 0.4;

  if (!isRaining) return null;

  // Opacity scales with precipitation intensity
  const opacity = Math.min(0.3, 0.1 + (precipitation * 0.2));

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        fillColor: '#60a5fa',
        fillOpacity: opacity * 0.8,
        stroke: false,
        interactive: false,
        className: 'rain-falling' // Custom CSS for falling streaks
      }}
    />
  );
};

/**
 * SnowOverlay: Renders a white, high-opacity overlay to simulate 
 * winter road conditions and reduced visibility from snowfall.
 */
const SnowOverlay: React.FC<{ isStealthMode: boolean }> = ({ isStealthMode }) => {
  const { weatherData } = useWeatherMonsoon();
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds())
  });

  if (!weatherData || isStealthMode) return null;

  const condition = (weatherData.condition || "").toLowerCase();
  const isSnowing = condition.includes('snow') || condition.includes('blizzard') || condition.includes('sleet');

  if (!isSnowing) return null;

  // Snow has a higher base opacity to represent blinding conditions
  const opacity = Math.min(0.5, 0.25 + ((weatherData.precipitation || 0) * 0.3));

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        fillColor: '#f8fafc',
        fillOpacity: opacity,
        stroke: false,
        interactive: false,
        className: 'animate-pulse' // Snow "sparkles" or flickers slightly
      }}
    />
  );
};

/**
 * ThunderstormEffect: Occasionally flashes the screen white during 
 * extreme precipitation or thunderstorm conditions to alert the driver.
 */
const ThunderstormEffect: React.FC = () => {
  const { weatherData } = useWeatherMonsoon();
  const [flash, setFlash] = useState(false);
  const flashTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!weatherData) return;
    const condition = (weatherData.condition || "").toLowerCase();
    // Trigger if condition mentions storm/thunder or intensity is extreme (>15mm/hr)
    const isExtreme = condition.includes('storm') || condition.includes('thunder') || (weatherData.intensity || 0) > 15;

    if (!isExtreme) {
      setFlash(false);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      return;
    }

    const scheduleFlash = () => {
      // Random flash between 5 and 20 seconds
      const delay = Math.random() * 15000 + 5000;
      flashTimerRef.current = setTimeout(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 150); // Flash duration
        scheduleFlash();
      }, delay);
    };

    scheduleFlash();
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [weatherData]);

  if (!flash) return null;
  return <div className="fixed inset-0 z-[10000] bg-white/30 pointer-events-none transition-opacity duration-75" />;
};

/** Structure for R-tree items representing a road segment */
interface SegmentItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  p1: { lat: number; lng: number };
  p2: { lat: number; lng: number };
}

/** Structure for R-tree items representing a POI */
interface POIItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  poi: any;
}

/**
 * Captures map clicks and passes them to the distance calculator state
 */
const MapClickHandler: React.FC<{
  onMapClick: (latlng: L.LatLng, zoom: number) => void;
  isActive: boolean;
  currentUserLocation: any;
  isTilted: boolean;
}> = ({ onMapClick, isActive, currentUserLocation, isTilted }) => {
  const map = useMap();
  const [mousePos, setMousePos] = useState<L.LatLng | null>(null);

  useMapEvents({
    click: (e) => {
      if (isActive) onMapClick(e.latlng, map.getZoom());
    },
    mousemove: (e) => {
      if (isActive) setMousePos(e.latlng);
      else if (mousePos) setMousePos(null);
    },
    mouseout: () => setMousePos(null)
  });

  if (!isActive || !mousePos) return null;

  // Visual representation of the roadThresholdKm logic in findSnappedPoint
  const zoom = map.getZoom();
  const zoomFactor = Math.pow(2, 14 - zoom);
  const radiusMeters = 150 * zoomFactor; // 0.15km * 1000

  return (
    <Circle
      center={mousePos}
      radius={radiusMeters}
      pathOptions={{
        color: 'rgba(99, 102, 241, 0.4)',
        fillColor: 'rgba(99, 102, 241, 0.1)',
        weight: 1,
        dashArray: '5, 5',
        interactive: false
      }}
    />
  );
};

/* ---------------- MAIN APP ---------------- */

const MainApp: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { incidents, refresh } = useNepalData();
  const { isOffline } = useNetworkStatus();

  const { alerts } = useAlert();
  const { subscribe: pushSubscribe, supported: pushSupported } = usePushNotifications();
  const { isInstallable, install: triggerInstall } = usePWAInstall();

  const { profile: userProfile } = useUserProfile();
  const { leaderboard } = useLeaderboard(10);
  const { summary: analyticsSummary } = useAnalytics("7d");
  const { weatherData } = useWeatherMonsoon();
  const { resolveAdminInfo } = useAdminResolution();

  const { isSuperadmin, broadcast, purge } = useSuperadmin();
  const { ask: geminiAsk } = useGemini();

  const { language } = useTranslation();
  const { addToast, success, error, info, warning } = useToast();
  useETA();
  useQuickETA();

  // Single source of truth for base URLs
  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
    return `${base}/ws/live`;
  }, []);

  const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "/api/v1";

  const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number; speed?: number | null; heading?: number | null; elevation?: number | null } | null>(null);

  // Use explicit WebSocket URL if provided, otherwise derive from current host
  const { lastMessage, sendMessage } = useWebSocket(wsUrl);
  const [isMuted, setIsMuted] = useState(false);

  // Offline & P2P Integration
  const {
    isP2PConnected, outOfRangeMembers, peersLocation, p2pSignalStrength, peersRoutes,
    isQuietMode, setIsQuietMode, voiceClipHistory, playVoiceClip,
    startPTT, stopPTT, isPTTRecording, lastVoiceClip,
    broadcastLocation, sendOfflineSOS, activeSOS, clearSOS, broadcastRoute
  } = useOfflineChat(user?.id || 'guest', currentUserLocation); // Pass currentUserLocation to hook

  // 🤝 Convoy Merge Suggestion Logic
  const [dismissedMergeIds, setDismissedMergeIds] = useState<Set<string>>(new Set());
  const mergeCandidate = useMemo(() => {
    if (!currentUserLocation || !isP2PConnected) return null;
    return Object.entries(peersLocation)
      .map(([id, data]) => ({
        id,
        ...data,
        distance: haversineDistance(currentUserLocation.lat, currentUserLocation.lng, data.lat, data.lng)
      }))
      .find(m => m.distance < 0.8 && m.id !== user?.id && !dismissedMergeIds.has(m.id) && peersRoutes[m.id]);
  }, [peersLocation, currentUserLocation, user?.id, isP2PConnected, dismissedMergeIds, peersRoutes]);

  const handleMergeConvoy = (peerId: string) => {
    const peerRoute = peersRoutes[peerId];
    if (peerRoute) {
      setMeasurePoints(peerRoute.points.map(p => L.latLng(p.lat, p.lng)));
      addToast("success", `Convoy Merged: Now following ${peersLocation[peerId]?.name}'s path`);
      setDismissedMergeIds(prev => new Set(prev).add(peerId));
    }
  };

  /* ---------------- STATE ---------------- */
  const [isDarkMode, setIsDarkMode] = useState(false);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const toggleMute = () => setIsMuted(!isMuted);

  const [appReady, setAppReady] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  const [boardDisplayState, setBoardDisplayState] = useState<BoardDisplayState>(BoardDisplayState.SPLIT);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startY, setStartY] = useState(0);
  const [initialBoardHeight, setInitialBoardHeight] = useState(0);
  const [currentBoardHeight, setCurrentBoardHeight] = useState(0); // This will be the dynamically adjusted height

  const [activeTab, setActiveTab] = useState<'alerts' | 'summary' | 'chat' | 'services' | 'fleet'>('alerts');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  const safetyScoreRef = useRef(100);
  const mechanicalStressRef = useRef(0);

  const anyFollowerOutOfFormation = outOfRangeMembers.length > 0; // Define this for DriverDashboard

  const [isFollowMe, setIsFollowMe] = useState(true);
  const [smoothedSpeed, setSmoothedSpeed] = useState(0);
  const [searchRadius, setSearchRadius] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [serviceResults, setServiceResults] = useState<any[]>([]);
  const [monsoonVisible, setMonsoonVisible] = useState(false);
  const [highwayViewMode, setHighwayViewMode] = useState<'pavement' | 'simple'>('pavement');
  const [highwayReport, setHighwayReport] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [safetyHistory, setSafetyHistory] = useState<{ t: number; val: number }[]>([]);
  const [isDoNotDisturb, setIsDoNotDisturb] = useState(false);
  const [isCompactHUD, setIsCompactHUD] = useState(false);
  const [hapticIntensity, setHapticIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [moodEQ, setMoodEQ] = useState<'empathetic' | 'factual'>('factual');

  const [mapLayer, setMapLayer] = useState<MapLayerType>("standard");

  // Added missing state for persona and contrast
  const [activePersona, setActivePersona] = useState<'safety' | 'explorer' | 'pro'>('safety');
  const toggleHighContrast = () => setIsHighContrast(prev => !prev);
  const [filterHighSafety, setFilterHighSafety] = useState(false);
  const [masterHighwayGeoJSON, setMasterHighwayGeoJSON] = useState<any>(null);

  // Distance Calculator State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [isRouteSmoothing, setIsRouteSmoothing] = useState(true);
  const [mechanicalStress, setMechanicalStress] = useState(0);
  const [gForce, setGForce] = useState(1.0);
  const lastConvoyAlertRef = useRef<number>(0);
  const [lastSnappedPoint, setLastSnappedPoint] = useState<L.LatLng | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [fuelHistory, setFuelHistory] = useState<{ t: number; v: number }[]>([]);
  const [highwayGeoData, setLoadedGeo] = useState<any>(null);
  const [vehicleBatteryHistory, setVehicleBatteryHistory] = useState<{ t: number; v: number }[]>([]);
  const [batteryHistory, setBatteryHistory] = useState<{ t: number; v: number }[]>([]);
  const [isBatterySaverOpen, setIsBatterySaverOpen] = useState(false);
  const [batterySaverConfig, setBatterySaverConfig] = useState({
    autoStealth: true,
    reduceSync: true,
    darkenMap: false
  });
  const [pathAnalytics, setPathAnalytics] = useState<{ duration: number; delay: number; landslides: number; hazards?: any[]; provinceStats?: any[] } | null>(null);
  const [nearestIntersectionDist, setNearestIntersectionDist] = useState<number | null>(null);
  const [nearestHospitalDist, setNearestHospitalDist] = useState<number | null>(null);
  const [isSnapping, setIsSnapping] = useState(true);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [elevationProfile, setElevationProfile] = useState<number[]>([]);
  const [isElevationLoading, setIsElevationLoading] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [landslideSeverity, setLandslideSeverity] = useState<string>("medium");
  const [trafficIntensity, setTrafficIntensity] = useState<number>(1.0);
  const [fuelPrice, setFuelPrice] = useState<number>(175); // NPR per Liter
  const [isGreenRoute, setIsGreenRoute] = useState<boolean>(false);

  const totalPlannedDistance = useMemo(() => {
    let dist = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      dist += haversineDistance(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i + 1].lat, measurePoints[i + 1].lng);
    }
    return dist;
  }, [measurePoints]);

  /**
   * getSmoothedPath: Uses Quadratic Bezier interpolation to smooth waypoints
   */
  const getSmoothedPath = useCallback((pts: L.LatLng[]) => {
    if (pts.length < 3) return pts;
    const smoothed: L.LatLng[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];

      // Generate 5 intermediate points for a smooth curve
      for (let t = 0; t <= 1; t += 0.2) {
        const nextLat = p0.lat + (p1.lat - p0.lat) * t;
        const nextLng = p0.lng + (p1.lng - p0.lng) * t;

        // Apply slight curvature offset based on distance
        const offset = Math.sin(t * Math.PI) * 0.0001;
        smoothed.push(L.latLng(nextLat + offset, nextLng + offset));
      }
    }

    return smoothed;
  }, []);

  const displayPath = useMemo(() =>
    isRouteSmoothing ? getSmoothedPath(measurePoints) : measurePoints
    , [measurePoints, isRouteSmoothing, getSmoothedPath]);

  // 🌳 Spatial Index: Pre-indexes road segments into an R-tree for O(log N) snapping
  const segmentIndex = useMemo(() => {
    if (!geoJSON) return null;
    const tree = new RBush<SegmentItem>();
    const items: SegmentItem[] = [];

    const processCoordinates = (coords: number[][]) => {
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = { lat: coords[i][1], lng: coords[i][0] };
        const p2 = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
        items.push({
          minX: Math.min(p1.lng, p2.lng),
          minY: Math.min(p1.lat, p2.lat),
          maxX: Math.max(p1.lng, p2.lng),
          maxY: Math.max(p1.lat, p2.lat),
          p1,
          p2,
        });
      }
    };

    geoJSON.features.forEach((feature: any) => {
      const geom = feature.geometry;
      if (geom.type === "LineString") processCoordinates(geom.coordinates);
      else if (geom.type === "MultiLineString") geom.coordinates.forEach(processCoordinates);
    });

    tree.load(items);
    return tree;
  }, [geoJSON]);

  // 🌳 POI Spatial Index: Rapidly find nearby services
  const poiIndex = useMemo(() => {
    if (!serviceResults.length) return null;
    const tree = new RBush<POIItem>();
    const items: POIItem[] = serviceResults.map(poi => ({
      minX: poi.lng,
      minY: poi.lat,
      maxX: poi.lng,
      maxY: poi.lat,
      poi
    }));
    tree.load(items);
    return tree;
  }, [serviceResults]);

  const boardRef = useRef<HTMLDivElement>(null);
  const [activeContext, setActiveContext] = useState<'travel' | 'road' | 'service' | 'alert' | null>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [accentColor, setAccentColor] = useState(localStorage.getItem('merosadak_accent_color') || 'blue');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hoveredPathPoint, setHoveredPathPoint] = useState<L.LatLng | null>(null);
  const [hoveredElevation, setHoveredElevation] = useState<number | null>(null);
  const [hoveredGrade, setHoveredGrade] = useState<number | null>(null);
  const [hoveredRoll, setHoveredRoll] = useState<number>(0);
  const [hoveredBearing, setHoveredBearing] = useState<number>(0);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [leaderPath, setLeaderPath] = useState<Array<[number, number, number]>>([]);
  const [isFollowLeader, setIsFollowLeader] = useState(false);
  const lastSpokenMergeCandidateIdRef = useRef<string | null>(null); // New ref for merge audio
  const [leaderVisionTrigger, setLeaderVisionTrigger] = useState(0);

  // Quick Zoom State
  const [mapZoomState, setMapZoomState] = useState(13);
  const [zoomTouchStart, setZoomTouchStart] = useState<number | null>(null);
  const [isZooming, setIsZooming] = useState(false);

  // Mock Vehicle Health Data
  const [vehicleHealth, setVehicleHealth] = useState({
    fuelLevel: 68,
    engineTemp: 92,
    tirePressure: "Optimal",
    batteryVoltage: 14.2,
    oilLife: 85
  });

  const [geoJSON, setGeoJSON] = useState<RouteInfo | null>(null);
  const [routeAlternatives, setRouteAlternatives] = useState<any[]>([]);
  const [alternativeGeometries, setAlternativeGeometries] = useState<Record<string, any>>({});
  const [showAlternativesOnMap, setShowAlternativesOnMap] = useState(true);

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isNightVision, setIsNightVision] = useState(false);

  const fastestAlternative = useMemo(() => {
    if (!routeAlternatives.length) return null;
    return [...routeAlternatives].sort((a, b) => (a.estimatedDuration || Infinity) - (b.estimatedDuration || Infinity))[0];
  }, [routeAlternatives]);

  const timeDifference = useMemo(() => {
    if (!geoJSON || !fastestAlternative) return null;
    return fastestAlternative.estimatedDuration - geoJSON.duration;
  }, [geoJSON, fastestAlternative]);

  const [pilotMode, setPilotMode] = useState(false);

  /** 
   * Unified refresh handler: Performs partial cache purge and re-syncs data.
   * Triggered by the "scroll down" gesture on mobile.
   */
  const handlePullRefresh = useCallback(async () => {
    await purgeAppData();
    await refresh();
    addToast("success", "System Cache Purged & Data Refreshed");
  }, [refresh, addToast]);

  const { isPulling, isRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    distance: 80
  });

  const [showMapEngineSelector, setShowMapEngineSelector] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ message: string; pct: number } | null>(null);

  const [showDeployDashboard, setShowDeployDashboard] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showPreTripChecklist, setShowPreTripChecklist] = useState(false);
  const [showHighwayBrowser, setShowHighwayBrowser] = useState(false);
  const [selectedHighwayCode, setSelectedHighwayCode] = useState<string | null>(null);
  const [safetyScore, setSafetyScore] = useState(100);
  const [terrainGrade, setTerrainGrade] = useState(0);
  const [brakeHeat, setBrakeHeat] = useState(0);
  const brakeHeatRef = useRef(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastBrakeAlertRef = useRef(0);
  const lastSpeedKmhRef = useRef<number>(0);
  const lastEngineBrakeAlertRef = useRef(0);
  const lastEngineBrakeBonusRef = useRef<number>(0);
  const lastElevationRef = useRef<number | null>(null);
  const lastGradientAlertRef = useRef<number>(0);
  const lastSpokenDangerZone = useRef<string | null>(null);
  const lastSpeedRecordRef = useRef<number>(0);
  const safeDrivingAccumulator = useRef<number>(0);
  const gradeSamplesRef = useRef<{ grade: number; time: number }[]>([]);
  const safeStreakAccumulator = useRef<number>(0);
  const lastSafeCheckTimestamp = useRef<number>(Date.now());
  const lastCongestionAlert = useRef<number>(0);
  const lastSpokenIntersection = useRef<string | null>(null);
  const lastSpokenHazardId = useRef<string | null>(null);
  const [nextIntersection, setNextIntersection] = useState<{ distance: number; name: string } | null>(null);

  const prevLandslideCountRef = useRef(0);
  const prevRoadQualityRef = useRef<string | null>(null); // Add this ref for road quality
  const dragAnimationFrameRef = useRef<number>();
  // Safety & Path Tracking Refs
  const lowScoreTimerRef = useRef<number | null>(null);
  const lastChaseAlertRef = useRef<number>(0);
  const actualPathRef = useRef<[number, number, number, number][]>([]);
  const [tripEvents, setTripEvents] = useState<any[]>([]);

  const [smoothedSpeedLimit, setSmoothedSpeedLimit] = useState(80);
  const [routeData, setRouteData] = useState<any>(null);
  const [isLeader, setIsLeader] = useState(reminderService.isLeader());
  const [syncedTelemetry, setSyncedTelemetry] = useState<{ speed: number; heading: number } | null>(null);
  const [viewLock, setViewLock] = useState<'none' | 'telemetry' | 'report'>('none');
  const [safeTripKm, setSafeTripKm] = useState(0);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [showFinalReport, setShowFinalReport] = useState(false);
  const [rescueStatus, setRescueStatus] = useState<RescueStatus>(reminderService.getRescueStatus());
  const [nearbySafetyRamps, setNearbySafetyRamps] = useState<any[]>([]);
  const [nearbyRescuers, setNearbyRescuers] = useState<any[]>([]);
  const [activeAISubtitle, setActiveAISubtitle] = useState<string | null>(null);
  const [activeCriticalReminder, setActiveCriticalReminder] = useState<string | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<{ timestamp: number; intensity: number }[]>([]);
  const [isHazardNearby, setIsHazardNearby] = useState(false);
  const [isCollisionRisk, setIsCollisionRisk] = useState(false);
  const [nearbyGhostUsers, setNearbyGhostUsers] = useState<{ lat: number; lng: number; id: string; safetyScore?: number; mechanicalStress?: number }[]>([]);
  const [trafficPredictionData, setTrafficPredictionData] = useState<{ hour: string; intensity: number; precipitation: number }[]>([]);
  const [perfectScoreDuration, setPerfectScoreDuration] = useState(0); // New state for milestone
  const [milestoneAchieved, setMilestoneAchieved] = useState(false); // New state for milestone

  /** Performs a full system purge: Local Storage + Server Purge + Refresh */
  const handleSystemPurge = useCallback(async () => {
    if (window.confirm("Perform system-wide purge? This will clear all local data and attempt to reset system caches.")) {
      await clearAllStorage();
      if (isSuperadmin) await purge();
      addToast("success", "System cache cleared. Refreshing engine...");
      setTimeout(() => window.location.reload(), 1500);
    }
  }, [isSuperadmin, purge, addToast]);

  const handleHighwaySelect = useCallback(async (code: string) => {
    setSelectedHighwayCode(code);
    setHighwayReport(null);
    setGeoJsonData(null);
    setSelectedObject(null);

    setIsProcessing(true);
    try {
      const reportRes = await apiFetch(`/v1/highways/${code}/report?lang=${language}`);
      const geoRes = await apiFetch(`/v1/highways/${code}/geojson`);

      if (reportRes.data) {
        setHighwayReport(reportRes.data);
        setSelectedObject(reportRes.data);
        setActiveContext('road');
        setBoardDisplayState(BoardDisplayState.SPLIT);
      }
      if (geoRes.data) {
        setGeoJsonData(geoRes.data);
      }

      if (reminderService.isLeader()) {
        reminderService.broadcastContext({ highwayCode: code, viewMode: 'report' });
      }

      setShowHighwayBrowser(false);
      addToast("success", `Focusing on ${code}: ${reportRes.data?.name || ''}`);
    } catch (err) {
      addToast("error", "Failed to load highway details");
    } finally {
      setIsProcessing(false);
    }
  }, [addToast, i18n.language]);

  const handleShowAlternatives = useCallback(async () => {
    if (!geoJSON || !geoJSON.to) return;

    setIsProcessing(true);
    try {
      const from = geoJSON.admin?.localBody || "Kathmandu";
      const to = geoJSON.to.name;
      const altRes = await apiFetch(`/v1/route/alternatives?from=${from}&to=${to}&lang=${language}`);
      const alternatives = altRes.data || [];
      if (alternatives.length > 0) {
        setRouteAlternatives(alternatives);
        addToast("info", `Analyzing ${alternatives.length} potential alternative routes...`);

        const geoMap: Record<string, any> = {};
        const comparisonPayload = [];

        for (const alt of alternatives) {
          const geoRes = await apiFetch(`/v1/highways/${alt.code}/geojson`);
          if (geoRes.data) {
            geoMap[alt.code] = geoRes.data;
            const points = geoRes.data.features[0].geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
            comparisonPayload.push({ name: alt.code, points });
          }
        }

        setAlternativeGeometries(geoMap);

        const comparisonRes = await apiFetch("/v1/route/bulk-analytics", {
          method: "POST",
          body: JSON.stringify({
            routes: comparisonPayload,
            vehicleType: userProfile?.preferences?.vehicleType || 'car',
            landslideSeverity,
            trafficIntensity
          })
        });

        if (comparisonRes?.data?.routes) {
          setComparisonData(comparisonRes.data.routes);
        }
      }
    } catch (err) {
      addToast("error", "Unable to fetch alternative routes at this time.");
    } finally {
      setIsProcessing(false);
    }
  }, [geoJSON, addToast, i18n.language, userProfile, landslideSeverity, trafficIntensity]);

  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
      setUpdateAvailable(true);
    }
  }, []);

  const handleServiceSelect = useCallback((service: string) => {
    if (service === "highways") {
      setShowHighwayBrowser(true);
      setSidebarOpen(false);
      return;
    }
    setShowTraffic(service === "traffic");
    if (service) setBoardDisplayState(BoardDisplayState.SPLIT);
  }, []);

  // Refs for stable access in persistent geolocation callback
  const ghostModeRef = useRef(isGhostMode);
  const stealthModeRef = useRef(isStealthMode);
  useEffect(() => { ghostModeRef.current = isGhostMode; }, [isGhostMode]);
  useEffect(() => { stealthModeRef.current = isStealthMode; }, [isStealthMode]);

  /** Manually triggers a rebuild of the search index (Superadmin only) */
  const handleRefreshSearchIndex = useCallback(async () => {
    if (!isSuperadmin) return;
    setIsProcessing(true);
    try {
      // This calls a POST endpoint on the backend to trigger refreshIndexFromCaches
      const res = await apiFetch("/v1/search/refresh", { method: "POST" });
      if (res) {
        addToast("success", "Search index rebuild triggered successfully");
      }
    } catch (err) {
      addToast("error", "Failed to rebuild search index");
    } finally {
      setIsProcessing(false);
    }
  }, [isSuperadmin, addToast]);

  /** Specific handler for clearing map tile cache and local geometry */
  const handleTilePurge = useCallback(async () => {
    await purgeAppData();
    addToast("info", "Map tiles and local cache cleared.");
    // Brief delay then reload to force map engine re-initialization
    setTimeout(() => window.location.reload(), 800);
  }, [addToast]);

  // Define snap points based on screen height
  const getSnapHeights = useCallback(() => {
    if (window.innerHeight === 0) return { hidden: 0, minimized: 0, split: 0, expanded: 0 }; // Avoid division by zero
    const screenHeight = window.innerHeight;
    return {
      hidden: 0,
      minimized: 60, // e.g., 60px for just the handle
      split: screenHeight * 0.5,
      expanded: screenHeight * 0.8,
    };
  }, []);

  // Update currentBoardHeight when boardDisplayState changes
  useEffect(() => {
    const snapHeights = getSnapHeights();
    switch (boardDisplayState) {
      case BoardDisplayState.HIDDEN:
        setCurrentBoardHeight(snapHeights.hidden);
        break;
      case BoardDisplayState.MINIMIZED:
        setCurrentBoardHeight(snapHeights.minimized);
        break;
      case BoardDisplayState.SPLIT:
        setCurrentBoardHeight(snapHeights.split);
        break;
      case BoardDisplayState.EXPANDED:
        setCurrentBoardHeight(snapHeights.expanded);
        break;
    }
  }, [boardDisplayState, getSnapHeights]);

  // Recalculate snap heights on window resize
  useEffect(() => {
    const handleResize = () => {
      const snapHeights = getSnapHeights();
      // Adjust currentBoardHeight if it's not hidden, to maintain relative position
      if (boardDisplayState !== BoardDisplayState.HIDDEN) {
        // This is a simplified approach; a more robust solution might re-snap to the closest state
        // or maintain the current percentage. For now, let's re-snap to the current state.
        switch (boardDisplayState) {
          case BoardDisplayState.MINIMIZED:
            setCurrentBoardHeight(snapHeights.minimized);
            break;
          case BoardDisplayState.SPLIT:
            setCurrentBoardHeight(snapHeights.split);
            break;
          case BoardDisplayState.EXPANDED:
            setCurrentBoardHeight(snapHeights.expanded);
            break;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [boardDisplayState, getSnapHeights]);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    initializeStorage();
    themeService.applyToDocument();
    HotUpdateManager.init();

    // Set initial board height to split view
    setCurrentBoardHeight(getSnapHeights().split);

    // Listen for service worker updates and activation

    // Check for onboarding completion
    if (!hasCompletedOnboarding()) {
      setShowPreferences(true);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Start continuous tracking for speed and heading
    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed, // meters per second
          heading: pos.coords.heading, // degrees clockwise from North
          elevation: pos.coords.altitude || 1350 // Mocking Kathmandu altitude as base
        };
        setCurrentUserLocation(newLoc);

        // 🛰️ Broadcast location to offline peers
        if (isP2PConnected) {
          broadcastLocation(newLoc.lat, newLoc.lng, userProfile?.name || 'Group Member');
        }

        // 🏎️ Speed Smoothing (Exponential Moving Average)
        // Alpha 0.2 provides a good balance between responsiveness and jitter reduction
        const rawSpeedKmh = (pos.coords.speed || 0) * 3.6;
        setSmoothedSpeed(prev => {
          return prev === 0 ? rawSpeedKmh : (prev * 0.8) + (rawSpeedKmh * 0.2);
        });

        if (reminderService.isLeader() && !stealthModeRef.current) {
          reminderService.broadcastTelemetry((pos.coords.speed || 0) * 3.6, pos.coords.heading || 0, pos.coords.latitude, pos.coords.longitude);
        }

        // 👻 Ghost Mode: Broadcast location to fleet via WebSocket
        if (ghostModeRef.current && sendMessage) {
          sendMessage({
            type: 'ghost_update',
            userId: user?.id || 'guest',
            lat: newLoc.lat,
            lng: newLoc.lng,
            heading: newLoc.heading,
            speed: (pos.coords.speed || 0) * 3.6,
            safetyScore: safetyScoreRef.current,
            mechanicalStress: mechanicalStressRef.current
          });
        }
      },
      (err) => console.error("[Geo] Watch failed:", err),
      { enableHighAccuracy: true }
    );

    setAppReady(true);

    // ⛽ Live Fuel Price Sync: Fetches latest market rates from Nepal Oil Corp data via backend
    const syncFuelPrices = async () => {
      try {
        const res = await apiFetch("/v1/fuel-prices");
        if (res?.data?.petrol) {
          setFuelPrice(res.data.petrol);
        }
      } catch (err) {
        console.warn("[System] Could not sync live fuel prices, using default rates.");
      }
    };

    syncFuelPrices();

    // 🛰️ Load Master Highway GeoJSON for Offline Use
    const loadMasterGeoJSON = async () => {
      try {
        // 1. Try to load from persistent storage first (Instant Load)
        const cachedData = await persistentStorage.get('master_highways');
        if (cachedData) {
          setMasterHighwayGeoJSON(cachedData);
          console.log("[System] Master highways loaded from persistent local cache.");
        }

        // 2. Fetch fresh data from network in background
        const res = await apiFetch("/v1/highways/master");
        if (res.data) {
          setMasterHighwayGeoJSON(res.data);
          // 3. Update the persistent cache for the next session
          await persistentStorage.save('master_highways', res.data);
        }
      } catch (err) {
        console.warn("[System] Background highway sync failed, using last known cache.");
      }
    };
    loadMasterGeoJSON();

    // 🔄 Automatic Data Polling: Refreshes incidents every 5 minutes
    const pollInterval = setInterval(() => {
      refresh();
      if (reminderService.isLeader()) {
        console.log("[System] Periodic telemetry & incident sync performed.");
      }
    }, 300000); // 5 minutes

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      clearInterval(pollInterval);
    };
  }, [getSnapHeights, handleServiceWorkerMessage, refresh]);

  // ⌨️ Keyboard Modifier Tracking: Detect Shift for Map "Fly-To" mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 🤝 Proximity-based Audio Welcome Message for Convoy Merge
  useEffect(() => {
    if (mergeCandidate && !isMuted && 'speechSynthesis' in window) {
      // Only speak if it's a new merge candidate or if the previous one was dismissed
      if (mergeCandidate.id !== lastSpokenMergeCandidateIdRef.current) {
        const msg = `Convoy detected: ${mergeCandidate.name} is ${mergeCandidate.distance.toFixed(1)} kilometers away.`;
        const utterance = new SpeechSynthesisUtterance(msg);
        window.speechSynthesis.speak(utterance);
        lastSpokenMergeCandidateIdRef.current = mergeCandidate.id;
        addToast("info", `Convoy detected: ${mergeCandidate.name} nearby!`);
      }
    } else if (!mergeCandidate) {
      lastSpokenMergeCandidateIdRef.current = null; // Reset when no merge candidate is active
    }
  }, [mergeCandidate, isMuted, addToast]);

  // 🛣️ Offline Route Sync: Broadcast planned polyline to group members
  useEffect(() => {
    if (isP2PConnected && measurePoints.length > 1) {
      broadcastRoute(measurePoints.map(p => ({ lat: p.lat, lng: p.lng })), isLeader ? '#6366f1' : '#f59e0b');
    }
  }, [measurePoints, isP2PConnected, isLeader, broadcastRoute]);

  // Trigger Safety Milestone Notification
  useEffect(() => {
    if (perfectScoreDuration >= 600 && !milestoneAchieved) { // 600 seconds = 10 minutes
      addToast("success", "🏆 Safety Milestone: 10 minutes of perfect driving!");
      setMilestoneAchieved(true);
    }
  }, [perfectScoreDuration, milestoneAchieved, addToast]);

  // Centralized Reminder Handling
  useEffect(() => {
    const unsubscribe = reminderService.subscribe((reminder, leaderStatus, telemetry, syncContext: SyncContext) => {
      // Update local state to sync UI (badges, etc.)
      setIsLeader(leaderStatus);

      if (syncContext?.globalMessage && !leaderStatus) {
        addToast("info", `System Broadcast: ${syncContext.globalMessage}`);
      }

      // Handle Mirroring Context (Selected Highways)
      if (syncContext && !leaderStatus) {
        if (syncContext.highwayCode && syncContext.highwayCode !== selectedHighwayCode) {
          if (syncContext.highwayCode) handleHighwaySelect(syncContext.highwayCode);
        }
        if (syncContext.viewMode) setViewLock(syncContext.viewMode); // viewLock type is already correct
        if (syncContext.ghostMode !== undefined) setIsGhostMode(syncContext.ghostMode);

        // Emergency Remote Shutdown Listener
        if (syncContext.remoteShutdown === reminderService.getTabId()) {
          setPilotMode(false);
          setShowFinalReport(true);
          setBoardDisplayState(BoardDisplayState.HIDDEN);
          addToast("error", "Remote Shutdown Initiated by System Admin");
        }

        // Remote Theme/View Sync
        if (syncContext.nightVision !== undefined) setIsNightVision(syncContext.nightVision);

        // Sync Stealth Mode across tabs
        if (syncContext.stealthMode !== undefined) setIsStealthMode(syncContext.stealthMode);

        // Sync rescuers from leader if SOS active
        if (syncContext.rescuers) {
          setNearbyRescuers(syncContext.rescuers);
        }

        // Remote POV Trigger: Followers forced into HUD mode
        if (syncContext.remoteHUDMode) {
          setIsCompactHUD(syncContext.remoteHUDMode === 'compact');
        }

        // Remote SOS Signal: If any tab triggers SOS, open HUD for everyone
        // Critical Alert Sync: Trigger SOSOverlay on followers if leader activates it
        if (syncContext.sosActive && !leaderStatus) {
          if (rescueStatus === 'idle') { // Only trigger if not already in an SOS state
            setRescueStatus('dispatched'); // Or 'remote_sos' if you want a distinct state
            setPilotMode(true);
            setBoardDisplayState(BoardDisplayState.EXPANDED);
          }
        }
        const currentRescueStatus = reminderService.getRescueStatus(); // Update local status from service
        setRescueStatus(currentRescueStatus);

        if (currentRescueStatus !== 'idle') {
          setBoardDisplayState(BoardDisplayState.EXPANDED);
          setPilotMode(true);
          // Note: SOSOverlay should ideally be opened via global status listener
        }

        // 📳 Feature 1: Haptic Mirror - Followers vibrate on Leader hazard detections
        if (syncContext.hapticPulse && 'vibrate' in navigator) {
          const patterns = {
            low: [50],
            medium: [150, 80, 150],
            high: [300, 100, 300, 100, 300]
          };
          navigator.vibrate(patterns[hapticIntensity]);
        }

        if (syncContext.aiSubtitle) {
          setActiveAISubtitle(syncContext.aiSubtitle);
          setTimeout(() => setActiveAISubtitle(null), 8000); // Subtitles clear after 8s
        }
      }

      if (telemetry && !leaderStatus) {
        setSyncedTelemetry(telemetry); // telemetry is already typed
      }

      if (!reminder) return; // Sync heartbeat, no action needed
      const message = `Reminder: ${reminder.task}`;

      // Critical Alerts bypass everything
      if (reminder.isCritical) {
        if (leaderStatus && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(message);
          window.speechSynthesis.speak(utterance);
        }
        setActiveCriticalReminder(message);
        addToast("error", message); // UI alerts show on all tabs
        return;
      }

      // Non-critical silenced by DND
      if (!isDoNotDisturb) {
        if (leaderStatus && Notification.permission === 'granted') {
          new Notification('MeroSadak', { body: message });
        }
        addToast("success", message);
      }
    });

    return () => unsubscribe();
  }, [isDoNotDisturb, isLeader, selectedHighwayCode, handleHighwaySelect, hapticIntensity, isCompactHUD, addToast]);

  // Broadcast Haptic Pulse to followers when a critical hazard appears (Leader Only)
  useEffect(() => {
    if (activeCriticalReminder) {
      if (isLeader) {
        reminderService.broadcastHapticPulse();
      }

      // Vibrate current tab (Leader or Follower) based on intensity
      if ('vibrate' in navigator) {
        const patterns = {
          low: [50],
          medium: [150, 80, 150],
          high: [300, 100, 300, 100, 300]
        };
        navigator.vibrate(patterns[hapticIntensity]);
      }
    }
  }, [isLeader, activeCriticalReminder, hapticIntensity]);

  // Apply View Lock to Follower UI
  useEffect(() => {
    if (isLeader) return;

    if (viewLock === 'telemetry') {
      setPilotMode(true);
    } else if (viewLock === 'report') {
      setPilotMode(false);
      setBoardDisplayState(BoardDisplayState.SPLIT);
      setActiveContext('road');
    }
  }, [viewLock, isLeader]);

  // 📡 WebSocket Message Handler: Responds to real-time incident broadcasts
  useEffect(() => {
    if (lastMessage?.type === 'progress') {
      setSyncProgress({ message: lastMessage.message, pct: lastMessage.percentage });
      // Auto-hide progress bar 3 seconds after reaching 100%
      if (lastMessage.percentage === 100) {
        setTimeout(() => setSyncProgress(null), 3000);
      }
    } else if (lastMessage?.type === 'road_update' || lastMessage?.type === 'system') {
      refresh(); // Triggers useNepalData refresh
      addToast(lastMessage.type === 'system' ? "info" : "success", lastMessage.message || "Live update received");
    } else if (lastMessage?.type === 'ghost_locations' && lastMessage.users) {
      setNearbyGhostUsers(lastMessage.users);
    }
  }, [lastMessage, refresh, addToast]);

  // 🏎️ Vehicle Telemetry Monitor: Tracks vehicle battery health history (OBD-II simulation)
  useEffect(() => {
    if (!pilotMode) return;

    const interval = setInterval(() => {
      setVehicleHealth(prev => {
        // Simulate minor voltage fluctuations based on alternator load (13.8V - 14.6V)
        const nextVolt = parseFloat((13.8 + Math.random() * 0.8).toFixed(1));
        setVehicleBatteryHistory(prevHist => [...prevHist.slice(-19), { t: Date.now(), v: nextVolt }]);

        // Simulate fuel consumption (gradual drain based on speed)
        const speedKmh = (currentUserLocation?.speed || 0) * 3.6;
        const consumption = speedKmh > 5 ? 0.02 : 0.005;
        const nextFuel = Math.max(0, parseFloat((prev.fuelLevel - consumption).toFixed(2)));
        setFuelHistory(prevHist => [...prevHist.slice(-19), { t: Date.now(), v: nextFuel }]);

        return { ...prev, batteryVoltage: nextVolt, fuelLevel: nextFuel };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [pilotMode, currentUserLocation?.speed]);

  // 🔋 Battery-Aware Auto-Stealth: Activates power-saving view if battery is low
  useEffect(() => {
    if (!('getBattery' in navigator)) return;

    const handleBatteryLogic = (battery: any) => {
      const currentLevel = Math.round(battery.level * 100);
      setBatteryLevel(currentLevel);

      // Initialize history with the current level
      setBatteryHistory([{ t: Date.now(), v: currentLevel }]);

      const checkLevel = () => {
        const level = Math.round(battery.level * 100);
        setBatteryLevel(level);

        // Record historical data point (keep last 20 state changes)
        setBatteryHistory(prev => [...prev.slice(-19), { t: Date.now(), v: level }]);

        // Automatically engage Stealth Mode at 15% if autoStealth is enabled
        if (level <= 15 && !isStealthMode && batterySaverConfig.autoStealth) {
          setIsStealthMode(true);
          addToast("warning", "Battery Saver Active: Disabling 3D map, terrain overlays, and high-frequency sync to extend device range.");
          if (reminderService.isLeader()) {
            reminderService.broadcastStealthMode(true);
          }
        }
      };

      checkLevel();
      battery.addEventListener('levelchange', checkLevel);
      return () => battery.removeEventListener('levelchange', checkLevel);
    };

    let cleanup: (() => void) | undefined;
    (navigator as any).getBattery().then((battery: any) => {
      cleanup = handleBatteryLogic(battery);
    });

    return () => cleanup?.();
  }, [isStealthMode, addToast]);

  // ☀️ Adaptive Sunshine Intensity Monitor: Suggests High Contrast based on contextual irradiance
  useEffect(() => {
    if (!currentUserLocation || isHighContrast || isNightVision) return;

    const checkSunshineIntensity = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentUserLocation.lat}&longitude=${currentUserLocation.lng}&current=shortwave_radiation`);
        const data = await res.json();

        const radiation = data?.current?.shortwave_radiation || 0; // Measured in W/m²

        // 🧠 Adaptive Threshold Logic: Glare is relative to season and angle
        const now = new Date();
        const month = now.getMonth();
        const hour = now.getHours();

        let dynamicThreshold = 750; // Base threshold (W/m²)

        // Season adjustment: Summer (Mar-Jun) has higher ambient brightness
        if (month >= 2 && month <= 5) dynamicThreshold = 850;
        // Winter adjustment: Glare is perceived as more intense due to lower sun angles
        else if (month >= 11 || month <= 1) dynamicThreshold = 650;

        // Time of Day adjustment: Lower threshold in morning/evening when sun angle causes maximum glare
        if (hour < 10 || hour > 16) dynamicThreshold -= 100;

        if (radiation > dynamicThreshold) {
          addToast("info", "Intense sunlight detected. Switch to High Contrast for better visibility?");
        }
      } catch (err) {
        console.warn("[Sunshine] Sensor poll failed", err);
      }
    };

    checkSunshineIntensity();
    const interval = setInterval(checkSunshineIntensity, 900000); // Check every 15 minutes
    return () => clearInterval(interval);
  }, [currentUserLocation, isHighContrast, isNightVision, addToast]);

  // 🔗 Shareable Link Loader: Parse points from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathData = params.get('path');
    if (pathData) {
      try {
        // Using lz-string to decompress the coordinate array from the URL
        const decompressed = LZString.decompressFromEncodedURIComponent(pathData || "");
        const decoded = JSON.parse(decompressed || "[]");
        if (Array.isArray(decoded)) {
          const pts = decoded.map((p: any) => L.latLng(p[0], p[1]));
          setMeasurePoints(pts);
          setIsMeasuring(true);
          addToast("success", "Loaded shared measurement path");
        }
      } catch (e) {
        console.error("Failed to parse shared path", e);
      }
    }
  }, [addToast]);

  /** 📋 Copy Current Location Helper */
  const handleCopyLocation = useCallback(() => {
    if (currentUserLocation) {
      const lat = currentUserLocation.lat.toFixed(6);
      const lng = currentUserLocation.lng.toFixed(6);
      const shareUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      navigator.clipboard.writeText(shareUrl);
      addToast("success", "Location link copied to clipboard!");
    } else {
      addToast("error", "Location not available. Ensure GPS is enabled.");
    }
  }, [currentUserLocation, addToast]);

  // 🛡️ Snap to Road Logic Helper
  const findSnappedPoint = useCallback((latlng: L.LatLng, zoom: number): { point: L.LatLng, nodeDist: number | null, hospitalDist: number | null } => {
    if (!isSnapping) return { point: latlng, nodeDist: null, hospitalDist: null };

    let closest: L.LatLng = latlng;
    let minDistance = Infinity;
    let minNodeDistance = Infinity;
    let minHospitalDist = Infinity;
    let snappedToNode = false;

    // Dynamic Thresholds: Scale thresholds based on zoom (Reference: Zoom 14)
    // At higher zoom (18), thresholds become smaller/tighter.
    // At lower zoom (10), thresholds become larger/easier to catch.
    const zoomFactor = Math.pow(2, 14 - zoom);

    const roadThresholdKm = 0.15 * zoomFactor;
    const nodeThresholdKm = 0.04 * zoomFactor;
    const poiThresholdKm = 0.05 * zoomFactor;

    // CUSTOMIZATION: We increase the base to 0.6 km and use a slightly more 
    // aggressive scaling (base 2.5 instead of 2.0). This makes hospitals 
    // much easier to "catch" when looking at a wider map area.
    const emergencyThresholdKm = 0.6 * Math.pow(2.5, 14 - zoom);

    const searchBox = {
      minX: latlng.lng - (poiThresholdKm / 98), // Approximation for Nepal longitude
      minY: latlng.lat - (poiThresholdKm / 111),
      maxX: latlng.lng + (poiThresholdKm / 98),
      maxY: latlng.lat + (poiThresholdKm / 111),
    };

    // 1. Check for nearby POIs first (Snap to Point)
    if (poiIndex) {
      const candidates = poiIndex.search(searchBox);
      candidates.forEach(({ poi }) => {
        if (poi.lat && poi.lng) {
          const dist = haversineDistance(latlng.lat, latlng.lng, poi.lat, poi.lng);

          const isHospital = poi.type === 'hospital' || poi.group === 'Medical';
          const threshold = (isEmergencyMode && isHospital) ? emergencyThresholdKm : poiThresholdKm;

          if (isHospital && dist < minHospitalDist) {
            minHospitalDist = dist;
          }

          if (dist < minDistance && dist <= threshold) {
            minDistance = dist;
            closest = L.latLng(poi.lat, poi.lng);
          }
        }
      });
      // If we found a POI (or priority hospital) within the threshold, return it immediately
      const currentThreshold = isEmergencyMode ? emergencyThresholdKm : poiThresholdKm;
      if (minDistance <= currentThreshold) {
        return { point: closest, nodeDist: null, hospitalDist: minHospitalDist !== Infinity ? minHospitalDist : null };
      }
    }

    // 2. Fallback to Road Snapping (R-tree optimized)
    if (!geoJSON || !segmentIndex) return { point: latlng, nodeDist: null, hospitalDist: minHospitalDist !== Infinity ? minHospitalDist : null };

    // Convert 150m threshold to approximate degree bounding box
    // 1 deg lat is ~111km. 1 deg lng varies based on latitude (approx 98km in Nepal)
    const latDelta = roadThresholdKm / 111.32;
    const lngDelta = roadThresholdKm / (111.32 * Math.cos(latlng.lat * (Math.PI / 180)));

    const roadSearchBox = {
      minX: latlng.lng - lngDelta,
      minY: latlng.lat - latDelta,
      maxX: latlng.lng + lngDelta,
      maxY: latlng.lat + latDelta,
    };

    // Optimized Search: Only calculate distances for segments within the R-tree search box
    const candidates = segmentIndex.search(roadSearchBox);

    candidates.forEach((item) => {
      const A = item.p1;
      const B = item.p2;

      // --- Phase 1: Vertex (Intersection) Snapping ---
      // intersections are represented by the start/end nodes of LineStrings.
      // By checking these first, the cursor "jumps" to the exact junction.
      [A, B].forEach(node => {
        const d = haversineDistance(latlng.lat, latlng.lng, node.lat, node.lng);
        if (d < minNodeDistance) {
          minNodeDistance = d;
        }
        // Priority: If within node threshold, snap exactly to the junction
        if (d < minDistance && d <= nodeThresholdKm) {
          minDistance = d;
          closest = L.latLng(node.lat, node.lng);
          snappedToNode = true;
        }
      });

      // If we are extremely close to an intersection (< 10m), 
      // skip the line projection for maximum performance.
      if (snappedToNode && minDistance < 0.01) return;

      // --- Phase 2: Vector Projection (Road Snapping) ---
      const vX = B.lng - A.lng;
      const vY = B.lat - A.lat;
      if (vX === 0 && vY === 0) return;

      const wX = latlng.lng - A.lng;
      const wY = latlng.lat - A.lat;

      let t = (wX * vX + wY * vY) / (vX * vX + vY * vY);
      t = Math.max(0, Math.min(1, t));

      const snapped = L.latLng(A.lat + t * vY, A.lng + t * vX);
      const dist = haversineDistance(latlng.lat, latlng.lng, snapped.lat, snapped.lng);

      if (dist < minDistance) {
        minDistance = dist;
        closest = snapped;
      }
    });

    return {
      point: minDistance <= roadThresholdKm ? closest : latlng,
      nodeDist: minNodeDistance !== Infinity ? minNodeDistance : null,
      hospitalDist: minHospitalDist !== Infinity ? minHospitalDist : null
    };
  }, [geoJSON, isSnapping, segmentIndex, serviceResults, isEmergencyMode]);

  // 📈 Debounced Elevation Fetching: Updates the profile as points are added
  useEffect(() => {
    // Only fetch if we have at least 2 points to form a path
    if (measurePoints.length < 2) {
      setElevationProfile([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsElevationLoading(true);
      try {
        const res = await apiFetch("/v1/route/analytics", {
          method: "POST",
          // Passing vehicle type for customized incident search radius
          body: JSON.stringify({
            points: measurePoints.map(p => ({ lat: p.lat, lng: p.lng })),
            vehicleType: userProfile?.preferences?.vehicleType || 'car',
            landslideSeverity,
            trafficIntensity
          })
        });

        // Error handling: Check if the response contains the expected profile data
        if (res?.data?.elevationProfile && Array.isArray(res.data.elevationProfile)) {
          const profile = res.data.elevationProfile.map((p: any) => p.elevation || 0);
          setElevationProfile(profile);
          setPathAnalytics(res.data);
        } else {
          // Handles cases where API returns null or empty sets
          throw new Error("Invalid or null elevation data received");
        }
      } catch (err) {
        console.error("[Elevation] Fetch failed:", err);
        addToast("error", "Terrain data unavailable. Falling back to flat map.");
        // Fallback: Fill with 0s to prevent visualization crashes
        setElevationProfile(new Array(measurePoints.length).fill(0));
      } finally {
        setIsElevationLoading(false);
      }
    }, 800); // 800ms debounce: avoids API spamming during rapid map clicks

    return () => clearTimeout(handler);
  }, [measurePoints, addToast, landslideSeverity, trafficIntensity]);

  /** 🛣️ Automatic Rerouting to Avoid Landslides */
  const handleAvoidLandslides = useCallback(async () => {
    if (measurePoints.length < 2) return;

    // 1. Leverage comparisonData if a safer alternative was already analyzed
    if (comparisonData && comparisonData.length > 0) {
      const bestSafeRoute = [...comparisonData]
        .filter(r => r.points && r.points.length > 0)
        .sort((a, b) => {
          if (a.landslides !== b.landslides) return a.landslides - b.landslides;
          return a.duration - b.duration;
        })[0];

      if (bestSafeRoute && bestSafeRoute.landslides < (pathAnalytics?.landslides || 99)) {
        setMeasurePoints(bestSafeRoute.points.map((p: any) => L.latLng(p.lat, p.lng)));
        addToast("success", `Rerouted to ${bestSafeRoute.name} to bypass landslides.`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      const start = measurePoints[0];
      const end = measurePoints[measurePoints.length - 1];

      const res = await apiFetch("/v1/route/plan", {
        method: "POST",
        body: JSON.stringify({ from: start, to: end, avoidLandslides: true, prioritizeCO2: isGreenRoute })
      });

      if (res.data?.points) {
        setMeasurePoints(res.data.points.map((p: any) => L.latLng(p.lat, p.lng)));
        addToast("success", "Path rerouted to avoid active landslides");
      }
    } catch (e) {
      addToast("error", "Could not find a safe alternative path");
    } finally {
      setIsProcessing(false);
    }
  }, [measurePoints, addToast, isGreenRoute, comparisonData, pathAnalytics]);

  // 🛡️ Proactive Safety: Auto-reroute if new landslides are detected during transit
  useEffect(() => {
    const currentLandslides = pathAnalytics?.landslides || 0;
    if (pilotMode && currentLandslides > prevLandslideCountRef.current) {
      addToast("warning", "New terrain hazard detected. Recalculating safe alternative...");
      handleAvoidLandslides();
    }
    prevLandslideCountRef.current = currentLandslides;
  }, [pilotMode, pathAnalytics?.landslides, handleAvoidLandslides, addToast]);

  // 🛡️ Proactive Safety: Auto-reroute if roadQuality drops to 'F'
  useEffect(() => {
    const currentQuality = highwayReport?.qualityGrade;
    if (pilotMode && currentQuality === 'F' && prevRoadQualityRef.current !== 'F') {
      addToast("warning", "Critical road quality detected (Grade F). Recalculating safer route...");
      handleAvoidLandslides();
    }
    prevRoadQualityRef.current = currentQuality;
  }, [pilotMode, highwayReport?.qualityGrade, handleAvoidLandslides, addToast]);


  // Real-time Navigation Logic: Telemetry, Safety Alerts & Streak Recovery
  useEffect(() => {
    if (pilotMode && currentUserLocation && geoJSON?.features) {
      const currentSpeedKmh = (currentUserLocation.speed || 0) * 3.6;
      const speedLimit = smoothedSpeedLimit;
      const now = Date.now();
      const isSpeeding = currentSpeedKmh > speedLimit + 5;
      const isMoving = currentSpeedKmh > 5;

      // 0. Terrain Safety Alert: Steep Descent & Brake Temperature Warning & Ramp Detection
      const currentElevation = currentUserLocation.elevation || 0;
      if (lastElevationRef.current !== null && isMoving && lastPositionRef.current) {
        const elevationDiff = currentElevation - lastElevationRef.current;

        const horizontalDist = haversineDistance(
          lastPositionRef.current.lat, lastPositionRef.current.lng,
          currentUserLocation.lat, currentUserLocation.lng
        );

        if (horizontalDist > 0.002) { // Movement threshold for grade calculation
          const rawGrade = (elevationDiff / (horizontalDist * 1000)) * 100;
          const nowTs = Date.now();

          // 🏔️ Terrain Grade Smoothing: GPS/Barometric altitude is often noisy.
          // We use a 5-second sliding window to provide a stable gradient for the HUD and safety logic.
          gradeSamplesRef.current.push({ grade: rawGrade, time: nowTs });
          gradeSamplesRef.current = gradeSamplesRef.current.filter(s => nowTs - s.time < 5000);

          const grade = gradeSamplesRef.current.reduce((sum, s) => sum + s.grade, 0) / gradeSamplesRef.current.length;
          setTerrainGrade(grade);

          // Cumulative Brake Heat Logic: Increase heat during steep descents
          if (grade < -4) { // eslint-disable-line no-console
            const heatGain = (Math.abs(grade) * (currentSpeedKmh / 50));
            brakeHeatRef.current += heatGain;

            /**
             * 0a. Descent Recovery Bonus Logic
             * If grade is steep (< -7%) and current speed is lower or equal to 
             * previous speed (indicating active gear/engine braking), award bonus.
             */
            if (grade < -7 && currentSpeedKmh <= lastSpeedKmhRef.current + 1) {
              if (now - lastEngineBrakeBonusRef.current > 60000) { // Once per minute
                setSafetyScore(prev => Math.min(100, prev + 2));
                setTripEvents(prev => [...prev, {
                  type: 'recovery',
                  title: 'Safe Engine Braking Technique',
                  lat: currentUserLocation.lat,
                  lng: currentUserLocation.lng,
                  time: new Date().toLocaleTimeString(),
                  score: 2
                }]);
                addToast("success", "Descent Bonus: +2 PTS");
                lastEngineBrakeBonusRef.current = now;
              }
            }

            // 0b. Engine Braking Warning: Trigger if speed increases on steep descent
            if (grade < -7 && currentSpeedKmh > lastSpeedKmhRef.current + 3 && now - lastEngineBrakeAlertRef.current > 30000) {
              const gearMsg = "Engine braking reminder: Speed is increasing on a steep descent. Please downshift to a lower gear.";
              if (!isMuted && 'speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(gearMsg));
              }
              addToast("warning", "Use Engine Braking");
              lastEngineBrakeAlertRef.current = now;
            }
          } else {
            brakeHeatRef.current = Math.max(0, brakeHeatRef.current - 0.5); // Natural cooling
          }

          // 0c. Safe KM Tracking: Accumulate distance if behavior is safe
          if (!isSpeeding && !approachingDanger) {
            setSafeTripKm(prev => prev + horizontalDist);
          }

          // 0d. Active Rescuer Deployment: Mock movement towards user if SOS dispatched
          if (reminderService.getRescueStatus() === 'dispatched' && nearbyRescuers.length > 0) {
            setNearbyRescuers(prev => prev.map(res => ({
              ...res,
              lat: res.lat + (currentUserLocation.lat - res.lat) * 0.05,
              lng: res.lng + (currentUserLocation.lng - res.lng) * 0.05
            })));
          }

          // 0b. Runaway Ramp Detection: Trigger markers if heat is critical
          if (brakeHeatRef.current > 140) {
            // Mock logic: find turnouts within 2km of current path
            const ramps = [
              { id: 'ramp1', name: 'Safety Ramp 04', lat: currentUserLocation.lat + 0.004, lng: currentUserLocation.lng + 0.004 },
              { id: 'ramp2', name: 'Safety Turnout 12', lat: currentUserLocation.lat - 0.003, lng: currentUserLocation.lng + 0.008 }
            ];
            setNearbySafetyRamps(ramps);
          } else {
            setNearbySafetyRamps([]);
          }

          setBrakeHeat(brakeHeatRef.current);

          // Trigger Overheat Warning
          if (brakeHeatRef.current > 180 && !isMuted && now - lastBrakeAlertRef.current > 60000) {
            const msg = "Brake temperature warning: Cumulative descent detected. Please find a safe turnout to cool your brakes and use engine braking.";
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
            addToast("error", "Brake Overheat Warning");
            lastBrakeAlertRef.current = now;
          }
        }

        // Simple Steep Drop Alert
        if (elevationDiff < -12 && !isMuted && now - lastGradientAlertRef.current > 45000) {
          const utterance = new SpeechSynthesisUtterance("Caution: Steep descent ahead. Please use low gear.");
          window.speechSynthesis.speak(utterance);
          lastGradientAlertRef.current = now;
          addToast("warning", "Steep Descent Alert");
        }
      }
      lastElevationRef.current = currentElevation;
      lastSpeedKmhRef.current = currentSpeedKmh;
      lastPositionRef.current = { lat: currentUserLocation.lat, lng: currentUserLocation.lng };

      // 6. Police Chase Logic: Low safety score duration
      if (safetyScore < 20) {
        if (!lowScoreTimerRef.current) lowScoreTimerRef.current = Date.now();
        const lowDuration = Date.now() - lowScoreTimerRef.current;

        if (lowDuration > 25000 && Date.now() - lastChaseAlertRef.current > 45000) {
          if (!isMuted && 'speechSynthesis' in window) {
            const chaseMsg = "Critical safety violation. Police units have been alerted to your trajectory. Pull over immediately.";
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(chaseMsg));
          }
          addToast("error", "POLICE INTERCEPT ACTIVE");
          lastChaseAlertRef.current = Date.now();
        }
      } else {
        lowScoreTimerRef.current = null;
      }

      // 7. Path Recording
      actualPathRef.current.push([
        currentUserLocation.lat,
        currentUserLocation.lng,
        Math.round((currentUserLocation.speed || 0) * 3.6),
        Math.round(currentUserLocation.elevation || 1350)
      ]);

      // 1. Traffic Congestion Audio Alert
      if (!isMuted && 'speechSynthesis' in window && currentSpeedKmh > 10 && currentSpeedKmh < speedLimit * 0.5) {
        if (now - lastCongestionAlert.current > 120000) { // Limit to once every 2 minutes
          const utterance = new SpeechSynthesisUtterance("Traffic congestion detected. Drive safely.");
          window.speechSynthesis.speak(utterance);
          lastCongestionAlert.current = now;
        }
      }

      // 📳 Tactical Haptic Warning: Triggered on extreme congestion (Intensity > 2.5)
      if (trafficIntensity > 2.5) {
        if (now - lastCongestionAlert.current > 60000) {
          if (isLeader) {
            reminderService.broadcastHapticPulse();
          }
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          addToast("warning", "Severe Congestion: Haptic Alert Active");
          lastCongestionAlert.current = now;
        }
      }

      // 2. Safety Score: Speeding Penalty (Gradual drain)
      // ⛈️ Weather Penalty Multiplier: Penalties are more severe in snow or heavy rain
      const weatherMultiplier = (() => {
        if (!weatherData) return 1.0;
        const cond = (weatherData.condition || "").toLowerCase();
        const intensity = weatherData.intensity || 0;
        if (cond.includes('snow') || intensity > 15) return 2.5; // Extreme Risk
        if (cond.includes('rain') || intensity > 5) return 1.5;   // Moderate Risk
        return 1.0;
      })();

      if (isSpeeding) {
        // Penalty scales with terrain risk: Descents (< -3%) increase the penalty significantly
        const riskMultiplier = terrainGrade < -7 ? 3.0 : terrainGrade < -3 ? 1.5 : 1.0;

        // Apply the weather multiplier to the speed penalty
        const totalPenalty = 0.05 * riskMultiplier * weatherMultiplier;
        setSafetyScore(prev => Math.max(0, prev - totalPenalty));

        // Sample speeding violation location every 20s to avoid UI clutter
        const nowMs = Date.now();
        if (nowMs - lastSpeedRecordRef.current > 20000) {
          setTripEvents(prev => [...prev, {
            type: 'penalty',
            title: 'Speeding Violation',
            lat: currentUserLocation.lat,
            lng: currentUserLocation.lng,
            time: new Date().toLocaleTimeString(),
            score: -1
          }]);
          lastSpeedRecordRef.current = nowMs;
        }
      }

      // 3. Environmental Passive Drain: Constant risk during extreme weather while moving
      if (isMoving && weatherMultiplier > 2.0 && safetyScore > 10) {
        setSafetyScore(prev => Math.max(0, prev - 0.01));
      }

      // 2a. Brake Heat Penalty: Mechanical abuse reduces score (applied independently of speeding)
      if (brakeHeatRef.current > 160) {
        setSafetyScore(prev => Math.max(0, prev - 0.1));
      }

      // 3. Safe Cornering Warning: Proximity to Danger Zones
      if (!isMuted && 'speechSynthesis' in window) {
        const dangerSegments = geoJSON.features.filter((f: any) => f.properties?.danger_zone);
        approachingDanger = dangerSegments.find((f: any) => {
          const coords = f.geometry.coordinates;
          const dist = haversineDistance(currentUserLocation.lat, currentUserLocation.lng, coords[0][1], coords[0][0]);
          return dist < 0.25; // Trigger 250m before curve
        });

        if (approachingDanger && currentSpeedKmh > 40) {
          const segmentId = approachingDanger.properties?.id || approachingDanger.id;
          if (lastSpokenDangerZone.current !== segmentId) {
            const utterance = new SpeechSynthesisUtterance("Safe cornering warning: Sharp turn ahead. Please reduce speed.");
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
            lastSpokenDangerZone.current = segmentId;
            setSafetyScore(prev => Math.max(0, prev - 5)); // Flat penalty for dangerous cornering entry

            setTripEvents(prev => [...prev, {
              type: 'penalty',
              title: 'Unsafe Sharp Turn Entry',
              lat: currentUserLocation.lat,
              lng: currentUserLocation.lng,
              time: new Date().toLocaleTimeString(),
              score: -5
            }]);
          }
        } else if (!approachingDanger) {
          lastSpokenDangerZone.current = null;
        }
      }

      // 8. Planned Route Hazards: Proximity alerts for Sharp Turns, Steep Grades, and Blocks
      if (!isMuted && 'speechSynthesis' in window && pathAnalytics?.hazards) {
        const nearbyHazard = pathAnalytics.hazards.find((h: any) => {
          return haversineDistance(currentUserLocation.lat, currentUserLocation.lng, h.lat, h.lng) < 0.25; // 250m
        });

        if (nearbyHazard) {
          const hazardId = `${nearbyHazard.type}-${nearbyHazard.lat}-${nearbyHazard.lng}`;
          if (lastSpokenHazardId.current !== hazardId) {
            let msg = "";
            if (nearbyHazard.type === 'SHARP_TURN') msg = "Caution: Sharp turn ahead. Reduce speed.";
            else if (nearbyHazard.type === 'STEEP_GRADE') msg = `Caution: Steep ${nearbyHazard.isDescent ? 'descent' : 'climb'} ahead.`;
            else if (nearbyHazard.type === 'Blocked') msg = "Alert: Approaching a blocked section.";

            if (msg) {
              window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
              lastSpokenHazardId.current = hazardId;

              // 📳 Tactical Haptic Pulse for hazard proximity
              if ('vibrate' in navigator) {
                const patterns = {
                  low: [50],
                  medium: [150, 80, 150],
                  high: [300, 100, 300, 100, 300]
                };
                navigator.vibrate(patterns[hapticIntensity]);
              }

              if (reminderService.isLeader()) {
                reminderService.broadcastHapticPulse();
              }
            }
          }
        } else {
          lastSpokenHazardId.current = null;
        }
      }

      // 4. Safety Recovery Logic: Adds 1 point to safetyScore for every 5 minutes (300,000ms) of safe driving.
      const deltaTime = now - lastSafeCheckTimestamp.current;
      lastSafeCheckTimestamp.current = now;

      // Recovery active when moving, not speeding, and not in danger zones
      // 🛡️ Safety Recovery Pause: If brakes are hot (>140°C), the driver is in a high-risk state (mechanical strain).
      if (isMoving && !isSpeeding && !approachingDanger && brakeHeatRef.current < 140 && safetyScore < 100) {
        safeDrivingAccumulator.current += deltaTime;
        safeStreakAccumulator.current += deltaTime;

        // Streak Bonus: After 30 minutes of safe driving, recovery is 2x faster (1pt/2.5min)
        const isOnStreak = safeStreakAccumulator.current >= 1800000;
        const threshold = isOnStreak ? 150000 : 300000;

        if (safeDrivingAccumulator.current >= threshold) {
          setSafetyScore(prev => Math.min(100, prev + 1));
          safeDrivingAccumulator.current = 0;
          addToast("success", isOnStreak ? "🔥 Safety Streak Bonus: Score +1" : "Safe driving bonus: Safety Score +1");
        }
      } else if (isSpeeding || (approachingDanger && currentSpeedKmh > 40)) {
        // Reset progress and streak immediately on unsafe behavior
        safeDrivingAccumulator.current = 0;
        safeStreakAccumulator.current = 0;
      }

      // 5. Calculate next intersection (end of current highway segment)
      // In a real production scenario, we'd cross-reference road_refno junctions
      const segments = geoJSON.features;
      let closestDist = Infinity;
      let intersectionName = "Junction";

      segments.forEach((f: any) => {
        if (f.geometry?.type === 'LineString') {
          const coords = f.geometry.coordinates;
          const endPoint = coords[coords.length - 1];
          const dist = haversineDistance(
            currentUserLocation.lat,
            currentUserLocation.lng,
            endPoint[1],
            endPoint[0]
          );

          // Find the upcoming intersection (distance > 0.05km to avoid current location)
          if (dist > 0.05 && dist < closestDist) {
            closestDist = dist;
            intersectionName = f.properties?.dist_name || "Highway Intersection";
          }
        }
      });

      if (closestDist !== Infinity) {
        setNextIntersection({ distance: closestDist, name: intersectionName });
      }
    }
  }, [currentUserLocation, geoJSON, pilotMode, isMuted, smoothedSpeedLimit, addToast, highwayReport?.speedLimit]);

  // Dynamic Route Recalculation: Auto-shift travel plan if route becomes dangerous/blocked
  useEffect(() => {
    // If route is blocked and we haven't fetched alternatives yet
    if (geoJSON?.status === 'blocked' && !isProcessing && routeAlternatives.length === 0) {
      handleShowAlternatives();
    }

    // Automatically shift to best alternative if found
    if (geoJSON?.status === 'blocked' && routeAlternatives.length > 0 && fastestAlternative) {
      addToast("info", `Route Blocked: Automatically shifting to fastest alternative (${fastestAlternative.code})`);
      handleHighwaySelect(fastestAlternative.code);
    }
  }, [geoJSON?.status, routeAlternatives, fastestAlternative, handleShowAlternatives, handleHighwaySelect, addToast, isProcessing]);

  // Smoothing Algorithm for Dynamic Speed Limit
  useEffect(() => {
    let target = highwayReport?.speedLimit || 80;

    // ⛈️ Environmental Speed Governance: If landslide risk is high,
    // we forcibly reduce the target speed limit regardless of road design.
    if (landslideSeverity === 'high') {
      target = Math.min(target, 35); // Slow crawl for high-risk zones
    } else if (landslideSeverity === 'medium') {
      target = Math.min(target, 55);
    }

    // 🚦 Traffic-Aware Speed Adjustment: In Nepal, congestion is a primary speed governor.
    // We reduce the target speed limit based on the real-time intensity factor.
    if (trafficIntensity > 1.0) {
      target = Math.round(target / trafficIntensity);
    }

    if (target !== smoothedSpeedLimit) {
      // Safety Logic: If the limit drops, update instantly. If it rises, do it gradually.
      if (target < smoothedSpeedLimit) {
        setSmoothedSpeedLimit(target);
      } else {
        const timer = setTimeout(() => {
          setSmoothedSpeedLimit(prev => Math.min(prev + 5, target));
        }, 500); // Rise by 5km/h every half second
        return () => clearTimeout(timer);
      }
    }
  }, [highwayReport?.speedLimit, smoothedSpeedLimit, landslideSeverity, trafficIntensity]);

  // Voice Alert Logic: Triggers SpeechSynthesis for upcoming intersections
  useEffect(() => {
    if (isMuted || !('speechSynthesis' in window)) return;

    if (pilotMode && nextIntersection && nextIntersection.distance < 0.5) {
      if (lastSpokenIntersection.current !== nextIntersection.name) {
        const utterance = new SpeechSynthesisUtterance(
          `Attention: Approaching ${nextIntersection.name} in 500 meters.`
        );
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        lastSpokenIntersection.current = nextIntersection.name;
      }
    } else if (!nextIntersection || (nextIntersection && nextIntersection.distance > 0.6)) {
      lastSpokenIntersection.current = null;
    }
  }, [nextIntersection, pilotMode]);

  // Rescuer Initialization Effect
  useEffect(() => {
    if (rescueStatus === 'dispatched' && currentUserLocation && nearbyRescuers.length === 0) {
      const initialRescuers = [
        { id: 'res1', lat: currentUserLocation.lat + 0.015, lng: currentUserLocation.lng + 0.015, type: 'ambulance' },
        { id: 'res2', lat: currentUserLocation.lat - 0.012, lng: currentUserLocation.lng + 0.018, type: 'police' },
        { id: 'res3', lat: currentUserLocation.lat + 0.020, lng: currentUserLocation.lng - 0.005, type: 'tow' },
      ];
      setNearbyRescuers(initialRescuers);
      if (reminderService.isLeader()) {
        reminderService.broadcastContext({ rescuers: initialRescuers });
      }
    } else if (rescueStatus === 'idle') {
      setNearbyRescuers([]);
    }
  }, [rescueStatus, currentUserLocation, nearbyRescuers.length]);


  useEffect(() => {
    if (appReady && pushSupported) {
      pushSubscribe().catch(() => { });
    }
  }, [appReady, pushSupported]);

  // Check for app updates
  useEffect(() => {
    if (!appReady) return;

    const checkUpdate = setInterval(() => {
      const update = HotUpdateManager.getUpdate();
      if (update) setUpdateAvailable(true);
    }, 10000);

    return () => clearInterval(checkUpdate);
  }, [appReady]);

  // Real-time Service Data Fetching
  useEffect(() => {
    if (serviceType && currentUserLocation) {
      const loadServiceData = async () => {
        setIsProcessing(true);
        try {
          const results = await fetchServiceData(serviceType, currentUserLocation.lat, currentUserLocation.lng);
          setServiceResults(results);
        } catch (err) {
          console.error("[App] Service fetch failed:", err);
        } finally {
          setIsProcessing(false);
        }
      };
      loadServiceData();
    }
  }, [serviceType, currentUserLocation]);

  // 🚦 Fetch Traffic History for InfoBoard
  useEffect(() => {
    if (serviceType === 'traffic' && currentUserLocation) {
      const fetchTrafficData = async () => {
        // Mock historical traffic data for the last 24 hours
        const history = [];
        for (let i = 0; i < 24; i++) {
          const hour = new Date();
          hour.setHours(hour.getHours() - (23 - i));
          history.push({
            timestamp: hour.getTime(),
            intensity: Math.max(0.5, Math.min(3.0, 1.5 + Math.sin(i / 4) * 0.8 + Math.random() * 0.5))
          });
        }
        setTrafficHistory(history);

        // Mock traffic prediction for the next 6 hours
        const prediction = [];
        for (let i = 1; i <= 6; i++) {
          const futureHour = new Date();
          futureHour.setHours(futureHour.getHours() + i);
          prediction.push({
            hour: `${futureHour.getHours()}:00`,
            intensity: Math.max(0.5, Math.min(3.0, 1.5 + Math.sin((futureHour.getHours() % 24) / 4) * 0.8 + Math.random() * 0.5)),
            precipitation: Math.random() // Simulates 0.0 to 1.0 probability
          });
        }
        setTrafficPredictionData(prediction);
      };
      fetchTrafficData();
    }
  }, [serviceType, currentUserLocation]);

  /* ---------------- MAP CENTER ---------------- */

  const mapCenter = useMemo(() => {
    return currentUserLocation ? [currentUserLocation.lat, currentUserLocation.lng] : [28.3949, 84.124];
  }, [currentUserLocation]);

  /* ---------------- HANDLERS ---------------- */

  const handleTogglePilot = useCallback(() => {
    if (!pilotMode) {
      setPilotMode(true);
      setSidebarOpen(false);
      setSystemMenuOpen(false);
      setShowLayersPanel(false);
      setBoardDisplayState(BoardDisplayState.EXPANDED); // Pilot mode takes up more space
      setSafeTripKm(0);
      setTripEvents([]);
      setFuelHistory([]); // Start fresh mission tracking
      actualPathRef.current = []; // Reset path for new mission
      setTripStartTime(Date.now());
      lastSafeCheckTimestamp.current = Date.now();
      safeDrivingAccumulator.current = 0;
      safeStreakAccumulator.current = 0;
    } else { // If exiting pilot mode
      // Reset pre-trip checklist state
      setShowPreTripChecklist(false);

      setPilotMode(false);
      setShowFinalReport(true);
      setBoardDisplayState(BoardDisplayState.HIDDEN);

      // 🌿 Green Badge: Record points if the user completed an eco-friendly trip
      if (isGreenRoute && safeTripKm > 1) {
        apiFetch("/v1/analytics/record", {
          method: "POST",
          body: JSON.stringify({
            event: "eco_trip_completed",
            meta: {
              userId: user?.id || 'guest',
              userName: userProfile?.name || 'Guest Traveler',
              km: Math.round(safeTripKm)
            }
          })
        }).then(() => addToast("success", `Eco-trip complete! You earned ${Math.round(safeTripKm)} Green Points.`));
      }
    }

    // Trigger pre-trip checklist if trip is long
    if (!pilotMode && geoJSON && geoJSON.distance > 100) { // pilotMode is still false here, meaning it's about to be enabled
      setShowPreTripChecklist(true);
    } else {
      addToast("info", "Pilot mode toggled");
    }
  }, [addToast, pilotMode, isGreenRoute, safeTripKm, user, userProfile]);

  const handleThemeCycle = useCallback(() => {
    const colors: any[] = ["blue", "emerald", "rose", "amber", "indigo", "violet"];
    const currentIndex = colors.indexOf(accentColor);
    const nextColor = colors[(currentIndex + 1) % colors.length];

    setAccentColor(nextColor);
    localStorage.setItem('merosadak_accent_color', nextColor);
    // Update CSS variables for Tailwind
    document.documentElement.setAttribute('data-theme-color', nextColor);
    addToast("success", `Theme updated to ${nextColor}`);
  }, [accentColor, addToast]);

  const toggleNightVision = () => {
    const val = !isNightVision;
    setIsNightVision(val);
    localStorage.setItem('merosadak_night_vision', String(val));
    if (reminderService.isLeader()) {
      reminderService.broadcastNightVision(val);
    }
  };

  const toggleStealthMode = () => {
    const val = !isStealthMode;
    setIsStealthMode(val);
    if (reminderService.isLeader()) {
      reminderService.broadcastStealthMode(val);
    }
  };

  const handleAskAI = useCallback(async (text: string) => {
    setChatMessages(prev => [...prev, { role: "user", text }]);

    // Functional AI Endpoint
    const res = await apiFetch("/v1/gemini/query", {
      method: "POST",
      body: JSON.stringify({ prompt: text })
    });
    // eslint-disable-next-line no-console
    if (res?.data?.response) {
      if (reminderService.isLeader()) {
        reminderService.broadcastAISubtitle(res.data.response);
      }
      setActiveAISubtitle(res.data.response);
      setTimeout(() => setActiveAISubtitle(null), 8000);
    }

    setChatMessages(prev => [
      ...prev,
      { role: "model", text: res?.data?.response || "No response" }
    ]);
  }, []);

  /* ---------------- ROUTE ---------------- */

  const handleUnifiedSelection = useCallback(async (result: ExtendedSearchResult) => {
    if (!currentUserLocation) return;

    setSidebarOpen(false);
    const adminInfo = await resolveAdminInfo(result);

    const enhancedResult = { ...result, ...adminInfo, geometry: adminInfo.geometry || result.geometry };
    setSelectedObject(enhancedResult);
    setRouteAlternatives([]);
    setAlternativeGeometries({});
    setShowAlternativesOnMap(true);
    setBoardDisplayState(BoardDisplayState.SPLIT);

    // Detect context based on result type
    if (result.type === 'highway' || (result.type as string) === 'road') {
      setActiveContext('road');
    } else if (result.type === 'poi') {
      setActiveContext('service');
    } else if (result.type === 'traffic') {
      setActiveContext('alert');
    } else {
      setActiveContext('travel');
      const distance = haversineDistance(
        currentUserLocation.lat,
        currentUserLocation.lng,
        result.lat || 0,
        result.lng || 0
      );

      // Check for real-time blockages on the route via incidents
      const routeIncidents = incidents.filter(i => (i.status || '').toLowerCase().includes('block'));

      setGeoJsonData({
        from: { lat: currentUserLocation.lat, lng: currentUserLocation.lng, name: "You" },
        to: { lat: result.lat || 0, lng: result.lng || 0, name: result.name },
        distance,
        duration: (distance / 40) * trafficIntensity,
        highways: [],
        incidents: routeIncidents.length,
        blockedSections: routeIncidents.length,
        status: routeIncidents.length > 0 ? "blocked" : "clear",
        admin: adminInfo
      });
    }
  }, [currentUserLocation, incidents]);

  /**
   * Unified handler for incident selection that triggers 
   * the split-view dashboard and map focus simultaneously.
   */
  const handleSelectIncident = useCallback((incident: TravelIncident) => {
    setSelectedIncident({ ...incident }); // Spread to ensure new reference triggers map effect
    setSelectedObject(incident);
    setBoardDisplayState(BoardDisplayState.SPLIT); // Show board in split view
    setActiveContext('alert');
    setSidebarOpen(false); // Close sidebar to show map and board simultaneously
  }, []);

  /** 📡 Generates a high-fidelity mission briefing image/link for sharing */
  const handleShareMission = useCallback(() => {
    const rating = safetyScore >= 90 ? 'ELITE' : safetyScore >= 70 ? 'STABLE' : 'DEGRADED';
    const text = `🛡️ *MeroSadak Mission Digest*\n\nStatus: ${rating} (${Math.round(safetyScore)}%)\nSafe Distance: ${safeTripKm.toFixed(1)} KM\nTerrain: ${Math.abs(Math.round(terrainGrade))}% Grade\n\nJoin my fleet on MeroSadak!`;

    if (navigator.share) {
      navigator.share({
        title: 'MeroSadak Mission Briefing',
        text: text,
        url: window.location.href
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text);
      addToast("success", "Mission stats copied to clipboard!");
    }
  }, [safetyScore, safeTripKm, terrainGrade, addToast]);

  /**
   * Plans a route from the user's current location to a specific incident or POI
   */
  const handlePlanRoute = useCallback((incident: TravelIncident) => {
    if (!currentUserLocation) {
      addToast("error", "User location not found. Please enable GPS.");
      return;
    }

    const distance = haversineDistance(
      currentUserLocation.lat,
      currentUserLocation.lng,
      incident.lat || 0,
      incident.lng || 0
    );

    setGeoJsonData({
      from: { lat: currentUserLocation.lat, lng: currentUserLocation.lng, name: "You" },
      to: { lat: incident.lat || 0, lng: incident.lng || 0, name: incident.title || incident.name || "Incident" },
      distance,
      duration: distance / 40,
      highways: [],
      incidents: 0,
      blockedSections: 0,
      status: "clear"
    });

    setBoardDisplayState(BoardDisplayState.SPLIT);
    setActiveContext('travel');
    setSidebarOpen(false);
    addToast("success", `Route planned to ${incident.title || incident.name}`);
  }, [currentUserLocation, addToast]);

  // Drag handlers for the InfoBoard
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingBoard(true);
    setInitialBoardHeight(currentBoardHeight);
    setStartY('touches' in e ? e.touches[0].clientY : e.clientY);
  }, [currentBoardHeight]);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingBoard) return;

    if (dragAnimationFrameRef.current !== undefined) { // Check for undefined
      cancelAnimationFrame(dragAnimationFrameRef.current);
    }

    // Use RequestAnimationFrame to debounce UI updates to the display refresh rate
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = startY - clientY; // Dragging up increases height, dragging down decreases

      let newHeight = initialBoardHeight + deltaY;
      const snapHeights = getSnapHeights();

      // Clamp height between 0 and screen height
      newHeight = Math.max(snapHeights.minimized, Math.min(newHeight, window.innerHeight));
      setCurrentBoardHeight(newHeight);
    });

    // Prevent default to avoid scrolling the page
    e.preventDefault();
  }, [isDraggingBoard, startY, initialBoardHeight, getSnapHeights]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingBoard(false);
    const snapHeights = getSnapHeights();

    // Trigger light haptic on release
    if ('vibrate' in navigator) navigator.vibrate(10);

    // --- PULL TO UNLOCK LOGIC ---
    // If the board is pulled past 85% of screen height while locked, trigger unlock
    if (isLocked && currentBoardHeight > window.innerHeight * 0.85) {
      setIsLocked(false);
      setBoardDisplayState(BoardDisplayState.EXPANDED);
      addToast('success', 'Dashboard Unlocked');
      if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]); // Success pattern
      return;
    }

    // Snap to nearest state
    const distances = {
      hidden: Math.abs(currentBoardHeight - snapHeights.hidden),
      minimized: Math.abs(currentBoardHeight - snapHeights.minimized),
      split: Math.abs(currentBoardHeight - snapHeights.split),
      expanded: Math.abs(currentBoardHeight - snapHeights.expanded),
    };

    const closestState = Object.keys(distances).reduce((a, b) =>
      distances[a as keyof typeof distances] < distances[b as keyof typeof distances] ? a : b
    ) as BoardDisplayState;

    setBoardDisplayState(closestState);

    // Haptic pulse when snapping into a defined state
    if ('vibrate' in navigator && closestState !== BoardDisplayState.HIDDEN) {
      navigator.vibrate(5);
    }
  }, [currentBoardHeight, getSnapHeights]);

  // 🔍 Quick Zoom Gesture Handlers
  const handleZoomTouchStart = (e: React.TouchEvent) => {
    setZoomTouchStart(e.touches[0].clientY);
    setIsZooming(true);
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    if (zoomTouchStart === null) return;
    const currentY = e.touches[0].clientY;
    const delta = zoomTouchStart - currentY;

    if (Math.abs(delta) > 50) { // Every 50px of vertical travel
      setMapZoomState(prev => Math.max(8, Math.min(18, prev + (delta > 0 ? 1 : -1))));
      setZoomTouchStart(currentY);
    }
  };

  // Attach global mouse/touch event listeners for dragging
  useEffect(() => {
    if (isDraggingBoard) {
      window.addEventListener('mousemove', handleDragMove as EventListener);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove as EventListener, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove as EventListener);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove as EventListener);
      window.removeEventListener('touchend', handleDragEnd);
    }
    if (dragAnimationFrameRef.current) cancelAnimationFrame(dragAnimationFrameRef.current);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }; // eslint-disable-line no-console
  }, [isDraggingBoard, handleDragMove, handleDragEnd]);

  // Map container height calculation
  const mapHeight = `calc(100vh - ${currentBoardHeight}px)`;

  // InfoBoard visibility based on currentBoardHeight
  const isInfoBoardVisible = currentBoardHeight > 0;

  // Toggle board state via chevron click
  const handleChevronClick = useCallback(() => {
    const snapHeights = getSnapHeights();
    if (currentBoardHeight === snapHeights.hidden) {
      setBoardDisplayState(BoardDisplayState.SPLIT);
    } else if (currentBoardHeight === snapHeights.split) {
      setBoardDisplayState(BoardDisplayState.EXPANDED);
    } else if (currentBoardHeight === snapHeights.expanded) {
      setBoardDisplayState(BoardDisplayState.HIDDEN);
    } else if (currentBoardHeight === snapHeights.minimized) {
      setBoardDisplayState(BoardDisplayState.SPLIT);
    } else { // If in an intermediate state, snap to split
      setBoardDisplayState(BoardDisplayState.SPLIT);
    }
  }, [currentBoardHeight, getSnapHeights]);

  // Close InfoBoard handler
  const handleInfoBoardClose = useCallback(() => {
    setBoardDisplayState(BoardDisplayState.HIDDEN);
    setPilotMode(false); // Ensure pilot mode is also off if InfoBoard is closed
  }, []);

  /* ---------------- RENDER ---------------- */

  return (
    <>
      {/* Global Sync & Maintenance Progress Bar */}
      {syncProgress && (
        <div className="fixed top-0 left-0 w-full z-[9999] pointer-events-none animate-in slide-in-from-top duration-500">
          <div className="h-1 bg-primary/20 w-full">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              style={{ width: `${syncProgress.pct}%` }}
            />
          </div>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-1.5 border-b border-outline/10 flex items-center justify-between shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
              <Activity size={12} className="text-primary animate-pulse" />
              {syncProgress.message}
            </span>
            <span className="text-[10px] font-black text-primary">{syncProgress.pct}%</span>
          </div>
        </div>
      )}
      {!appReady && <LoadingScreen onComplete={() => setAppReady(true)} />}
      <WeatherMonsoonProvider currentUserLocation={currentUserLocation}>

        <div className={`h-screen w-screen ${isDarkMode ? "dark" : ""}`}>
          <div className={`flex flex-col h-full ${isLocked ? 'overflow-hidden' : 'overflow-y-auto scroll-smooth'}`}>
            {/* Map Section (Top) */}
            <div
              ref={mapContainerRef}
              className={`relative transition-all duration-700 ease-in-out map-3d-container ${isSearchActive ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'
                } ${(geoJSON || pilotMode || !!hoveredPathPoint) && !isStealthMode ? 'map-3d-active' : ''}`}
              style={{
                height: mapHeight,
                '--map-rotation': `${-hoveredBearing}deg`
              } as React.CSSProperties}
            >
              <ErrorBoundary fallback={
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center">
                  <AlertTriangle size={48} className="text-red-500 mb-4" />
                  <h3 className="text-xl font-black mb-2 uppercase">Map Engine Failure</h3>
                  <p className="text-sm text-slate-400 max-w-xs">WebGL initialization or Leaflet core failed. This can happen on older devices or if hardware acceleration is disabled.</p>
                  <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-indigo-600 rounded-xl font-bold uppercase text-xs">Restart Engine</button>
                </div>
              }>
                <MapContainer
                  center={mapCenter as any}
                  zoom={mapZoomState}
                  minZoom={8}
                  maxBounds={[[26.3, 80.0], [30.5, 88.3]]}
                  maxBoundsViscosity={1.0}
                  scrollWheelZoom="center" // Zoom focused on center (user)
                  touchZoom="center" // Mobile pinch-to-zoom centered focus
                  doubleClickZoom="center"
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url={isNightVision
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      : mapLayer === 'satellite'
                        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    }
                    className={`
                    ${isNightVision ? 'night-vision-filter' : ''} 
                    ${isHighContrast
                        ? (mapLayer === 'satellite' ? 'high-contrast-satellite' : 'high-contrast-sunlight')
                        : ''
                      }
                  `}
                  />
                  {/* 🐾 Peer Breadcrumbs: Actual trail from last 30 minutes */}
                  {Object.entries(peersLocation).map(([peerId, data]) => (
                    <Polyline
                      key={`breadcrumbs-${peerId}`}
                      positions={(data.breadcrumbs || []).map(b => [b.lat, b.lng])}
                      color="#6366f1"
                      weight={2}
                      opacity={0.3}
                      dashArray="3, 7"
                    />
                  ))}

                  {/* Render Shared Peer Routes */}
                  {Object.entries(peersRoutes).map(([peerId, route]) => (
                    <Polyline
                      key={`route-${peerId}`}
                      positions={route.points.map(p => [p.lat, p.lng])}
                      color={route.color}
                      weight={3}
                      opacity={0.6}
                      dashArray="5, 10"
                    />
                  ))}

                  {/* Render Peer Locations from Offline Hook */}
                  {Object.entries(peersLocation).map(([peerId, data]) => {
                    const lastSeenSec = Math.floor((Date.now() - data.timestamp) / 1000);
                    const lastSeenText = lastSeenSec < 60 ? 'Just now' : `${Math.floor(lastSeenSec / 60)}m ago`;

                    return (
                      <Marker
                        key={peerId}
                        position={[data.lat, data.lng]}
                        icon={L.divIcon({
                          className: 'peer-marker',
                          html: `
                            <div class="flex flex-col items-center">
                              <div class="bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full mb-1 shadow-lg">
                                ${data.name} • ${lastSeenText}
                              </div>
                              <div class="w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-lg ${lastSeenSec > 120 ? 'grayscale opacity-50' : ''}"></div>
                            </div>
                          `
                        })}
                      />
                    );
                  })}

                  {/* 🚨 Emergency SOS Marker */}
                  {activeSOS && (
                    <Marker
                      position={[activeSOS.lat, activeSOS.lng]}
                      icon={L.divIcon({
                        className: 'sos-marker',
                        html: `
                          <div class="flex flex-col items-center animate-bounce">
                            <div class="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full mb-1 shadow-2xl ring-4 ring-red-500/50">SOS: ${activeSOS.name}</div>
                            <div class="w-6 h-6 bg-red-600 rounded-full border-4 border-white shadow-2xl"></div>
                          </div>
                        `
                      })}
                    />
                  )}

                  {/* 🚨 Emergency SOS Marker */}
                  {activeSOS && (
                    <Marker
                      position={[activeSOS.lat, activeSOS.lng]}
                      icon={L.divIcon({
                        className: 'sos-marker',
                        html: `
                          <div class="flex flex-col items-center animate-bounce">
                            <div class="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full mb-1 shadow-2xl ring-4 ring-red-500/50">SOS: ${activeSOS.name}</div>
                            <div class="w-6 h-6 bg-red-600 rounded-full border-4 border-white shadow-2xl"></div>
                          </div>
                        `
                      })}
                    />
                  )}

                  <FollowMeHandler position={currentUserLocation} isActive={isFollowMe} />
                  <MapZoomHandler zoom={mapZoomState} />
                  <MapClickHandler
                    isActive={isMeasuring}
                    currentUserLocation={currentUserLocation}
                    isTilted={pilotMode || !!geoJSON}
                    onMapClick={(latlng, zoom) => {
                      const { point, nodeDist } = findSnappedPoint(latlng, zoom);
                      setMeasurePoints(prev => [...prev, point]);
                      setNearestIntersectionDist(nodeDist);
                      setLastSnappedPoint(point);
                      setTimeout(() => setLastSnappedPoint(null), 1000);
                    }}
                  />
                  <MapFocusManager currentUserLocation={currentUserLocation} geoJSON={geoJSON} selectedIncident={selectedIncident} isTilted={(pilotMode || !!geoJSON) && !isStealthMode} />
                  {hoveredPathPoint && (
                    <SyncMarker point={hoveredPathPoint} elevation={hoveredElevation} grade={hoveredGrade} isShiftPressed={isShiftPressed} />
                  )}
                  {lastSnappedPoint && (
                    <Marker
                      position={lastSnappedPoint}
                      icon={L.divIcon({
                        className: 'snapped-highlight',
                        html: `
                        <div class="relative flex items-center justify-center">
                          <div class="absolute w-10 h-10 bg-primary/40 rounded-full animate-ping"></div>
                          <div class="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-lg"></div>
                        </div>
                      `
                      })}
                    />
                  )}
                  <SafetyBuffer
                    currentUserLocation={currentUserLocation}
                    pilotMode={pilotMode}
                    isHazardNearby={isHazardNearby}
                    isCollisionRisk={isCollisionRisk}
                    isMuted={isMuted}
                  />
                  <FogOverlay isStealthMode={isStealthMode} />
                  <RainOverlay isStealthMode={isStealthMode} />
                  <SnowOverlay isStealthMode={isStealthMode} />
                  <ThunderstormEffect />

                  {/* Global Weather Animation Styles */}
                  <style>{`
                    @keyframes rain-move {
                      0% { background-position: 0 0; }
                      100% { background-position: 40px 80px; }
                    }
                    .rain-falling {
                      background-image: repeating-linear-gradient(
                        110deg,
                        rgba(255, 255, 255, 0) 0px,
                        rgba(255, 255, 255, 0) 10px,
                        rgba(255, 255, 255, 0.4) 11px,
                        rgba(255, 255, 255, 0) 12px
                      );
                      background-size: 40px 80px;
                      animation: rain-move 0.6s linear infinite;
                    }
                  `}</style>
                  {!isGhostMode && <MapControls currentUserLocation={currentUserLocation} />}
                  {!isGhostMode && !isStealthMode && <BoundaryOverlay isDarkMode={isDarkMode} />}
                  {!isGhostMode && showTraffic && <TrafficFlowOverlay currentUserLocation={currentUserLocation} isVisible />}
                  {!isGhostMode && !isStealthMode && monsoonVisible && <MonsoonRiskOverlay isDarkMode={isDarkMode} />}
                  {geoJSON && currentUserLocation && (
                    <RouteDisplay route={geoJSON} currentUserLocation={currentUserLocation} pathAnalytics={pathAnalytics} />
                  )}
                  {!isStealthMode && selectedHighwayCode && geoJSON && (
                    <HighwayHighlightOverlay
                      highwayCode={selectedHighwayCode}
                      geoData={geoJSON}
                      incidents={incidents}
                      viewMode={highwayViewMode}
                      lang={i18n.language}
                      hideIncidents={isGhostMode}
                    />
                  )}
                  {pilotMode && nearbySafetyRamps.map(ramp => (
                    <Marker
                      key={ramp.id}
                      position={[ramp.lat, ramp.lng]}
                      icon={L.divIcon({
                        className: 'safety-ramp-marker',
                        html: `
                        <div class="relative flex items-center justify-center">
                          <div class="absolute w-12 h-12 bg-red-600/30 rounded-full animate-ping" />
                          <div class="z-10 w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white">
                            <span class="font-black text-[10px]">RAMP</span>
                          </div>
                        </div>
                      `
                      })}
                    />
                  ))}
                  {nearbyRescuers.map(res => (
                    <Marker
                      key={res.id}
                      position={[res.lat, res.lng]}
                      icon={L.divIcon({
                        className: 'rescuer-marker',
                        html: `
                        <div class="relative flex items-center justify-center">
                          <div class="absolute w-12 h-12 bg-emerald-500/30 rounded-full animate-ping" />
                          <div class="z-10 w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                          </div>
                        </div>
                      `
                      })}
                    />
                  ))}
                  {pilotMode && safetyScore < 40 && [
                    { id: 'p1', lat: currentUserLocation!.lat + 0.005, lng: currentUserLocation!.lng + 0.005 },
                    { id: 'p2', lat: currentUserLocation!.lat - 0.004, lng: currentUserLocation!.lng + 0.003 }
                  ].map(p => (
                    <Marker
                      key={p.id}
                      position={[p.lat, p.lng]}
                      icon={L.divIcon({
                        className: 'police-intercept-marker',
                        html: `
                        <div class="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-red-500 animate-bounce">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                      `
                      })}
                    />
                  ))}

                  {/* 📴 Offline Vector Network: Provides visibility when map tiles fail to load */}
                  {isOffline && masterHighwayGeoJSON && (
                    <GeoJSON
                      key="offline-network"
                      data={masterHighwayGeoJSON}
                      style={{ color: '#6366f1', weight: 1.5, opacity: 0.5, dashArray: '5, 5' }}
                    />
                  )}

                  {isGhostMode && <div className="absolute inset-0 bg-black/40 z-[900]" />}
                  <FollowLeaderManager
                    isActive={isFollowLeader}
                    currentUserLocation={currentUserLocation}
                    leaderLocation={syncedTelemetry?.lat && syncedTelemetry?.lng ? { lat: syncedTelemetry.lat, lng: syncedTelemetry.lng } : null}
                  />
                  <LeaderVisionManager
                    trigger={leaderVisionTrigger}
                    leaderLocation={syncedTelemetry?.lat && syncedTelemetry?.lng ? { lat: syncedTelemetry.lat, lng: syncedTelemetry.lng } : null}
                  />
                  {!isLeader && leaderPath.length > 1 && (
                    <>
                      {leaderPath.slice(1).map((point, idx) => {
                        const prev = leaderPath[idx];
                        const speed = point[2];
                        const color = speed > 80 ? '#ef4444' : speed < 30 ? '#f59e0b' : '#6366f1';
                        return (
                          <Polyline key={`ghost-${idx}`} positions={[[prev[0], prev[1]], [point[0], point[1]]]} color={color} weight={3} opacity={0.5} dashArray="5, 8" />
                        );
                      })}
                    </>
                  )}
                </MapContainer>
              </ErrorBoundary>

              {/* 🛡️ Follower Tactical Convoy HUD Overlay */}
              {!isLeader && syncedTelemetry && syncedTelemetry.lat && (
                <FollowerTacticalHUD
                  leaderTelemetry={syncedTelemetry}
                  currentUserLocation={currentUserLocation}
                  followerSpeedKmh={(currentUserLocation?.speed || 0) * 3.6}
                  isFollowLeader={isFollowLeader}
                  onToggleFollow={() => setIsFollowLeader(!isFollowLeader)}
                  onLeaderVision={() => setLeaderVisionTrigger(prev => prev + 1)}
                />
              )}

              {/* Over-Speeding Warning Overlay */}
              {pilotMode && currentUserLocation && ((currentUserLocation.speed || 0) * 3.6) > (highwayReport?.speedLimit || 80) && (
                <div className="absolute inset-0 z-[1001] bg-error/10 pointer-events-none animate-pulse ring-inset ring-[20px] ring-error/20 transition-all duration-500" />
              )}

              {/* Pilot Mode Speed HUD - Floating Overlay on Map */}
              {pilotMode && currentUserLocation && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1002] flex items-end gap-6 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <GradeHUD grade={terrainGrade} roll={hoveredRoll} isNightVision={isNightVision} isStealthMode={isStealthMode} />
                  {/* Streak Multiplier Badge: Active after 30 mins (1,800,000 ms) of safe driving */}
                  {safeStreakAccumulator.current >= 1800000 && (
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-xl animate-pulse ring-4 ring-orange-500/20 transition-all scale-110">
                      <Zap size={14} fill="currentColor" />
                      <span className="text-[10px] font-black leading-none mt-0.5">2X</span>
                      <span className="text-[6px] font-bold uppercase tracking-widest">BOOST</span>
                    </div>
                  )}

                  {/* Current Speed Indicator */}
                  <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-4 ${((currentUserLocation?.speed || 0) * 3.6) > smoothedSpeedLimit ? 'border-error animate-pulse' : 'border-primary'} shadow-2xl transition-all`}>
                    <span className="text-2xl font-black text-on-surface font-headline leading-none">
                      {Math.round((currentUserLocation?.speed || 0) * 3.6)}
                    </span>
                    <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">KM/H</span>
                  </div>

                  {/* Suggested Speed Limit Indicator (Nepal Traffic Sign Style) */}
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-white border-4 border-error shadow-xl">
                    <span className="text-sm font-black text-slate-900 leading-none">
                      {smoothedSpeedLimit}
                    </span>
                    <span className="text-[6px] font-black text-error uppercase">LIMIT</span>
                  </div>
                </div>
              )}
            </div>

            {/* Mid-Bar Search: Positioned exactly at the split */}
            <div className="z-[500] -mt-8 px-4 flex justify-center items-center gap-2">
              <SearchOverlayIntent
                isDarkMode={isDarkMode}
                isHighContrast={isHighContrast}
                lang={i18n.language}
                currentUserLocation={currentUserLocation}
                onSelectDestination={handleUnifiedSelection}
                onAskAI={handleAskAI}
                onFocusChange={setIsSearchActive}
                searchRadius={searchRadius}
                onRadiusChange={setSearchRadius}
                onToggleSafetyFilter={() => setFilterHighSafety(!filterHighSafety)}
              />
            </div>

            {/* Route Info Banner */}
            {geoJSON && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1100] w-[90%] max-w-md animate-in slide-in-from-top-4">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-4 rounded-3xl border border-white/20 dark:border-slate-800 shadow-2xl">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-on-surface truncate max-w-[200px]">{geoJSON.to.name}</h4>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">
                          {geoJSON.distance.toFixed(1)} km · {geoJSON.duration.toFixed(1)} hours
                        </p>
                      </div>
                    </div>
                    {routeAlternatives.length > 0 && (
                      <button
                        onClick={() => setShowAlternativesOnMap(!showAlternativesOnMap)}
                        className={`p-1.5 rounded-full transition-colors ${showAlternativesOnMap ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                        title={showAlternativesOnMap ? "Hide alternatives on map" : "Show alternatives on map"}
                      >
                        {showAlternativesOnMap ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setGeoJsonData(null);
                        setRouteAlternatives([]);
                        setAlternativeGeometries({});
                      }}
                      className="p-1.5 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">🚀 Start</button>
                    {geoJSON.status === 'blocked' && (
                      <button
                        onClick={handleShowAlternatives}
                        className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                      >
                        Show Alternative
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Route Comparison Summary Overlay */}
            {fastestAlternative && geoJSON && (
              <div className="absolute bottom-28 right-4 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-[2rem] border border-outline/10 shadow-xl animate-in slide-in-from-right-4 duration-300 max-w-[200px]">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Clock size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest font-label">Time Comparison</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-on-surface-variant/60 uppercase text-[9px]">Fastest Alt</span>
                    <span className="text-indigo-500">{fastestAlternative.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-sm font-black font-headline ${timeDifference! < 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {timeDifference! < 0
                        ? `Saves ${Math.abs(timeDifference!).toFixed(1)} hrs`
                        : `Adds ${timeDifference!.toFixed(1)} hrs`
                      }
                    </div>
                  </div>
                  <div className="pt-2 border-t border-outline/5 flex items-center justify-between group cursor-pointer" onClick={() => handleHighwaySelect(fastestAlternative.code)}>
                    <span className="text-[9px] font-black text-on-surface-variant uppercase">Switch to this</span>
                    <ArrowRight size={10} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            )}

            {/* Information Service Dashboard (Bottom) */}
            {isInfoBoardVisible && (
              <div
                ref={boardRef}
                className={`bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) border-t border-white/20 dark:border-slate-800 shadow-2xl z-[2200] flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto`}
                style={{ height: currentBoardHeight }}
              >
                {/* Expand/Collapse Clue Icon & Handle */}
                <div
                  className="w-full flex justify-center p-2 shrink-0 cursor-grab group"
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mb-1 transition-colors group-hover:bg-primary/50`} />
                    <div className="text-slate-400 dark:text-slate-600">
                      {boardDisplayState === BoardDisplayState.EXPANDED ? <ChevronDown size={14} /> :
                        boardDisplayState === BoardDisplayState.MINIMIZED ? <ChevronUp size={14} /> :
                          currentBoardHeight > getSnapHeights().split ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </div>

                {pilotMode ? (
                  <DriverDashboard
                    onClose={handleInfoBoardClose}
                    safetyScore={Math.round(safetyScore)}
                    safetyHistory={safetyHistory} // Pass safetyHistory to DriverDashboard
                    currentSpeed={(currentUserLocation?.speed || 0) * 3.6}
                    speed={(currentUserLocation?.speed || 0) * 3.6}
                    isSpeeding={(currentUserLocation?.speed || 0) * 3.6 > (highwayReport?.speedLimit || 80)}
                    nextIntersection={nextIntersection}
                    currentUserLocation={currentUserLocation}
                    isMuted={isMuted}
                    onToggleMute={() => {
                      const newVal = !isMuted;
                      setIsMuted(newVal); // isMuted is already typed
                      localStorage.setItem('merosadak_voice_muted', String(newVal));
                    }}
                    aiSubtitle={activeAISubtitle}
                    isCompactHUD={isCompactHUD}
                    batteryLevel={batteryLevel}
                    brakeHeat={brakeHeat}
                    terrainGrade={terrainGrade}
                    safeTripKm={safeTripKm}
                    tripStartTime={tripStartTime}
                    descentBriefing={null} // descentBriefing is already typed
                    onToggleCompactHUD={() => setIsCompactHUD(!isCompactHUD)}
                    isHighContrast={isHighContrast}
                    isLeader={isLeader}
                    convoyWarning={anyFollowerOutOfFormation}
                    isCollisionRisk={isCollisionRisk}
                    pathAnalytics={pathAnalytics}
                  />
                ) : (
                  <InfoBoard
                    onClose={handleInfoBoardClose}
                    activeTab={serviceType || 'safety'}
                    context={activeContext}
                    selectedObject={selectedObject}
                    data={serviceResults.length > 0 ? serviceResults : incidents}
                    trafficPrediction={trafficPredictionData}
                    trafficHistory={trafficHistory} // Pass traffic history
                    isProcessing={isProcessing}
                    onCriticalTrigger={(msg) => setActiveCriticalReminder(msg)} // msg is already typed
                    descentBriefing={null}
                    isHighContrast={isHighContrast}
                    onShareMission={handleShareMission}
                  />
                )}
              </div>
            )}
          </div>

          <Header
            isDarkMode={isDarkMode}
            accentColor={accentColor}
            onToggleMenu={() => setSidebarOpen(v => !v)}
            onToggleSystemMenu={() => setSystemMenuOpen(v => !v)}
            onTogglePilot={handleTogglePilot}
            onLogoClick={handleThemeCycle}
            noticeCount={incidents.length}
            onOpenNotifications={() => setActiveTab('alerts')}
          />

          <SystemMenu
            isOpen={systemMenuOpen}
            onClose={() => setSystemMenuOpen(false)}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            userProfile={userProfile}
            isSuperadmin={isSuperadmin}
            onBroadcast={broadcast}
            vehicleBatteryHistory={vehicleBatteryHistory}
            fuelHistory={fuelHistory}
            fuelLevel={vehicleHealth.fuelLevel}
            onPurgeCache={handleSystemPurge}
            onCopyLocation={handleCopyLocation}
            onUpdateTankCapacity={(val) => {
              updatePOIPreference('customTankCapacity', val);
              // Refreshing profile would typically happen via the useUserProfile hook automatically
              addToast("success", val ? `Tank capacity set to ${val}L` : "Reset to default tank capacity");
            }}
            onToggleDeployDashboard={() => {
              setShowDeployDashboard(true);
              setSystemMenuOpen(false);
            }}
            onToggleMonitoring={() => {
              setShowMonitoring(true);
              setSystemMenuOpen(false);
            }}
            onToggleLayers={() => {
              setShowLayersPanel(true);
              setSystemMenuOpen(false);
            }}
            voiceGender={voiceGender}
            setVoiceGender={setVoiceGender}
            aiMode={aiMode}
            setAiMode={setAiMode}
            verbosity={verbosity}
            setVerbosity={setVerbosity}
            moodEQ={moodEQ}
            setMoodEQ={setMoodEQ}
            isInstallable={isInstallable}
            onInstallApp={triggerInstall}
            highwayViewMode={highwayViewMode}
            isLeader={isLeader}
            tabId={reminderService.getTabId()} // tabId is already typed
            onRemoteShutdown={(id) => reminderService.broadcastRemoteShutdown(id)} // id is already typed
            onBroadcastGlobal={(msg) => reminderService.broadcastGlobalMessage(msg)} // msg is already typed
            rescueStatus={reminderService.getRescueStatus()}
            onRelinquishLeadership={() => reminderService.relinquishLeadership()}
            onResolveSOS={() => reminderService.resolveSOS()}
            onOpenBatterySaver={() => { setIsBatterySaverOpen(true); setSystemMenuOpen(false); }}
            onBroadcastViewLock={(mode) => reminderService.broadcastViewLock(mode)} // mode is already typed
            onBroadcastGhostMode={(active) => reminderService.broadcastGhostMode(active)} // active is already typed
            onBroadcastRemotePOV={(mode) => reminderService.broadcastRemotePOV(mode)} // mode is already typed
            onToggleStealthMode={(active: boolean) => { // active is already typed
              setIsStealthMode(active);
              reminderService.broadcastStealthMode(active);
            }}
            isStealthMode={isStealthMode}
            batteryLevel={batteryLevel} // eslint-disable-line no-console
            isHighContrast={isHighContrast}
            onToggleHighContrast={toggleHighContrast}
            onBroadcastNightVision={(active: boolean) => { // active is already typed
              setIsNightVision(active); // eslint-disable-line no-console
              reminderService.broadcastNightVision(active);
              localStorage.setItem('merosadak_night_vision', String(active));
            }}
            isNightVision={isNightVision}
            onRemoteSOSTrigger={() => reminderService.broadcastSOS(currentUserLocation?.lat, currentUserLocation?.lng)}
            hapticIntensity={hapticIntensity}
            onHapticIntensityChange={(val) => {
              setHapticIntensity(val);
              localStorage.setItem('merosadak_haptic_intensity', val);
            }}
            onOpenFleet={() => {
              setActiveTab('fleet');
              setSidebarOpen(true);
              setSystemMenuOpen(false);
            }}
            isGhostMode={isGhostMode}
            viewLock={viewLock}
            isCompactHUD={isCompactHUD}
            onToggleCompactHUD={() => setIsCompactHUD(!isCompactHUD)}
            onToggleHighwayView={() => setHighwayViewMode(prev => prev === 'pavement' ? 'simple' : 'pavement')}
          />

          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeTab={activeTab} // activeTab is already typed
            setActiveTab={setActiveTab}
            incidents={incidents}
            onSelectIncident={handleSelectIncident}
            leaderboard={leaderboard}
            userProfile={userProfile}
            onPlanRoute={handlePlanRoute}
            chatMessages={chatMessages}
            onSendMessage={handleAskAI}
            isProcessing={isProcessing}
            isDarkMode={isDarkMode}
            onRefresh={handlePullRefresh}
            isRefreshing={isRefreshing}
            nearbyGhostUsers={nearbyGhostUsers}
            currentUserLocation={currentUserLocation}
            serviceType={serviceType}
            serviceResults={serviceResults}
            onSelectService={(service) => {
              setServiceType(service);
              handleServiceSelect(service || '', monsoonVisible);
            }}
            activePersona={activePersona}
            onPersonaChange={setActivePersona} // activePersona is already typed
            voiceGender={voiceGender}
            onGenderChange={setVoiceGender}
            onToggleLayers={() => {
              setShowLayersPanel(true);
              setSidebarOpen(false);
            }}
            onToggleSystemMenu={() => setSystemMenuOpen(true)}
            isSyncing={!!syncProgress}
            syncMessage={syncProgress?.message || ""}
          />

          <FloatingMenu
            onServiceSelect={(s: string) => handleServiceSelect(s)} // s is already typed
            onOpenCalculator={() => { }} // Hooked for future distance tools
            onOpenReport={() => { }} // Hooked for future reporting tools
            onTogglePilot={handleTogglePilot}
            activeService={serviceType}
            incidents={incidents}
            isDarkMode={isDarkMode}
          />

          <UpdateBanner
            visible={updateAvailable}
            onUpdate={() => HotUpdateManager.applyUpdate(true)}
            onLater={() => { setUpdateAvailable(false); HotUpdateManager.dismissUpdate(); }}
          />

          {showDeployDashboard && (
            <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`relative w-full max-w-4xl h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                <button
                  onClick={() => setShowDeployDashboard(false)}
                  className="absolute top-6 right-6 z-50 p-2 rounded-full bg-slate-800/50 text-white hover:bg-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
                <DeployDashboard
                  isDarkMode={isDarkMode}
                  isSuperadmin={isSuperadmin}
                  onBroadcast={broadcast}
                  onPurgeCache={handleSystemPurge}
                  analyticsSummary={analyticsSummary}
                  analyticsLoading={!analyticsSummary}
                />
              </div>
            </div>
          )}

          {showLayersPanel && (
            <MapLayersPanel
              isDarkMode={isDarkMode}
              onClose={() => setShowLayersPanel(false)}
              onToggleMonsoon={() => { /* Monsoon visibility is now controlled by context */ }}
              monsoonVisible={monsoonVisible}
              onToggleTraffic={() => setShowTraffic(!showTraffic)}
              trafficVisible={showTraffic}
              onOpenDistanceCalc={() => {
                setIsMeasuring(true);
                setShowLayersPanel(false);
              }}
            />
          )}

          <DistanceCalculator
            isOpen={isMeasuring}
            points={measurePoints}
            elevationData={elevationProfile}
            nearestIntersectionDist={nearestIntersectionDist}
            nearestHospitalDist={nearestHospitalDist}
            roadQuality={highwayReport?.qualityGrade}
            vehicleType={userProfile?.preferences?.vehicleType}
            customTankCapacity={userProfile?.preferences?.customTankCapacity}
            landslideSeverity={landslideSeverity}
            onSeverityChange={setLandslideSeverity}
            trafficIntensity={trafficIntensity}
            onTrafficChange={setTrafficIntensity}
            fuelPrice={fuelPrice}
            isGreenRoute={isGreenRoute}
            onToggleGreenRoute={() => setIsGreenRoute(!isGreenRoute)}
            pathAnalytics={pathAnalytics}
            comparisonData={comparisonData}
            userElevation={currentUserLocation?.elevation}
            batteryLevel={batteryLevel}
            isNightVision={isNightVision}
            isHighContrast={isHighContrast}
            isLoading={isElevationLoading}
            onClose={() => {
              setIsMeasuring(false);
              setMeasurePoints([]);
              setElevationProfile([]);
              setNearestIntersectionDist(null);
              setNearestHospitalDist(null);
              setIsElevationLoading(false);
            }}
            onClear={() => {
              setMeasurePoints([]);
              setElevationProfile([]);
              setNearestIntersectionDist(null);
              setNearestHospitalDist(null);
              setIsElevationLoading(false);
            }}
            onUndo={() => setMeasurePoints(prev => prev.slice(0, -1))}
            onShare={() => {
              const data = LZString.compressToEncodedURIComponent(JSON.stringify(measurePoints.map(p => [p.lat, p.lng])));
              const url = `${window.location.origin}${window.location.pathname}?path=${data}`;
              navigator.clipboard.writeText(url);
              addToast("success", "Shareable link copied to clipboard!");
            }}
            isSnapping={isSnapping}
            onToggleSnap={() => setIsSnapping(!isSnapping)}
            isSmoothing={isRouteSmoothing}
            onToggleSmoothing={() => setIsRouteSmoothing(!isRouteSmoothing)}
            isEmergencyMode={isEmergencyMode}
            onToggleEmergency={() => setIsEmergencyMode(!isEmergencyMode)}
            onAvoidLandslides={handleAvoidLandslides}
            onHoverPointChange={(point, elev, grade, bearing) => {
              setHoveredPathPoint(point);
              setHoveredElevation(elev); // elev is already typed
              setHoveredGrade(grade);
              if (bearing !== null) setHoveredBearing(bearing);
            }}
          />

          {showPreferences && (
            <UserPreferencesScreen
              isDarkMode={isDarkMode}
              onComplete={() => setShowPreferences(false)}
              onSkip={() => setShowPreferences(false)}
            />
          )}

          <UptimeRobotStats
            isOpen={showMonitoring}
            onClose={() => setShowMonitoring(false)}
          />

          {pilotMode && (
            <DriverDashboard
              onClose={handleInfoBoardClose}
              safetyScore={Math.round(safetyScore)}
              safetyHistory={safetyHistory} // Pass safetyHistory to DriverDashboard
              activeCriticalReminder={activeCriticalReminder}
              onClearCriticalReminder={() => setActiveCriticalReminder(null)}
              currentSpeed={!isLeader && syncedTelemetry ? syncedTelemetry.speed : (currentUserLocation?.speed || 0) * 3.6}
              speed={!isLeader && syncedTelemetry ? syncedTelemetry.speed : (currentUserLocation?.speed || 0) * 3.6}
              isSpeeding={(currentUserLocation?.speed || 0) * 3.6 > (highwayReport?.speedLimit || 80)}
              nextIntersection={nextIntersection}
              currentUserLocation={currentUserLocation}
              isMuted={isMuted} // eslint-disable-line no-console
              onToggleMute={toggleMute}
              isNightVision={isNightVision} // eslint-disable-line no-console
              onToggleNightVision={toggleNightVision}
              isStealthMode={isStealthMode} // eslint-disable-line no-console
              onToggleStealthMode={toggleStealthMode}
              incidents={incidents}
              leaderboard={leaderboard}
              chatMessages={chatMessages}
              onSendMessage={handleAskAI}
              safeTripKm={safeTripKm} // eslint-disable-line no-console
              tripStartTime={tripStartTime}
              isGhostMode={isGhostMode}
              brakeHeat={brakeHeat}
              terrainGrade={terrainGrade}
              mechanicalStress={mechanicalStress}
              gForce={gForce}
              aiSubtitle={activeAISubtitle}
              batteryLevel={batteryLevel}
              isCompactHUD={isCompactHUD}
              isLeader={isLeader}
              convoyWarning={anyFollowerOutOfFormation}
              isCollisionRisk={isCollisionRisk}
              onToggleCompactHUD={() => setIsCompactHUD(!isCompactHUD)}
              pathAnalytics={pathAnalytics}
              totalDistance={totalPlannedDistance}
              isHighContrast={isHighContrast}
            />
          )}

          {showFinalReport && (
            <SafeTripReport
              isOpen={showFinalReport}
              onClose={() => setShowFinalReport(false)}
              finalScore={Math.round(safetyScore)}
              scoreHistory={safetyHistory} // Pass safetyHistory to SafeTripReport
              durationMins={tripStartTime ? Math.floor((Date.now() - tripStartTime) / 60000) : 0}
              actualPath={actualPathRef.current}
              isGreenRoute={isGreenRoute}
              safeTripKm={safeTripKm}
              vehicleType={userProfile?.preferences?.vehicleType}
              highwayCode={selectedHighwayCode}
              events={tripEvents}
            />
          )}

          {isBatterySaverOpen && (
            <BatterySaverModal
              isOpen={isBatterySaverOpen}
              onClose={() => setIsBatterySaverOpen(false)}
              config={batterySaverConfig}
              onUpdateConfig={setBatterySaverConfig}
              batteryLevel={batteryLevel}
              history={batteryHistory}
            />
          )}

          {showPreTripChecklist && (
            <PreTripChecklistModal
              isOpen={showPreTripChecklist}
              onClose={() => setShowPreTripChecklist(false)}
              onConfirm={() => {
                setShowPreTripChecklist(false);
                addToast("info", "Pilot mode activated. Safe travels!");
              }}
              tripDistance={geoJSON?.distance || 0}
              // Sourced from User Preferences with global fallback
              checklistItems={userProfile?.preferences?.checklistItems || [
                { id: 'fuel', label: 'Fuel level checked', icon: Fuel, required: true },
                { id: 'tires', label: 'Tire pressure optimal', icon: Car, required: true },
                { id: 'brakes', label: 'Brakes inspected', icon: Wrench, required: true },
                { id: 'battery', label: 'Battery health good', icon: BatteryCharging, required: false },
                { id: 'firstAid', label: 'First aid kit available', icon: HeartPulse, required: true },
                { id: 'emergency', label: 'Emergency contacts updated', icon: AlertTriangle, required: true },
              ]}
            />
          )}
          {isOffline && <OfflineBanner />}

        </div>
      </WeatherMonsoonProvider>
    </>
  );
};

/* ---------------- WRAPPER -------------- */

import { ToastProvider } from "./ToastContext";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;