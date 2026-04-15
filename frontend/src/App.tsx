import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { MapContainer, TileLayer } from "react-leaflet";
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
import { useETA, useQuickETA } from "./hooks/useETA";
import { useServiceData } from "./hooks/useServiceData";

import type { TravelIncident, ChatMessage } from "./types";
import { apiFetch } from "./api";
import { useTranslation } from "./i18n";

import {
  initializeStorage,
  themeService
} from "./services/storageIndexService";

import { HotUpdateManager } from "./services/hotUpdateManager";

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

/* ---------------- MAP EVENT HANDLER ---------------- */

const MapEventHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
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

  const { profile: userProfile } = useUserProfile();
  const { leaderboard } = useLeaderboard(10);
  const { summary: analyticsSummary } = useAnalytics("7d");

  const { isSuperadmin, broadcast, purgeCache } = useSuperadmin();
  const { ask: geminiAsk } = useGemini();

  const { calculate: calculateETA } = useETA();
  const { calculate: calculateQuickETA } = useQuickETA();

  const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:4000";
  const { lastMessage } = useWebSocket(apiBaseUrl, true);

  /* ---------------- STATE ---------------- */

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  const [mapEngine, setMapEngine] = useState<MapEngine>("nepal");
  const [mapLayer, setMapLayer] = useState<MapLayerType>("standard");

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const [pilotMode, setPilotMode] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [monsoonVisible, setMonsoonVisible] = useState(false);

  // Pull to refresh
  const { isPulling, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
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

  const addToast = useCallback((type: string, message: string) => {
    setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
    setTimeout(() => setToasts(prev => prev.slice(1)), 4000);
  }, []);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    initializeStorage();
    themeService.applyToDocument();
    HotUpdateManager.init();

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          addToast('info', `App updated to v${event.data.version} - refresh to see changes`);
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
      pushSubscribe().catch(() => {});
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

  /* ---------------- MAP CENTER ---------------- */

  const mapCenter = useMemo(() => {
    return userLocation ? [userLocation.lat, userLocation.lng] : [28.3949, 84.124];
  }, [userLocation]);

  const mapZoom = userLocation ? 13 : 7;

  /* ---------------- HANDLERS ---------------- */

  const handleServiceSelect = useCallback((service: string) => {
    setShowTraffic(service === "traffic");
    setMonsoonVisible(service === "monsoon");
  }, []);

  const handleTogglePilot = useCallback(() => {
    setPilotMode(prev => !prev);
    addToast("info", "Pilot mode toggled");
  }, [addToast]);

  const handleAskAI = useCallback(async (text: string) => {
    setChatMessages(prev => [...prev, { role: "user", text }]);

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

  const handleSelectDestination = useCallback((result: SearchResult) => {
    if (!userLocation) return;

    const distance = calculateHaversineDistance(
      userLocation.lat,
      userLocation.lng,
      result.lat || 0,
      result.lng || 0
    );

    setSelectedDestination(result);

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
  }, [userLocation]);

  /* ---------------- RENDER ---------------- */

  return (
    <>
      {showMapEngineSelector && (
        <MapEngineSelector onSelect={() => setShowMapEngineSelector(false)} />
      )}

      {!appReady && <LoadingScreen onComplete={() => setAppReady(true)} />}

      <div className={`h-screen w-screen ${isDarkMode ? "dark" : ""}`}>

        <MapContainer center={mapCenter as any} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapControls userLocation={userLocation} />
          <BoundaryOverlay isDarkMode={isDarkMode} />

          {showTraffic && <TrafficFlowOverlay userLocation={userLocation} isVisible />}
          {monsoonVisible && <MonsoonRiskOverlay incidents={incidents} isDarkMode={isDarkMode} />}

          {routeInfo && userLocation && (
            <RouteDisplay route={routeInfo} userLocation={userLocation} />
          )}

        </MapContainer>

        <Header
          isDarkMode={isDarkMode}
          onToggleMenu={() => setSidebarOpen(v => !v)}
          onToggleSystemMenu={() => setSystemMenuOpen(v => !v)}
          onTogglePilot={handleTogglePilot}
          noticeCount={incidents.length}
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          incidents={incidents}
          onSelectIncident={(incident) => {
            // Handle incident selection - could center map on incident
            if (incident.lat && incident.lng) {
              // Map centering logic would go here
            }
          }}
          chatMessages={chatMessages}
          onSendMessage={handleAskAI}
          isProcessing={isProcessing}
          isDarkMode={isDarkMode}
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
        />

        <FloatingMenu onServiceSelect={handleServiceSelect} />

        <SearchOverlayIntent
          isDarkMode={isDarkMode}
          userLocation={userLocation}
          onSelectDestination={handleSelectDestination}
          onAskAI={handleAskAI}
        />

        <WeatherWidget userLocation={userLocation} isVisible={monsoonVisible} />

        <ToastContainer toasts={toasts} />

        <UpdateBanner 
          visible={updateAvailable}
          onUpdate={() => HotUpdateManager.applyUpdate(true)}
          onLater={() => { setUpdateAvailable(false); HotUpdateManager.dismissUpdate(); }}
        />

        {pilotMode && (
          <DriverDashboard onClose={() => setPilotMode(false)} />
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