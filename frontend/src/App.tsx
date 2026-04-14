import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
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
import { useETA, useQuickETA } from "./hooks/useETA";
import { useServiceData } from "./hooks/useServiceData";
import { TravelIncident, ChatMessage } from "./types";
import { apiFetch } from "./api";
import { useTranslation } from "./i18n";

// Storage services
import { initializeStorage, mapStateService, themeService, offlineSearchService } from "./services/storageIndexService";

import BoundaryOverlay from "./components/BoundaryOverlay";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { FloatingMenu } from "./components/FloatingMenu";
import SearchOverlay from "./components/SearchOverlay";
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
import { SearchOverlayEnhanced } from "./components/SearchOverlayEnhanced";
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
import { MapEngineSelector, type MapEngine } from "./components/MapEngineSelector";
import { MapLayersToggle, type MapLayerType } from "./components/MapLayersToggle";
import { InfoBoard } from "./components/InfoBoard";
import { MapLabel } from "./components/MapLabel";
import { recordPOIInteraction } from "./services/userPreferencesService";
import { registerPushNotifications } from "./services/pushNotificationService";
import type { Toast } from "./components/Toast";
import type { SearchResult, RouteInfo } from "./services/enhancedSearchService";
import type { TravelPlan, TripBriefing, ChecklistItem } from "./types/travelPlan";
import type { IntentResult } from "./services/searchIntent";
import {
  saveTravelPlan,
  getActivePlansCount,
  generateChecklist,
  generateTripBriefing,
  getActivePlan,
  setActivePlan,
  updatePlanStatus,
  markBriefingShown
} from "./services/travelPlanService";
import { hasCompletedOnboarding, getUserPOIPreferences } from "./services/userPreferencesService";
import type { UserPOIPreferences, POICategory } from "./types/poi";

// Haversine distance calculation
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_KM = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

const MapEventHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MainApp: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { incidents, isLoading, refresh } = useNepalData();
  const { isOffline } = useNetworkStatus();

  // Integrated unused hooks
  const { alerts, dismiss: dismissAlert, success: alertSuccess, error: alertError, info: alertInfo, warning: alertWarning } = useAlert();
  const { subscribed: pushSubscribed, loading: pushLoading, error: pushError, supported: pushSupported, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const { profile: userProfile, loading: profileLoading, error: profileError, refetch: refetchProfile, updatePreferences, addSavedLocation, removeSavedLocation } = useUserProfile();
  const { leaderboard, loading: leaderboardLoading, error: leaderboardError, refetch: refetchLeaderboard } = useLeaderboard(10);
  const { summary: analyticsSummary, trends: analyticsTrends, topDistricts, topHighways, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics('7d');
  const { isSuperadmin, broadcast: broadcastMessage, purge: purgeCache, isBusy: superadminBusy } = useSuperadmin();
  const { messages: geminiMessages, isProcessing: geminiProcessing, ask: geminiAsk, getSummary: geminiSummary, clearChat: geminiClearChat } = useGemini();
  const { plan: routePlan, loading: routePlanningLoading, error: routePlanningError, planRoute, compareRoutes: compareRouteRoutes, getSafety: getRouteSafety } = useRoutePlanning();
  const { eta, loading: etaLoading, error: etaError, calculate: calculateETA } = useETA();
  const { eta: quickEta, loading: quickEtaLoading, error: quickEtaError, calculate: calculateQuickETA } = useQuickETA();
  const { data: serviceData, isLoading: serviceDataLoading, error: serviceDataError, lastSync: serviceLastSync, refresh: refreshServiceData } = useServiceData(serviceType, userLocation?.lat || 0, userLocation?.lng || 0, isLoading);

  // WebSocket for real-time updates
  const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:4000';
  const { isConnected: wsConnected, lastMessage } = useWebSocket(apiBaseUrl, true);

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [refresh]);

  // Handle WebSocket messages (real-time incident updates)
  useEffect(() => {
    if (lastMessage?.type === 'data_update' && lastMessage.dataType === 'incidents') {
      refresh();
    }
  }, [lastMessage, refresh]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'chat'>('alerts');
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TravelIncident | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [highwayBrowserOpen, setHighwayBrowserOpen] = useState(false);
  const [reportIncidentOpen, setReportIncidentOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [pilotMode, setPilotMode] = useState(false);
  const [mapLayersOpen, setMapLayersOpen] = useState(false);
  const [showDeployDashboard, setShowDeployDashboard] = useState(false);
  const [showMonitoringStats, setShowMonitoringStats] = useState(false);
  // pushSubscribed now comes from usePushNotifications hook
  const [monsoonVisible, setMonsoonVisible] = useState(false);
  const [distanceCalcOpen, setDistanceCalcOpen] = useState(false);
  const [distancePoints, setDistancePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [appReady, setAppReady] = useState(false);
  const [selectedHighway, setSelectedHighway] = useState<string | null>(null);

  // Map engine & layer states (for MapEngineSelector + MapLayersToggle)
  const [mapEngine, setMapEngine] = useState<MapEngine>('nepal');
  const [mapLayer, setMapLayer] = useState<MapLayerType>('standard');
  const [showHighways, setShowHighways] = useState(false);
  const [roadFilters, setRoadFilters] = useState<{ blocked: boolean; oneway: boolean; resumed: boolean }>({ blocked: false, oneway: false, resumed: false });
  const [showMapEngineSelector, setShowMapEngineSelector] = useState(true);
  const [infoBoardOpen, setInfoBoardOpen] = useState(false);
  const [mapLabels, setMapLabels] = useState<Array<{ position: [number, number]; text: string; fontSize?: number; color?: string }>>([]);

  // Enhanced search states
  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [showContextCards, setShowContextCards] = useState(false);

  // Travel plan states
  const [showMyPlans, setShowMyPlans] = useState(false);
  const [activePlan, setActivePlanState] = useState<TravelPlan | null>(null);
  const [showPreTripBriefing, setShowPreTripBriefing] = useState(false);
  const [tripBriefing, setTripBriefing] = useState<TripBriefing | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Plans badge count
  const [plansCount, setPlansCount] = useState(getActivePlansCount());

  // POI personalization states
  const [showPreferencesScreen, setShowPreferencesScreen] = useState(!hasCompletedOnboarding());
  const [userPOIPrefs, setUserPOIPrefs] = useState<UserPOIPreferences>(getUserPOIPreferences());
  const [selectedPOICategory, setSelectedPOICategory] = useState<POICategory | null>(null);

  // Traffic layer state
  const [showTraffic, setShowTraffic] = useState(false);

  // Search intent state
  const [currentSearchIntent, setCurrentSearchIntent] = useState<IntentResult | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const mapCenter = useMemo(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [28.3949, 84.1240];
  }, [userLocation]);

  const mapZoom = useMemo(() => {
    return userLocation ? 13 : 7;
  }, [userLocation]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [moodEQ, setMoodEQ] = useState(false);
  const [activePersona, setActivePersona] = useState('safety');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error("Geolocation error:", error)
      );
    }
  }, []);

  // Register push notifications using the hook
  useEffect(() => {
    if (appReady && pushSupported) {
      pushSubscribe().catch(() => { });
    }
  }, [appReady, pushSupported, pushSubscribe]);

  // Initialize storage services on mount
  useEffect(() => {
    initializeStorage();
    themeService.applyToDocument();
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      setIsDarkMode(themeService.isDark());
    };
    window.addEventListener('merosadak_theme_change', handleThemeChange);
    // Set initial dark mode from service
    setIsDarkMode(themeService.isDark());
    return () => window.removeEventListener('merosadak_theme_change', handleThemeChange);
  }, []);

  // Apply dark mode class to document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    themeService.toggle();
    setIsDarkMode(themeService.isDark());
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    console.log("Map clicked at:", lat, lng);
  }, []);

  const handleServiceSelect = useCallback((service: string) => {
    setServiceType(prev => prev === service ? null : service);
    setActiveTab('alerts');
  }, []);

  const handleOpenCalculator = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleOpenReport = useCallback(() => {
    // Close other modals to prevent conflicts
    setHighwayBrowserOpen(false);
    setReportIncidentOpen(true);
  }, []);

  const handleTogglePilot = useCallback(() => {
    setPilotMode(prev => !prev);
    if (!pilotMode) {
      addToast('info', 'Pilot mode enabled — hazards and road conditions highlighted');
      // Close all other panels when entering pilot mode
      setSidebarOpen(false);
      setSystemMenuOpen(false);
      setMapLayersOpen(false);
      setDistanceCalcOpen(false);
      setHighwayBrowserOpen(false);
    }
  }, [pilotMode, addToast]);

  const handleToggleMapLayers = useCallback(() => {
    setMapLayersOpen(prev => {
      if (!prev) {
        // Opening: close SystemMenu to prevent overlap
        setSystemMenuOpen(false);
      }
      return !prev;
    });
  }, []);

  const handleToggleMonsoon = useCallback(() => {
    setMonsoonVisible(prev => !prev);
  }, []);

  const handleOpenDistanceCalc = useCallback(() => {
    setDistanceCalcOpen(prev => {
      if (!prev) {
        // Opening: close SystemMenu to prevent overlap
        setSystemMenuOpen(false);
      }
      return !prev;
    });
  }, []);

  // Map engine & layer handlers
  const handleMapEngineChange = useCallback((engine: MapEngine) => {
    setMapEngine(engine);
  }, []);

  const handleLayerChange = useCallback((layer: MapLayerType) => {
    setMapLayer(layer);
  }, []);

  const handleFilterToggle = useCallback((filter: 'blocked' | 'oneway' | 'resumed') => {
    setRoadFilters(prev => ({ ...prev, [filter]: !prev[filter] }));
  }, []);

  const handleResetEngine = useCallback(() => {
    setMapEngine('nepal');
  }, []);

  const handleToggleHighways = useCallback(() => {
    setShowHighways(prev => !prev);
  }, []);

  const handleOpenHighwayBrowser = useCallback(() => {
    setHighwayBrowserOpen(true);
  }, []);

  const handleMapEngineSelect = useCallback((engine: MapEngine) => {
    setMapEngine(engine);
    setShowMapEngineSelector(false);
  }, []);

  const handleSelectHighway = useCallback((code: string) => {
    setSelectedHighway(code);
    setHighwayBrowserOpen(false);
    addToast('info', `Selected highway: ${code}`);
  }, [addToast]);

  // Handle destination selection from search
  const handleSelectDestination = useCallback(async (result: SearchResult) => {
    if (!userLocation) {
      addToast('error', 'Location not available. Please enable GPS.');
      return;
    }

    setSelectedDestination(result);

    // Calculate simple route info
    const distance = calculateHaversineDistance(
      userLocation.lat, userLocation.lng,
      result.lat || 0, result.lng || 0
    );

    const estimatedDuration = distance / 40; // Assume 40 km/h average

    // Check if there are incidents on route (simplified)
    const incidentsOnRoute = incidents.filter(i => {
      if (!i.lat || !i.lng) return false;
      const dist = calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        i.lat, i.lng
      );
      return dist < distance * 0.3; // Within 30% of route distance
    });

    const blockedCount = incidentsOnRoute.filter(i =>
      i.status?.toLowerCase().includes('block')
    ).length;

    const route: RouteInfo = {
      from: {
        lat: userLocation.lat,
        lng: userLocation.lng,
        name: 'Your Location'
      },
      to: {
        lat: result.lat || 0,
        lng: result.lng || 0,
        name: result.name
      },
      distance,
      duration: estimatedDuration,
      highways: [], // Would be populated from routing API
      incidents: incidentsOnRoute.length,
      blockedSections: blockedCount,
      status: blockedCount > 0 ? 'blocked' : incidentsOnRoute.length > 0 ? 'partial' : 'clear'
    };

    setRouteInfo(route);
    setShowContextCards(true);
    addToast('success', `Route to ${result.name}: ${distance.toFixed(0)} km`);
  }, [userLocation, incidents, addToast]);

  // Clear destination and route
  const handleClearDestination = useCallback(() => {
    setSelectedDestination(null);
    setRouteInfo(null);
    setShowContextCards(false);
  }, []);

  // Save current destination as travel plan
  const handleSavePlan = useCallback(() => {
    if (!selectedDestination || !routeInfo) return;

    const plan: TravelPlan = {
      id: `plan-${Date.now()}`,
      name: `Trip to ${selectedDestination.name}`,
      destination: {
        name: selectedDestination.name,
        lat: selectedDestination.lat || 0,
        lng: selectedDestination.lng || 0
      },
      origin: userLocation ? {
        name: 'Your Location',
        lat: userLocation.lat,
        lng: userLocation.lng
      } : undefined,
      distance: routeInfo.distance,
      estimatedDuration: routeInfo.duration,
      createdAt: new Date().toISOString(),
      status: 'planned',
      routeStatus: {
        blockedSections: routeInfo.blockedSections,
        incidents: routeInfo.incidents,
        lastChecked: new Date().toISOString()
      }
    };

    saveTravelPlan(plan);
    setPlansCount(getActivePlansCount());
    addToast('success', 'Trip saved! We\'ll alert you before departure.');
  }, [selectedDestination, routeInfo, userLocation, addToast]);

  // Select a saved plan
  const handleSelectPlan = useCallback((plan: TravelPlan) => {
    setShowMyPlans(false);

    // Set as destination
    setSelectedDestination({
      id: `plan-${plan.id}`,
      type: 'place',
      name: plan.destination.name,
      icon: '📍',
      lat: plan.destination.lat,
      lng: plan.destination.lng
    });

    // Recalculate route
    if (userLocation) {
      const distance = calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        plan.destination.lat, plan.destination.lng
      );

      const route: RouteInfo = {
        from: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          name: 'Your Location'
        },
        to: {
          lat: plan.destination.lat,
          lng: plan.destination.lng,
          name: plan.destination.name
        },
        distance: plan.distance,
        duration: plan.estimatedDuration,
        highways: [],
        incidents: plan.routeStatus?.incidents || 0,
        blockedSections: plan.routeStatus?.blockedSections || 0,
        status: (plan.routeStatus?.blockedSections || 0) > 0 ? 'blocked' : (plan.routeStatus?.incidents || 0) > 0 ? 'partial' : 'clear'
      };

      setRouteInfo(route);
      setShowContextCards(true);
      setActivePlanState(plan);
      addToast('info', `Loaded plan: ${plan.name}`);
    }
  }, [userLocation, addToast]);

  // Start trip from plan
  const handleStartTrip = useCallback((plan?: TravelPlan) => {
    const planToUse = plan || activePlan;
    if (!planToUse) return;

    setActivePlanState(planToUse);
    setCurrentPlanId(planToUse.id);
    updatePlanStatus(planToUse.id, 'active');

    // Show pre-trip briefing if not dismissed
    const briefing = generateTripBriefing(planToUse);
    setTripBriefing(briefing);

    if (!planToUse.aiBriefingShown) {
      setShowPreTripBriefing(true);
    } else {
      // Show checklist directly
      const items = generateChecklist(planToUse);
      setChecklistItems(items);
      setShowChecklist(true);
    }
  }, [activePlan]);

  // Complete checklist and start pilot mode
  const handleCompleteChecklist = useCallback(() => {
    setShowChecklist(false);
    if (currentPlanId) {
      markBriefingShown(currentPlanId);
    }
    // Enter pilot mode
    setPilotMode(true);
    setSidebarOpen(false);
    setSystemMenuOpen(false);
    setMapLayersOpen(false);
    setDistanceCalcOpen(false);
    setHighwayBrowserOpen(false);
    addToast('info', 'Pilot mode enabled — have a safe trip!');
  }, [currentPlanId, addToast]);

  // Dismiss checklist
  const handleDismissChecklist = useCallback(() => {
    setShowChecklist(false);
  }, []);

  // Dismiss pre-trip briefing
  const handleDismissBriefing = useCallback(() => {
    setShowPreTripBriefing(false);
    if (currentPlanId) {
      markBriefingShown(currentPlanId);
    }
    // Show checklist after dismissing briefing
    if (activePlan) {
      const items = generateChecklist(activePlan);
      setChecklistItems(items);
      setShowChecklist(true);
    }
  }, [currentPlanId, activePlan]);

  // Handle preferences completion
  const handlePreferencesComplete = useCallback((prefs: UserPOIPreferences) => {
    setUserPOIPrefs(prefs);
    setShowPreferencesScreen(false);
    addToast('success', 'Preferences saved! Your experience is now personalized.');
  }, [addToast]);

  // Handle preferences skip
  const handlePreferencesSkip = useCallback(() => {
    setShowPreferencesScreen(false);
    setUserPOIPrefs(getUserPOIPreferences());
  }, []);

  // Handle POI category selection
  const handlePOICategorySelect = useCallback((category: POICategory) => {
    setSelectedPOICategory(prev => prev === category ? null : category);
    recordPOIInteraction(category, 'select');
  }, []);

  // Handle search intent changes
  const handleSearchIntent = useCallback((intent: IntentResult) => {
    setCurrentSearchIntent(intent);

    // Auto-enable traffic overlay when traffic is searched
    if (intent.intent === 'traffic') {
      setShowTraffic(true);
    }
  }, []);

  const handleDownloadOfflineMap = useCallback(() => {
    // Trigger PouchDB tile caching for the current map view
    // This downloads map tiles for offline use
    if ((window as any).triggerOfflineMapDownload) {
      (window as any).triggerOfflineMapDownload();
    } else {
      // Fallback: show toast
      addToast('info', 'Offline maps: Navigate to an area to cache tiles');
    }
  }, [addToast]);

  const handleSelectIncident = useCallback((incident: TravelIncident) => {
    setSelectedItem(incident);
    setSidebarOpen(false);
  }, []);

  const handleSelectLocation = useCallback((incident: TravelIncident) => {
    if (incident.lat && incident.lng) {
      console.log("Navigate to:", incident.lat, incident.lng);
    }
  }, []);

  const handleAskAI = useCallback(async (query: string, image?: string) => {
    setChatMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsProcessing(true);
    setActiveTab('chat');
    setSidebarOpen(true);

    try {
      // Build system prompt with context
      const systemContext = `You are MeroSadak AI, a helpful road safety assistant for Nepal travelers.
Current context:
- ${incidents.length} active incidents on roads
- User location: ${userLocation ? `${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}` : 'Not available'}
- AI Mode: ${aiMode} (safe=conservative, pro=detailed)
- Verbosity: ${verbosity} (brief or detailed)
- Mood EQ: ${moodEQ ? 'ON (be empathetic)' : 'OFF (be factual)'}
- Voice: ${voiceGender}

Be helpful, concise, and safety-focused. Reference actual incidents when relevant.`;

      const result = await apiFetch<any>('/v1/gemini/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          systemPrompt: systemContext,
          image: image || null,
          mode: aiMode,
          verbosity: verbosity,
          moodEQ: moodEQ
        })
      });

      if (result.success && result.data?.response) {
        setChatMessages(prev => [...prev, { role: 'model', text: result.data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'model', text: "I'm analyzing the road conditions for you. Please check the map for current alerts." }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to the travel assistant. Please try again." }]);
    } finally {
      setIsProcessing(false);
    }
  }, [incidents, userLocation, voiceGender, aiMode, verbosity, moodEQ]);

  const handleSendMessage = useCallback(async (text: string, image?: string) => {
    await handleAskAI(text);
  }, [handleAskAI]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      if (!prev) {
        // Opening sidebar: close system menu to prevent overlap
        setSystemMenuOpen(false);
      }
      return !prev;
    });
  }, []);

  const toggleSystemMenu = useCallback(() => {
    setSystemMenuOpen(prev => {
      if (!prev) {
        // Opening system menu: close map layers panel to prevent overlap
        setMapLayersOpen(false);
      }
      return !prev;
    });
  }, []);

  const serviceResults = useMemo(() => {
    if (!serviceType) return [];
    return incidents.filter(i => {
      const type = (i.type || '').toLowerCase();
      return type.includes(serviceType);
    });
  }, [serviceType, incidents]);





  return (
    <>
      {/* Map Engine Selector - splash screen on first load */}
      {showMapEngineSelector && (
        <MapEngineSelector onSelect={handleMapEngineSelect} />
      )}

      {/* Loading Screen - shown until geolocation + initial data loaded */}
      {!appReady && !showMapEngineSelector && <LoadingScreen onComplete={() => setAppReady(true)} />}

      <div className={`h-screen w-screen relative transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`} style={{ opacity: appReady ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          minZoom={6}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          maxBounds={[
            [26.35, 80.06],
            [30.47, 88.20]
          ]}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            url={
              mapEngine === 'world'
                ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                : mapLayer === 'satellite'
                  ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  : mapLayer === 'terrain'
                    ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    : isDarkMode
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <MapEventHandler onMapClick={handleMapClick} />
          <BoundaryOverlay isDarkMode={isDarkMode} />
          <MapControls userLocation={userLocation} />

          {/* POI Overlay - shows markers when category selected */}
          {selectedPOICategory && userLocation && (
            <POIOverlay
              category={selectedPOICategory}
              userLocation={userLocation}
              mapCenter={mapCenter as [number, number]}
              mapZoom={mapZoom}
              userPreferences={userPOIPrefs}
              onSelectPOI={(poi) => {
                addToast('info', `${poi.icon} ${poi.name} · ${poi.distance?.toFixed(1)} km`);
              }}
            />
          )}

          {/* Traffic Flow Overlay - colored polylines + Waze alerts */}
          {showTraffic && userLocation && (
            <TrafficFlowOverlay
              userLocation={userLocation}
              isVisible={showTraffic}
            />
          )}

          {/* Route Display */}
          {routeInfo && userLocation && (
            <RouteDisplay
              route={routeInfo}
              userLocation={userLocation}
              showAlternatives={true}
            />
          )}

          {/* Highway Highlight Overlay */}
          {selectedHighway && (
            <HighwayHighlightOverlay
              highwayCode={selectedHighway}
              isVisible={true}
            />
          )}

          {/* Map Labels for selected highway */}
          {selectedHighway && mapLabels.map((label, idx) => (
            <MapLabel
              key={`label-${idx}`}
              position={label.position}
              text={label.text}
              fontSize={label.fontSize}
              color={label.color}
            />
          ))}

          {/* Monsoon/Rain Risk Overlay - toggled via SystemMenu */}
          {monsoonVisible && <MonsoonRiskOverlay incidents={incidents} isDarkMode={isDarkMode} />}

          {/* Map Layers Panel + Toggle */}
          {mapLayersOpen && (
            <MapLayersPanel
              isDarkMode={isDarkMode}
              onClose={() => setMapLayersOpen(false)}
              onToggleMonsoon={handleToggleMonsoon}
              monsoonVisible={monsoonVisible}
              onToggleTraffic={() => setShowTraffic(prev => !prev)}
              trafficVisible={showTraffic}
              onOpenDistanceCalc={handleOpenDistanceCalc}
            />
          )}

          {/* MapLayersToggle - comprehensive layers panel */}
          {!mapLayersOpen && (
            <MapLayersToggle
              currentLayer={mapLayer}
              onLayerChange={handleLayerChange}
              activeFilters={roadFilters}
              onFilterToggle={handleFilterToggle}
              isDarkMode={isDarkMode}
              mapEngine={mapEngine}
              onMapEngineChange={handleMapEngineChange}
              onResetEngine={handleResetEngine}
              showHighways={showHighways}
              onToggleHighways={handleToggleHighways}
              onOpenHighwayBrowser={handleOpenHighwayBrowser}
            />
          )}
        </MapContainer>

        <Header
          isDarkMode={isDarkMode}
          onTogglePilot={handleTogglePilot}
          onToggleMenu={toggleSidebar}
          onToggleSystemMenu={toggleSystemMenu}
          onOpenNotifications={() => { }}
          onToggleMyPlans={() => setShowMyPlans(true)}
          plansCount={plansCount}
          noticeCount={incidents.filter(i => i.severity === 'high').length}
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          incidents={incidents}
          onSelectIncident={handleSelectIncident}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessing}
          isDarkMode={isDarkMode}
          onRefresh={refresh}
          serviceType={serviceType}
          serviceResults={serviceResults}
          onSelectService={setServiceType}
          activePersona={activePersona}
          onPersonaChange={setActivePersona}
          voiceGender={voiceGender}
          onGenderChange={setVoiceGender}
        />

        <FloatingMenu
          onServiceSelect={handleServiceSelect}
          onOpenCalculator={handleOpenCalculator}
          onOpenReport={handleOpenReport}
          onTogglePilot={handleTogglePilot}
          activeService={serviceType}
          incidents={incidents}
        />

        {/* Smart Search Overlay with Intent Detection */}
        <SearchOverlayIntent
          isDarkMode={isDarkMode}
          userLocation={userLocation}
          onSelectDestination={handleSelectDestination}
          onAskAI={handleAskAI}
          onIntentChange={handleSearchIntent}
        />

        {/* Original SearchOverlay - Voice search + AI button + incident filtering */}
        {!selectedDestination && (
          <SearchOverlay
            isDarkMode={isDarkMode}
            incidents={incidents}
            onSelectLocation={handleSelectIncident}
            onAskAI={handleAskAI}
            onSelectItem={handleSelectIncident}
          />
        )}

        {/* POI Category Selector - shows below search when active */}
        {!showContextCards && (
          <div className="absolute top-44 left-4 right-4 md:left-8 md:right-8 z-[499]">
            <POICategorySelector
              isDarkMode={isDarkMode}
              selectedCategory={selectedPOICategory}
              onSelect={handlePOICategorySelect}
              userPreferences={userPOIPrefs}
            />
          </div>
        )}

        {/* Route Info Banner - shows when destination selected */}
        {selectedDestination && !showContextCards && (
          <div className="absolute top-40 left-4 right-4 md:left-8 md:right-8 z-[500] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                  <span className="text-xl">📍</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{selectedDestination.name}</p>
                  {routeInfo && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {routeInfo.distance.toFixed(0)} km · {routeInfo.duration.toFixed(1)} hours
                      {routeInfo.blockedSections > 0 && (
                        <span className="text-red-600 dark:text-red-400 ml-2 font-bold">
                          ⚠️ {routeInfo.blockedSections} blocked
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleSavePlan}
                  className="px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  💾 Save
                </button>
                <button
                  onClick={() => handleStartTrip()}
                  className="px-3 py-2 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  🚀 Start
                </button>
                <button
                  onClick={handleClearDestination}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        <SystemMenu
          isDarkMode={isDarkMode}
          toggleTheme={toggleDarkMode}
          isOpen={systemMenuOpen}
          onClose={() => setSystemMenuOpen(false)}
          voiceGender={voiceGender}
          setVoiceGender={setVoiceGender}
          aiMode={aiMode}
          setAiMode={setAiMode}
          verbosity={verbosity}
          setVerbosity={setVerbosity}
          moodEQ={moodEQ}
          setMoodEQ={setMoodEQ}
          onDownloadOfflineMap={handleDownloadOfflineMap}
          onToggleLayers={handleToggleMapLayers}
          onToggleDeployDashboard={() => { setShowDeployDashboard(!showDeployDashboard); setSystemMenuOpen(false); }}
          onToggleMonitoring={() => { setShowMonitoringStats(!showMonitoringStats); setSystemMenuOpen(false); }}
          userProfile={userProfile}
          isSuperadmin={isSuperadmin}
          onBroadcast={broadcastMessage}
          onPurgeCache={purgeCache}
          superadminBusy={superadminBusy}
          onToggleInfoBoard={() => setInfoBoardOpen(prev => !prev)}
        />

        <BottomInfoArea
          selectedItem={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSelectLocation={handleSelectLocation}
          onAskAI={handleAskAI}
          isDarkMode={isDarkMode}
        />

        {/* InfoBoard - App directory showing services */}
        <InfoBoard
          onServiceSelect={(service) => {
            setServiceType(service);
            setInfoBoardOpen(!!service);
          }}
          activeService={serviceType}
          isDarkMode={isDarkMode}
        />

        {/* Contextual Info Cards - shows weather, traffic, POIs for destination */}
        {showContextCards && selectedDestination?.lat && selectedDestination?.lng && (
          <div className="fixed bottom-0 left-0 right-0 z-[2200] max-h-[40vh] overflow-y-auto">
            <ContextualInfoCards
              destination={{
                name: selectedDestination.name,
                lat: selectedDestination.lat,
                lng: selectedDestination.lng
              }}
              weather={undefined} // Would fetch from weather service
              traffic={undefined} // Would fetch from traffic service
              pois={[]} // Would fetch from POI service
              monsoonRisk={undefined}
            />
          </div>
        )}

        <HighwayBrowser
          isOpen={highwayBrowserOpen}
          onClose={() => setHighwayBrowserOpen(false)}
          onSelectHighway={handleSelectHighway}
          incidents={incidents}
        />

        <ReportIncidentOverlay
          isOpen={reportIncidentOpen}
          onClose={() => setReportIncidentOpen(false)}
          location={userLocation || undefined}
          onSuccess={() => addToast('success', 'Incident reported successfully!')}
        />

        <SOSOverlay
          isOpen={sosOpen}
          onClose={() => setSosOpen(false)}
          userLocation={userLocation}
        />

        {/* My Plans Panel */}
        {showMyPlans && (
          <MyPlansPanel
            isDarkMode={isDarkMode}
            onSelectPlan={handleSelectPlan}
            onStartPlan={handleStartTrip}
            onClose={() => setShowMyPlans(false)}
          />
        )}

        {/* Pre-Trip Briefing */}
        {showPreTripBriefing && tripBriefing && (
          <PreTripBriefing
            isDarkMode={isDarkMode}
            briefing={tripBriefing}
            onStartTrip={() => {
              setShowPreTripBriefing(false);
              if (activePlan) {
                const items = generateChecklist(activePlan);
                setChecklistItems(items);
                setShowChecklist(true);
              }
            }}
            onAskAI={() => {
              setShowPreTripBriefing(false);
              setActiveTab('chat');
              setSidebarOpen(true);
            }}
            onClose={() => setShowPreTripBriefing(false)}
            onDismiss={handleDismissBriefing}
          />
        )}

        {/* Belongings Checklist */}
        {showChecklist && (
          <BelongingsChecklist
            isDarkMode={isDarkMode}
            items={checklistItems}
            onCheck={(itemId) => {
              setChecklistItems(prev =>
                prev.map(item =>
                  item.id === itemId ? { ...item, checked: !item.checked } : item
                )
              );
            }}
            onComplete={handleCompleteChecklist}
            onDismiss={handleDismissChecklist}
          />
        )}

        {/* User Preferences Screen - shows on first launch */}
        {showPreferencesScreen && (
          <UserPreferencesScreen
            isDarkMode={isDarkMode}
            onComplete={handlePreferencesComplete}
            onSkip={handlePreferencesSkip}
          />
        )}

        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Deploy Dashboard Overlay */}
        {showDeployDashboard && (
          <div className="fixed bottom-20 right-4 z-[1000] w-[90vw] md:w-[400px] max-h-[70vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 animate-in slide-in-from-bottom-10 backdrop-blur-3xl">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setShowDeployDashboard(false)}
                className="w-8 h-8 rounded-full bg-slate-800/80 text-white flex items-center justify-center hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <DeployDashboard
              isDarkMode={isDarkMode}
              analyticsSummary={analyticsSummary}
              analyticsTrends={analyticsTrends}
              topDistricts={topDistricts}
              topHighways={topHighways}
              analyticsLoading={analyticsLoading}
              onRefetchAnalytics={refetchAnalytics}
              isSuperadmin={isSuperadmin}
              onBroadcast={broadcastMessage}
              onPurgeCache={purgeCache}
              superadminBusy={superadminBusy}
            />
          </div>
        )}

        {/* UptimeRobot Monitoring Stats */}
        <UptimeRobotStats
          isOpen={showMonitoringStats}
          onClose={() => setShowMonitoringStats(false)}
        />

        {/* Quick Action FABs */}
        <div className="fixed bottom-4 left-4 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => setSosOpen(true)}
            className="w-12 h-12 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center hover:bg-red-700 active:scale-95 transition-all"
            title="Emergency SOS"
          >
            <span className="text-xl">🚨</span>
          </button>
          <button
            onClick={() => setHighwayBrowserOpen(true)}
            className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-xl border border-white/40 shadow-lg flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
            title="Highway Browser"
          >
            <span className="text-xl">🛣️</span>
          </button>
        </div>

        {/* Driver Dashboard (Pilot Mode) */}
        {pilotMode && (
          <DriverDashboard
            onClose={() => setPilotMode(false)}
            currentRoad="Prithvi Highway"
            weather={{ temp: 22, condition: "Clear" }}
          />
        )}

        {/* Distance Calculator */}
        {distanceCalcOpen && (
          <DistanceCalculator
            onClose={() => setDistanceCalcOpen(false)}
            points={distancePoints}
            clearPoints={() => setDistancePoints([])}
            eta={eta}
            etaLoading={etaLoading}
            etaError={etaError}
            onCalculateETA={calculateETA}
            userLocation={userLocation}
          />
        )}

        {/* Offline Banner */}
        {isOffline && <OfflineBanner />}
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;