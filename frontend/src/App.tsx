import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, ChevronUp, ChevronDown, Minus, Lock, Unlock } from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { L } from "./lib/leaflet";
import "leaflet/dist/leaflet.css";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useNepalData } from "./hooks/useNepalData";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAlert } from "./hooks/useAlert";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useUserProfile, useLeaderboard } from "./hooks/useUserProfile";
import { useAnalytics } from "./hooks/useAnalytics";
import { useSuperadmin } from "./hooks/useSuperadmin";
import { useGemini } from "./hooks/useGemini";
import { useRoutePlanning } from "./hooks/useRoutePlanning";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useETA, useQuickETA, Location } from "./hooks/useETA";
import { useServiceData } from "./hooks/useServiceData";

import type { TravelIncident, ChatMessage } from "./types";
import { apiFetch } from "./api";
import { useTranslation } from "./i18n";

import {
  initializeStorage,
  themeService,
  clearAllStorage,
  purgeAppData
} from "./services/storageIndexService";

import { HotUpdateManager } from "./services/hotUpdateManager";
import { fetchServiceData } from "./services/gasService";

import BoundaryOverlay from "./components/BoundaryOverlay";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { FloatingMenu } from "./components/FloatingMenu";
import SearchOverlay from "./components/SearchOverlay";
import { WeatherWidget } from "./components/WeatherWidget";
import { SystemMenu } from "./components/SystemMenu";
import { BottomInfoArea } from "./components/BottomInfoArea";
import { MapControls } from "./components/MapControls";
import { ReportIncidentOverlay } from "./components/ReportIncidentOverlay";
import { SOSOverlay } from "./components/SOSOverlay";
import { HighwayBrowser } from "./components/HighwayBrowser";
import { HighwayHighlightOverlay } from "./components/HighwayHighlightOverlay";
import { ToastContainer } from "./components/Toast";
import { OfflineBanner } from "./components/OfflineBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";
import { MapLayersPanel } from "./components/MapLayersPanel";
import { MonsoonRiskOverlay } from "./components/MonsoonRiskOverlay";
import { DriverDashboard } from "./components/DriverDashboard";
import { DistanceCalculator } from "./components/DistanceCalculator";
import { SearchOverlayIntent } from "./components/SearchOverlayIntent";
import { RouteDisplay } from "./components/RouteDisplay";
import { ContextualInfoCards } from "./components/ContextualInfoCards";
import { MyPlansPanel } from "./components/MyPlansPanel";
import { PreTripBriefing } from "./components/PreTripBriefing";
import { BelongingsChecklist } from "./components/BelongingsChecklist";
import { UserPreferencesScreen } from "./components/UserPreferencesScreen";
import { POICategorySelector } from "./components/POICategorySelector";
import { POIOverlay } from "./components/POIOverlay";
import { TrafficFlowOverlay } from "./components/TrafficFlowOverlay";
import DeployDashboard from "./components/DeployDashboard";
import { UptimeRobotStats } from "./components/UptimeRobotStats";
import {
  MapEngineSelector,
  type MapEngine
} from "./components/MapEngineSelector";
import {
  MapLayersToggle,
  type MapLayerType
} from "./components/MapLayersToggle";
import { InfoBoard } from "./components/InfoBoard";
import { MapLabel } from "./components/MapLabel";
import { UpdateBanner } from "./components/UpdateBanner";
import { usePWAInstall } from "./hooks/usePWAInstall";

import {
  calculateHaversineDistance
} from "./utils/distance";

import {
  saveTravelPlan,
  getActivePlansCount,
  generateChecklist,
  generateTripBriefing,
  updatePlanStatus,
  markBriefingShown
} from "./services/travelPlanService";

import {
  hasCompletedOnboarding,
  getUserPOIPreferences,
  recordPOIInteraction
} from "./services/userPreferencesService";

import type {
  TravelPlan,
  TripBriefing,
  ChecklistItem
} from "./types/travelPlan";

import type { SearchResult, RouteInfo } from "./services/enhancedSearchService";
import type { UserPOIPreferences, POICategory } from "./types/poi";

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
const MapViewControl: React.FC<{
  userLocation: { lat: number; lng: number } | null;
  routeInfo: RouteInfo | null;
  selectedIncident: TravelIncident | null;
}> = ({ userLocation, routeInfo, selectedIncident }) => {
  const map = useMap();
  const isInitialLoad = useRef(true);

  // 1. Initial focus on User Geolocation
  useEffect(() => {
    if (userLocation && isInitialLoad.current) {
      map.setView([userLocation.lat, userLocation.lng], 13);
      isInitialLoad.current = false;
    }
  }, [userLocation, map]);

  // 2. Adjust View for Road Length / Route Focus
  useEffect(() => {
    if (routeInfo && userLocation) {
      const isMobile = window.innerWidth < 768;
      const paddingValue = isMobile ? 20 : 80;
      const bounds = L.latLngBounds(
        [userLocation.lat, userLocation.lng],
        [routeInfo.to.lat, routeInfo.to.lng]
      );
      map.fitBounds(bounds, { padding: [paddingValue, paddingValue], animate: true });
    } else if (selectedIncident?.lat && selectedIncident?.lng) {
      map.flyTo([selectedIncident.lat, selectedIncident.lng], 15, { duration: 1.5 });
    }
  }, [routeInfo, selectedIncident, userLocation, map]);

  return null;
};

/* ---------------- MAIN APP ---------------- */

const MainApp: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { incidents, refresh } = useNepalData();
  const { isOffline } = useNetworkStatus();

  const { alerts } = useAlert();
  const { subscribe: pushSubscribe, supported: pushSupported } = usePushNotifications();
  const { isInstallable, install: triggerInstall } = usePWAInstall();

  const { profile: userProfile } = useUserProfile();
  const { leaderboard } = useLeaderboard(10);
  const { summary: analyticsSummary } = useAnalytics("7d");

  const { isSuperadmin, broadcast, purgeCache } = useSuperadmin();
  const { ask: geminiAsk } = useGemini();

  const { calculate: calculateETA } = useETA();
  const { calculate: calculateQuickETA } = useQuickETA();

  // Single source of truth for base URLs
  const wsUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
  const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "/api/v1";

  // Use explicit WebSocket URL if provided, otherwise derive from current host
  const { lastMessage } = useWebSocket(wsUrl, true);

  /* ---------------- STATE ---------------- */

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  // const [isBoardExpanded, setIsBoardExpanded] = useState(false); // Replaced by boardDisplayState

  const [boardDisplayState, setBoardDisplayState] = useState<BoardDisplayState>(BoardDisplayState.SPLIT);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startY, setStartY] = useState(0);
  const [initialBoardHeight, setInitialBoardHeight] = useState(0);
  const [currentBoardHeight, setCurrentBoardHeight] = useState(0); // This will be the dynamically adjusted height

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  const [mapEngine, setMapEngine] = useState<MapEngine>("nepal");
  const [mapLayer, setMapLayer] = useState<MapLayerType>("standard");

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const [activeContext, setActiveContext] = useState<'travel' | 'road' | 'service' | 'alert' | null>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [accentColor, setAccentColor] = useState(localStorage.getItem('merosadak_accent_color') || 'blue');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Mock Vehicle Health Data
  const [vehicleHealth] = useState({
    fuelLevel: 68,
    engineTemp: 92,
    tirePressure: "Optimal",
    batteryVoltage: 14.2,
    oilLife: 85
  });

  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const [pilotMode, setPilotMode] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [monsoonVisible, setMonsoonVisible] = useState(false);

  const addToast = useCallback((type: string, message: string) => {
    setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
    setTimeout(() => setToasts(prev => prev.slice(1)), 4000);
  }, []);

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
  const [activeTab, setActiveTab] = useState<'alerts' | 'chat'>('alerts');
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [serviceResults, setServiceResults] = useState<any[]>([]);
  const [activePersona, setActivePersona] = useState('safety');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');

  const [toasts, setToasts] = useState<any[]>([]);

  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [showDeployDashboard, setShowDeployDashboard] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('detailed');
  const [moodEQ, setMoodEQ] = useState(false);



  /** Performs a full system purge: Local Storage + Server Purge + Refresh */
  const handleSystemPurge = useCallback(async () => {
    if (window.confirm("Perform system-wide purge? This will clear all local data and attempt to reset system caches.")) {
      await clearAllStorage();
      if (isSuperadmin) await purgeCache();
      addToast("success", "System cache cleared. Refreshing engine...");
      setTimeout(() => window.location.reload(), 1500);
    }
  }, [isSuperadmin, purgeCache, addToast]);

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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setUpdateAvailable(true);
          addToast('info', `Optimization available - refresh to apply updates.`);
        }

        if (event.data?.type === 'SW_ACTIVATED') {
          console.log('[App] New version activated, ensuring cache hygiene...');
          // Optional: performing a silent storage index refresh
          initializeStorage();
        }
      });
    }

    navigator.geolocation?.getCurrentPosition((pos) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
    });

    setAppReady(true);
  }, []);

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
    if (serviceType && userLocation) {
      const loadServiceData = async () => {
        setIsProcessing(true);
        try {
          const results = await fetchServiceData(serviceType, userLocation.lat, userLocation.lng);
          setServiceResults(results);
        } catch (err) {
          console.error("[App] Service fetch failed:", err);
        } finally {
          setIsProcessing(false);
        }
      };
      loadServiceData();
    }
  }, [serviceType, userLocation]);

  /* ---------------- MAP CENTER ---------------- */

  const mapCenter = useMemo(() => {
    return userLocation ? [userLocation.lat, userLocation.lng] : [28.3949, 84.124];
  }, [userLocation]);

  const mapZoom = userLocation ? 13 : 7;

  /* ---------------- HANDLERS ---------------- */

  const handleServiceSelect = useCallback((service: string) => {
    setShowTraffic(service === "traffic");
    setMonsoonVisible(service === "monsoon");
    if (service) setBoardDisplayState(BoardDisplayState.SPLIT); // Show board in split view
  }, []);

  const handleTogglePilot = useCallback(() => {
    setPilotMode(prev => !prev);
    if (!pilotMode) { // If entering pilot mode
      setBoardDisplayState(BoardDisplayState.EXPANDED); // Pilot mode takes up more space
    } else { // If exiting pilot mode
      setBoardDisplayState(BoardDisplayState.HIDDEN);
    }
    addToast("info", "Pilot mode toggled");
  }, [addToast, pilotMode]);

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

  const handleAskAI = useCallback(async (text: string) => {
    setChatMessages(prev => [...prev, { role: "user", text }]);

    // Functional AI Endpoint
    const res = await apiFetch("/v1/gemini/query", {
      method: "POST",
      body: JSON.stringify({ prompt: text })
    });

    setChatMessages(prev => [
      ...prev,
      { role: "model", text: res?.data?.response || "No response" }
    ]);
  }, []);

  /* ---------------- ROUTE ---------------- */

  const handleUnifiedSelection = useCallback((result: SearchResult) => {
    if (!userLocation) return;
    setSelectedObject(result);
    setBoardDisplayState(BoardDisplayState.SPLIT);

    // Detect context based on result type
    if (result.type === 'road') {
      setActiveContext('road');
    } else if (result.type === 'poi') {
      setActiveContext('service');
    } else {
      setActiveContext('travel');
      const distance = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        result.lat || 0,
        result.lng || 0
      );

      setRouteInfo({
        from: { lat: userLocation.lat, lng: userLocation.lng, name: "You" },
        to: { lat: result.lat || 0, lng: result.lng || 0, name: result.name },
        distance,
        duration: distance / 40,
        highways: [],
        incidents: 0,
        blockedSections: 0,
        status: "clear"
      });
    }
  }, [userLocation]);

  /**
   * Unified handler for incident selection that triggers 
   * the split-view dashboard and map focus simultaneously.
   */
  const handleSelectIncident = useCallback((incident: TravelIncident) => {
    setSelectedIncident(incident);
    setBoardDisplayState(BoardDisplayState.SPLIT); // Show board in split view
    setActiveContext('alert');
    setServiceType('safety');
  }, []);

  // Drag handlers for the InfoBoard
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingBoard(true);
    setInitialBoardHeight(currentBoardHeight);
    setStartY('touches' in e ? e.touches[0].clientY : e.clientY);
  }, [currentBoardHeight]);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingBoard) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY; // Dragging up increases height, dragging down decreases

    let newHeight = initialBoardHeight + deltaY;
    const snapHeights = getSnapHeights();

    // Clamp height between 0 and screen height
    newHeight = Math.max(snapHeights.minimized, Math.min(newHeight, window.innerHeight));
    setCurrentBoardHeight(newHeight);

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

  // Attach global mouse/touch event listeners for dragging
  useEffect(() => {
    if (isDraggingBoard) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
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
      {showMapEngineSelector && (
        <MapEngineSelector onSelect={() => setShowMapEngineSelector(false)} />
      )}

      {!appReady && <LoadingScreen onComplete={() => setAppReady(true)} />}

      <div className={`h-screen w-screen ${isDarkMode ? "dark" : ""}`}>
        <div className={`flex flex-col h-full ${isLocked ? 'overflow-hidden' : 'overflow-y-auto scroll-smooth'}`}>
          {/* Map Section (Top) */}
          <div
            ref={mapContainerRef}
            className={`relative transition-all duration-300 ease-in-out ${isSearchActive ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'
              } ${isSearchActive ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
            style={{ height: mapHeight }}
          >
            <MapContainer
              center={mapCenter as any}
              zoom={mapZoom}
              minZoom={7}
              maxBounds={[[26.0, 80.0], [30.5, 88.5]]}
              maxBoundsViscosity={1.0}
              scrollWheelZoom="center" // Zoom focused on center (user)
              touchZoom="center" // Mobile pinch-to-zoom centered focus
              doubleClickZoom="center"
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapControls userLocation={userLocation} className="mb-12" />
              <BoundaryOverlay isDarkMode={isDarkMode} />
              {showTraffic && <TrafficFlowOverlay userLocation={userLocation} isVisible />}
              {monsoonVisible && <MonsoonRiskOverlay incidents={incidents} isDarkMode={isDarkMode} />}
              {routeInfo && userLocation && (
                <RouteDisplay route={routeInfo} userLocation={userLocation} />
              )}
              <MapViewControl
                userLocation={userLocation}
                routeInfo={routeInfo}
                selectedIncident={selectedIncident}
              />
            </MapContainer>
          </div>

          {/* Mid-Bar Search: Positioned exactly at the split */}
          <div className="z-[1200] -mt-8 px-4 flex justify-center">
            <SearchOverlayIntent
              isDarkMode={isDarkMode}
              userLocation={userLocation}
              onSelectDestination={handleUnifiedSelection}
              onAskAI={handleAskAI}
              onFocusChange={setIsSearchActive}
            />
          </div>

          {/* Information Service Dashboard (Bottom) */}
          {isInfoBoardVisible && (
            <div
              ref={boardRef}
              className={`bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) border-t border-white/20 dark:border-slate-800 shadow-2xl z-[700] flex flex-col`}
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
                  vehicleHealth={vehicleHealth}
                  onClose={handleInfoBoardClose}
                />
              ) : (
                <InfoBoard
                  onClose={handleInfoBoardClose}
                  activeTab={serviceType || 'safety'}
                  context={activeContext}
                  selectedObject={selectedObject}
                  data={serviceResults.length > 0 ? serviceResults : incidents}
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
        />

        <SystemMenu
          isOpen={systemMenuOpen}
          onClose={() => setSystemMenuOpen(false)}
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
          userProfile={userProfile}
          isSuperadmin={isSuperadmin}
          onBroadcast={broadcast}
          onPurgeCache={handleSystemPurge}
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
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          incidents={incidents}
          onSelectIncident={handleSelectIncident}
          chatMessages={chatMessages}
          onSendMessage={handleAskAI}
          isProcessing={isProcessing}
          isDarkMode={isDarkMode}
          onRefresh={handlePullRefresh}
          isRefreshing={isRefreshing}
          serviceType={serviceType}
          serviceResults={serviceResults}
          onSelectService={(service) => {
            setServiceType(service);
            handleServiceSelect(service || '');
          }}
          activePersona={activePersona}
          onPersonaChange={setActivePersona}
          voiceGender={voiceGender}
          onGenderChange={setVoiceGender}
          onToggleLayers={() => {
            setShowLayersPanel(true);
            setSidebarOpen(false);
          }}
          onToggleSystemMenu={() => setSystemMenuOpen(true)}
        />

        <FloatingMenu
          onServiceSelect={handleServiceSelect}
          onOpenCalculator={() => { }} // Hooked for future distance tools
          onOpenReport={() => { }} // Hooked for future reporting tools
          onTogglePilot={handleTogglePilot}
          activeService={serviceType}
          incidents={incidents}
          isDarkMode={isDarkMode}
        />

        <WeatherWidget userLocation={userLocation} isVisible={monsoonVisible} />

        <ToastContainer toasts={toasts} />

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
            onToggleMonsoon={() => setMonsoonVisible(!monsoonVisible)}
            monsoonVisible={monsoonVisible}
            onToggleTraffic={() => setShowTraffic(!showTraffic)}
            trafficVisible={showTraffic}
            onClearTiles={handleTilePurge}
            onOpenDistanceCalc={() => { }}
          />
        )}

        <UptimeRobotStats
          isOpen={showMonitoring}
          onClose={() => setShowMonitoring(false)}
        />

        {pilotMode && (
          <DriverDashboard onClose={handleInfoBoardClose} />
        )}

        {isOffline && <OfflineBanner />}

      </div>
    </>
  );
};

/* ---------------- WRAPPER ---------------- */

const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  </ErrorBoundary>
);

export default App;