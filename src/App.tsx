import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useHaptic } from './hooks/useHaptic';
import { useTextScale } from './hooks/useTextScale';
import { RoutePlanner } from './components/RoutePlanner';
import { InteractiveMap } from './components/InteractiveMap';
import { HighwayDirectory } from './components/HighwayDirectory';
import { RoadReportModal } from './components/RoadReportModal';
import { parseProofFromSearch, ProofClaim } from './utils/proofLinks';
import { PullToRefresh } from './components/PullToRefresh';
import { TripStatusBar } from './components/TripStatusBar';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { SosEmergencyModal } from './components/SosEmergencyModal';
import { TollCalculatorModal } from './components/TollCalculatorModal';
import { PreTripModal } from './components/PreTripModal';
import { ShareTripModal } from './components/ShareTripModal';
import { AppDrawer } from './components/AppDrawer';
import { LoginScreen } from './components/LoginScreen';
import { TravelStepsGuide } from './components/TravelStepsGuide';
import { SpeedDialFab } from './components/SpeedDialFab';
import { MyRouteFab } from './components/MyRouteFab';
import { AdminCommandPanel } from './components/AdminCommandPanel';
import { SuperAdminPanel } from './components/SuperAdminControlPanel';
import { OfficeAdminPanel } from './components/OfficeAdminPanel';
import { ProfilePage } from './components/ProfilePage';
import { AIAssistantChat } from './components/AIAssistantChat';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { SplashScreen } from './components/SplashScreen';
import { ArchiveTray } from './components/ArchiveTray';
import { getStoredOfflineBundle } from './utils/offlineSync';

// Secondary pages are rarely opened and dominate the bundle. Loading them on
// demand keeps the first paint small; the Suspense fallbacks below cover the
// brief gap while a chunk is fetched.
/**
 * Lazy pages are content-hashed chunks; every deploy deletes the old hashes and
 * Firebase's SPA fallback answers missing /assets/*.js with index.html (HTTP 200,
 * JS content-type). A tab opened BEFORE a deploy therefore fails to import any
 * newly-requested page (e.g. drawer → Highway Info) with an HTML-as-JS parse
 * error. Recover by auto-reloading ONCE per failure episode: the guard set on
 * failure is cleared by the first SUCCESSFUL import, so a stale tab self-heals
 * while a truly-offline device cannot loop reloads.
 */
const lazyPage = (factory: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(() =>
    factory()
      .then((mod) => {
        try { sessionStorage.removeItem('mero-sadak-chunk-reload'); } catch {}
        return mod;
      })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem('mero-sadak-chunk-reload')) {
            sessionStorage.setItem('mero-sadak-chunk-reload', '1');
            window.location.reload();
          } else {
            sessionStorage.removeItem('mero-sadak-chunk-reload');
          }
        } catch {}
        throw err;
      }),
  );

const HighwayDirectoryPage = lazyPage(() => import('./components/HighwayDirectoryPage').then((m) => ({ default: m.HighwayDirectoryPage })));
const DistanceCalculatorPage = lazyPage(() => import('./components/DistanceCalculatorPage').then((m) => ({ default: m.DistanceCalculatorPage })));
const DataSourcesPage = lazyPage(() => import('./components/DataSourcesPage').then((m) => ({ default: m.DataSourcesPage })));
const MyLocationPage = lazyPage(() => import('./components/MyLocationPage').then((m) => ({ default: m.MyLocationPage })));
const ReminderServicePage = lazyPage(() => import('./components/ReminderServicePanel').then((m) => ({ default: m.ReminderServicePanel })));
const ProofVerifyPage = lazyPage(() => import('./components/ProofVerifyPage').then((m) => ({ default: m.ProofVerifyPage })));
import { fetchJson } from './utils/apiConfig';
import {
  RoutePlanResult,
  CityNode,
  RoadIncident,
  UserRoadReport,
  HighwayPOI,
  TrafficCorridor,
  VehicleType,
  RoutePreference,
  RouteSimulationControls,
} from './types';
import {
  CITIES_AND_JUNCTIONS,
} from './data/nepalHighwaysData';
import { getNearestRoutingCity } from './utils/cityDataLoader';
import { getRoutePointAtDistance } from './utils/routeElevationProfile';
import {
  Menu,
  Sparkles,
  Route,
  X,
  MapPin,
  RotateCcw,
  Home,
  Activity,
  MoreHorizontal,
} from 'lucide-react';

/** Placeholder while a lazily-loaded page chunk is fetched. */
const PageLoadingFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  </div>
);
import { AuthProvider, useAuth } from './context/AuthContext';
import { CardArchiveProvider } from './context/CardArchiveContext';

export type ActiveFeatureType = 'steps' | 'highways' | 'route' | null;

interface LiveFeedResponse {
  incidents?: RoadIncident[];
  userReports?: UserRoadReport[];
  weatherNodes?: any[];
  pois?: HighwayPOI[];
  corridors?: TrafficCorridor[];
}

/**
 * Feeds report time either as a real timestamp or as prose ("35 minutes ago").
 * `new Date('35 minutes ago')` is an Invalid Date, so guard the parse and fall
 * back to showing the raw string rather than rendering a broken date.
 */
function formatIncidentTime(value?: string): string {
  if (!value) return 'Time not stated';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function AppContent() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [activeFeature, setActiveFeature] = useState<ActiveFeatureType>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePlanResult | null>(null);
  const [simulationProgressKm, setSimulationProgressKm] = useState<number>(0);
  const [isSimulationPlaying, setIsSimulationPlaying] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [followOnMap, setFollowOnMap] = useState<boolean>(true);
  const lastMapSyncRef = useRef<number>(0);
  const [plannerOrigin, setPlannerOrigin] = useState<string>('');
  const [plannerDest, setPlannerDest] = useState<string>('');
  const [plannerVehicle, setPlannerVehicle] = useState<VehicleType>('car');
  const [plannerPref, setPlannerPref] = useState<RoutePreference>('fastest');

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDistanceCalculatorOpen, setIsDistanceCalculatorOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  // A scanned proof-sheet QR opens ?proof=1&...; read it before the init effect strips the query string
  const [proofClaim, setProofClaim] = useState<ProofClaim | null>(() =>
    typeof window !== 'undefined' ? parseProofFromSearch(window.location.search) : null
  );
  const [isTollModalOpen, setIsTollModalOpen] = useState(false);
  const [isPreTripModalOpen, setIsPreTripModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isMapFull, setIsMapFull] = useState(false);
  const [isHighwayInfoOpen, setIsHighwayInfoOpen] = useState(false);
  const [isMyLocationOpen, setIsMyLocationOpen] = useState(false);

  // AI Reminder Service panel state
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  const { triggerLight: hapticLight } = useHaptic();
  const { textScale, setTextScale, highContrast, setHighContrast } = useTextScale();
  const { user, logout, redirectError, clearRedirectError, isSuperAdmin, userRole } = useAuth();

  // Top header state
  const [language, setLanguage] = useState<'EN' | 'NE'>('EN');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Returning from the Google redirect is a fresh page load, so the modal flag
  // is already false by the time getRedirectResult rejects. Without this the
  // failure is invisible: the user is bounced back signed out with no message.
  useEffect(() => {
    if (redirectError) setIsLoginModalOpen(true);
  }, [redirectError]);

  const [accentColor, setAccentColor] = useState<string>(() => {
    try { return localStorage.getItem('mero-sadak-accent') || 'emerald'; } catch { return 'emerald'; }
  });

  const handleAccentColor = (color: string) => {
    setAccentColor(color);
    try { localStorage.setItem('mero-sadak-accent', color); } catch {}
    document.documentElement.setAttribute('data-accent', color);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  // Offline context
  const { isOnline, cacheStats, setIsOfflineManagerOpen } = useOffline();

  // Data states. These start EMPTY on purpose: the previous seed values were
  // sample reports that stayed on screen whenever the live feed was unreachable,
  // so a dead network looked like five real DoR-verified incidents.
  const [incidents, setIncidents] = useState<RoadIncident[]>([]);
  const [userReports, setUserReports] = useState<UserRoadReport[]>([]);
  const [weatherNodes, setWeatherNodes] = useState<any[]>([]);
  const [pois, setPois] = useState<HighwayPOI[]>([]);
  const [trafficCorridors, setTrafficCorridors] = useState<TrafficCorridor[]>([]);

  // Map focus target. Explicitly chosen places (a city, an incident) set this;
  // it is NOT seeded from the GPS cache any more. Seeding it used to fire the
  // focusedTarget flight on first load, which activated the map (tiles + every
  // control) before the user had clicked anything, and handed the camera away
  // from the live watcher. Initial focus on the user is now owned entirely by
  // InteractiveMap: it centres on the cached/live fix without activating the
  // map, and the control buttons stay hidden until the first map click.
  const [focusedTarget, setFocusedTarget] = useState<{
    lat: number;
    lng: number;
    title: string;
    zoom?: number;
  } | null>(null);

  // Selected item tracking in sidebar
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedWeatherId, setSelectedWeatherId] = useState<string | null>(null);
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);
  const [selectedTrafficId, setSelectedTrafficId] = useState<string | null>(null);

  // AI Admin Command panel
  const [isAdminCommandOpen, setIsAdminCommandOpen] = useState(false);

  // Super Admin control panel (only visible to banjais@gmail.com)
  const [isSuperAdminPanelOpen, setIsSuperAdminPanelOpen] = useState(false);

  // Office Admin control panel — scoped to data input + data sources + settings
  // (no user management, no analytics, no system config). Distinct from
  // SuperAdminPanel so OfficeAdmins do not see SuperAdmin-only sections.
  const [isOfficeAdminPanelOpen, setIsOfficeAdminPanelOpen] = useState(false);

  // Profile page panel (header avatar)
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Mero Sadak AI — conversational support chat (routes, hazards, fuel, tolls,
  // weather). Opened from the planner's AI sparkle, the drawer, or the AI page.
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

  // Initialize from URL search parameters or default route plan
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const urlOrigin = searchParams.get('origin');
        const urlDest = searchParams.get('dest');
        const urlVehicle = (searchParams.get('vehicle') as VehicleType) || 'car';
        const urlPref = (searchParams.get('pref') as RoutePreference) || 'fastest';
        const urlTab = searchParams.get('tab') as ActiveFeatureType;

        const origin = urlOrigin || 'ktm';
        const dest = urlDest || 'pkr';

        if (urlOrigin) setPlannerOrigin(urlOrigin);
        if (urlDest) setPlannerDest(urlDest);
        if (urlVehicle) setPlannerVehicle(urlVehicle);
        if (urlPref) setPlannerPref(urlPref);

        if (urlTab && ['highways', 'steps'].includes(urlTab)) {
          setActiveFeature(urlTab === 'highways' ? 'highways' : null);
        }

        history.replaceState(null, '', window.location.pathname);

        // No active route auto-selected on initial load
      }
    } catch (e) {
      // No active route auto-selected on initial load
    }
  }, []);

  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const liveFeedsInFlightRef = useRef<Promise<void> | null>(null);
  // Signature of the last-applied feed payload, per feed key. When a pull-to-
  // refresh fetches the same data the server already returned, we skip the
  // setState call entirely — no re-render, no UI flicker, no wasted work.
  // The "don't refresh if no new updates" rule: the network call still
  // happens (so the server is asked whether anything changed), but React
  // state only updates when the payload actually differs.
  const lastFeedSignatureRef = useRef<Record<string, string>>({});
  const updateIfChanged = useCallback(
    <T,>(key: string, newData: T, setter: (data: T) => void) => {
      const sig = JSON.stringify(newData);
      if (lastFeedSignatureRef.current[key] === sig) return;
      lastFeedSignatureRef.current[key] = sig;
      setter(newData);
    },
    []
  );

  // Fetch updated data from server or local offline bundle
  const fetchLiveFeeds = useCallback(async () => {
    if (liveFeedsInFlightRef.current) return liveFeedsInFlightRef.current;

    setIsRefreshingWeather(true);
    const request = (async () => {
      const results = await Promise.allSettled([
        fetchJson<LiveFeedResponse>('/api/road-alerts'),
        fetchJson<LiveFeedResponse>('/api/weather'),
        fetchJson<LiveFeedResponse>('/api/pois'),
        fetchJson<LiveFeedResponse>('/api/traffic'),
      ]);

      let hasNetworkError = false;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          hasNetworkError = true;
          return;
        }
        const data = result.value;
        if (index === 0 && data?.incidents) {
          updateIfChanged('incidents', data.incidents, setIncidents);
          if (data.userReports) updateIfChanged('userReports', data.userReports, setUserReports);
        } else if (index === 1 && data?.weatherNodes) {
          updateIfChanged('weatherNodes', data.weatherNodes, setWeatherNodes);
        } else if (index === 2 && data?.pois) {
          updateIfChanged('pois', data.pois, setPois);
        } else if (index === 3 && data?.corridors) {
          updateIfChanged('corridors', data.corridors, setTrafficCorridors);
        }
      });

      if (hasNetworkError) {
        console.log('[Mero Sadak] Network unreachable. Checking offline local bundle...');
        try {
          const offlineBundle = getStoredOfflineBundle();
          if (offlineBundle) {
            if (offlineBundle.incidents) updateIfChanged('incidents', offlineBundle.incidents, setIncidents);
            if (offlineBundle.userReports) updateIfChanged('userReports', offlineBundle.userReports, setUserReports);
            if (offlineBundle.weatherNodes) updateIfChanged('weatherNodes', offlineBundle.weatherNodes, setWeatherNodes);
            if (offlineBundle.pois) updateIfChanged('pois', offlineBundle.pois, setPois);
            if (offlineBundle.corridors) updateIfChanged('corridors', offlineBundle.corridors, setTrafficCorridors);
          }
        } catch (offlineErr) {
          console.warn('[Mero Sadak] Offline bundle fallback failed:', offlineErr);
        }
      }
      setIsAppReady(true);
    })();

    liveFeedsInFlightRef.current = request;

    try {
      await request;
    } finally {
      liveFeedsInFlightRef.current = null;
      setIsRefreshingWeather(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveFeeds();
  }, [fetchLiveFeeds]);

  const handleRouteCalculated = (route: RoutePlanResult) => {
    setActiveRoute(route);
    setSimulationProgressKm(0);
    setIsSimulationPlaying(false);
    if (route?.destination) {
      setFocusedTarget({
        lat: route.destination.lat,
        lng: route.destination.lng,
        title: `${route.destination.name} (Destination)`,
        zoom: 11,
      });
    }
  };

  useEffect(() => {
    setSimulationProgressKm(0);
    setIsSimulationPlaying(false);
  }, [activeRoute?.id]);

  useEffect(() => {
    if (!isSimulationPlaying || !activeRoute) return;

    const totalDistanceKm = activeRoute.totalDistanceKm || 0;
    const interval = window.setInterval(() => {
      setSimulationProgressKm((previous) => {
        const next = Math.min(
          totalDistanceKm,
          Math.round((previous + (0.3 * simulationSpeed)) * 10) / 10
        );
        if (next >= totalDistanceKm) {
          setIsSimulationPlaying(false);
        }
        return next;
      });
    }, 80);

    return () => window.clearInterval(interval);
  }, [isSimulationPlaying, simulationSpeed, activeRoute?.id, activeRoute?.totalDistanceKm]);

  useEffect(() => {
    if (!followOnMap || !activeRoute) return;

    const now = Date.now();
    if (now - lastMapSyncRef.current < 900) return;
    lastMapSyncRef.current = now;

    const position = getRoutePointAtDistance(activeRoute, simulationProgressKm);
    setFocusedTarget({
      lat: position.lat,
      lng: position.lng,
      title: `Navigation Progress: KM ${position.distance.toFixed(1)}`,
      zoom: 13,
    });
  }, [activeRoute, followOnMap, simulationProgressKm]);

  const simulationControls: RouteSimulationControls = {
    progressKm: simulationProgressKm,
    isPlaying: isSimulationPlaying,
    speed: simulationSpeed,
    followOnMap,
    onToggle: () => {
      if (!activeRoute) return;
      if (simulationProgressKm >= (activeRoute.totalDistanceKm || 0)) {
        setSimulationProgressKm(0);
      }
      setIsSimulationPlaying((previous) => !previous);
    },
    onReset: () => {
      setIsSimulationPlaying(false);
      setSimulationProgressKm(0);
    },
    onSeek: (progressKm: number) => {
      const maximum = activeRoute?.totalDistanceKm || 0;
      setSimulationProgressKm(Math.max(0, Math.min(progressKm, maximum)));
    },
    onSetSpeed: (speed: number) => setSimulationSpeed(speed),
    onToggleFollowOnMap: () => setFollowOnMap((previous) => !previous),
  };

  const handleSelectCityOnMap = (city: CityNode, type: 'origin' | 'destination') => {
    const routingCity = getNearestRoutingCity(city);
    if (type === 'origin') setPlannerOrigin(routingCity.id);
    if (type === 'destination') setPlannerDest(routingCity.id);
    setActiveFeature(null);
  };

  /** Match a free-text highway endpoint (e.g. "Kathmandu", "Pokhara") to a routing city id. */
  const resolveEndpointToCityId = (label: string): string | null => {
    const q = (label || '').toLowerCase().trim();
    if (!q) return null;
    const cities = CITIES_AND_JUNCTIONS;
    const exact = cities.find((c) => c.name.toLowerCase() === q || c.id.toLowerCase() === q);
    if (exact) return exact.id;
    const partial = cities.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        q.includes(c.name.toLowerCase()) ||
        (c.district && c.district.toLowerCase().includes(q))
    );
    return partial?.id || null;
  };

  const handlePlanTripForHighway = (startPoint: string, endPoint: string) => {
    const originId = resolveEndpointToCityId(startPoint) || 'ktm';
    const destId = resolveEndpointToCityId(endPoint) || 'pkr';
    setPlannerOrigin(originId);
    setPlannerDest(destId);
    setActiveFeature(null);
  };

  const handleSelectIncident = (inc: RoadIncident | UserRoadReport) => {
    setSelectedIncidentId(inc.id);
    setIsHighwayInfoOpen(true);
    const locName = 'locationName' in inc ? inc.locationName : inc.location;
    const title = 'title' in inc ? inc.title : `${inc.incidentType} at ${inc.location}`;
    const matchedCity = CITIES_AND_JUNCTIONS.find(
      (c) =>
        c.name.toLowerCase().includes(locName.toLowerCase()) ||
        locName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCity) {
      setFocusedTarget({
        lat: matchedCity.lat,
        lng: matchedCity.lng,
        title: locName || title,
        zoom: 12,
      });
    } else if ('lat' in inc && 'lng' in inc && inc.lat && inc.lng) {
      setFocusedTarget({
        lat: inc.lat,
        lng: inc.lng,
        title: locName || title,
        zoom: 12,
      });
    }
  };

  const handleSelectWeatherNode = (node: any) => {
    setSelectedWeatherId(node.id);
    setFocusedTarget({
      lat: node.lat,
      lng: node.lng,
      title: `${node.name} (${node.elevationM}m)`,
      zoom: 12,
    });
  };

  const handleSelectPOI = (poi: HighwayPOI) => {
    setSelectedPOIId(poi.id);
    setFocusedTarget({
      lat: poi.lat,
      lng: poi.lng,
      title: poi.name,
      zoom: 13,
    });
  };

  const handleSelectTraffic = (corridor: TrafficCorridor) => {
    setSelectedTrafficId(corridor.id);
    if (corridor.startCoord && corridor.endCoord) {
      setFocusedTarget({
        lat: (corridor.startCoord[0] + corridor.endCoord[0]) / 2,
        lng: (corridor.startCoord[1] + corridor.endCoord[1]) / 2,
        title: corridor.name,
        zoom: 11,
      });
    }
  };

  const handleUpvote = (reportId: string) => {
    setUserReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, upvotes: r.upvotes + 1 } : r))
    );
  };

  useEffect(() => {
    if (!isAppReady) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isAppReady]);

  return (
    <PullToRefresh
      onRefresh={fetchLiveFeeds}
      className="h-full bg-[var(--surface-base)] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950"
    >
      {/* Animated Flash / Splash Screen */}
      <SplashScreen isReady={isAppReady} onFinished={() => setIsAppReady(true)} />

      {/* Offline Status Banner */}
      <OfflineStatusBanner />

      <ArchiveTray />

      {/* Left Drawer Menu */}
      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeFeature ?? 'route'}
        onNavigateTab={(tab) => {
          setActiveFeature(tab === 'route' ? null : tab);
          setIsDrawerOpen(false);
        }}
        onOpenTravelSteps={() => {
          setActiveFeature('steps');
          setIsDrawerOpen(false);
        }}
        onOpenHighwayInfo={() => {
          setIsHighwayInfoOpen(true);
          setIsDrawerOpen(false);
        }}
        onOpenDistanceCalculator={() => setIsDistanceCalculatorOpen(true)}
        onOpenDataSources={() => setIsDataSourcesOpen(true)}
        onOpenTollModal={() => setIsTollModalOpen(true)}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenPreTripModal={() => setIsPreTripModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenMyLocation={() => setIsMyLocationOpen(true)}
        onOpenSuperAdminPanel={() => setIsProfileOpen(true)}
        onOpenAdminCommand={() => setIsAdminCommandOpen(true)}
        onOpenOfficeAdminPanel={() => setIsProfileOpen(true)}
        onOpenUserPanel={() => setIsProfileOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        user={user}
        userRole={userRole}
        isSuperAdmin={isSuperAdmin}
        incidentsCount={incidents.length}
        hasActiveRoute={!!activeRoute}
        routeLabel={activeRoute ? `${activeRoute.origin.name} → ${activeRoute.destination.name}` : null}
        activeRoute={activeRoute}
      />

      {/* Top Header Matching Reference UI - Hidden when on Distance Calculator, Data Sources, or Highway Directory pages */}
      {!isDistanceCalculatorOpen && !isDataSourcesOpen && !isHighwayInfoOpen && !proofClaim && !isMyLocationOpen && !isReminderOpen && (
      <header className="header-glass sticky top-0 z-40 px-3 sm:px-5 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          {/* Left: Hamburger Menu Button, App Logo, Header & Sub-header */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="btn-glass p-2 rounded-xl touch-target"
              title="Menu"
              id="btn-header-menu"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* App Logo - static background element */}
            <div
              className="flex items-center space-x-2.5"
              aria-hidden="true"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md logo-shadow group-hover:border-accent-border transition">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" className="logo-svg" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-black tracking-tight text-white font-display">Mero Sadak</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-extrabold accent-bg accent-text accent-border border rounded">
                    मेरो सडक
                  </span>
                </div>
                <div className="text-[9px] accent-text-dim font-semibold tracking-wider truncate">
                  Highway Routes · Road Alerts · Travel Info
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Controls: profile only (signed in) */}
          <div className="flex items-center space-x-2 relative">

            {/* Header right — profile only (signed in). When not signed in nothing
            is shown here: no sign-in button and no settings button. Settings live
            inside the Profile page. Redesigned to a single round avatar (40px)
            with a subtle ring, matching Gmail/Google round style and the existing
            FAB round UI. The username + Settings gear were dropped from the
            header to keep the chrome minimal — both live in the Profile page
            that opens on click. */}
            {user && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="relative w-10 h-10 rounded-full border-2 border-slate-600/60 hover:border-accent-bg/70 cursor-pointer transition shrink-0 overflow-hidden shadow-md shadow-black/30 ring-1 ring-slate-700/40 hover:ring-accent-bg/30 group"
                  title="Open profile"
                  aria-label="Open profile"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-full h-full object-cover bg-slate-800"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-sm font-black text-white">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  {/* Tiny status dot to signal "signed in, click to manage" */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 group-hover:bg-emerald-300 transition" />
                </button>

                {/* Profile page panel (signed in only) — settings, logout
                and role-wise admin functions live inside this single full-page
                control panel. Opened from the header avatar and the drawer. */}
                <ProfilePage
                  isOpen={isProfileOpen}
                  onClose={() => setIsProfileOpen(false)}
                  userEmail={user.email || ''}
                  displayName={user.displayName ?? null}
                  userRole={userRole}
                  isSuperAdmin={isSuperAdmin}
                  photoURL={user.photoURL ?? null}
                  onSignOut={logout}
                  onAdminCommand={() => setIsAdminCommandOpen(true)}
                  onSuperAdminPanel={() => setIsSuperAdminPanelOpen(true)}
                  onOpenOfficeAdminPanel={() => setIsOfficeAdminPanelOpen(true)}
                  onOpenReportModal={() => setIsReportModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Lazily-loaded secondary pages. The fallback matches the app shell so
          the transition does not flash a different background. Each page gets
          its own label — the old single fallback said "Loading Distance
          Calculator" for every one of them, so opening the Highway Directory
          or My Location read as if the distance tool were opening. */}
      <Suspense fallback={<PageLoadingFallback label="Loading page…" />}>
        {isDistanceCalculatorOpen && (
          <Suspense fallback={<PageLoadingFallback label="Loading Distance Calculator…" />}>
            <DistanceCalculatorPage
              onBack={() => setIsDistanceCalculatorOpen(false)}
              textScale={textScale}
              onTextScaleChange={setTextScale}
              accentColor={accentColor}
              onAccentColorChange={handleAccentColor}
            />
          </Suspense>
        )}

        {proofClaim && <ProofVerifyPage claim={proofClaim} onClose={() => setProofClaim(null)} />}

        {isMyLocationOpen && (
          <Suspense fallback={<PageLoadingFallback label="Loading My Location…" />}>
            <MyLocationPage
              onBack={() => setIsMyLocationOpen(false)}
            />
          </Suspense>
        )}

        {isReminderOpen && (
          <Suspense fallback={<PageLoadingFallback label="Loading AI Reminder Service…" />}>
            <ReminderServicePage
              onBack={() => setIsReminderOpen(false)}
              routePlan={activeRoute}
              userId="default-user"
              vehicle={plannerVehicle}
              preference={plannerPref}
            />
          </Suspense>
        )}

        {isDataSourcesOpen && (
          <Suspense fallback={<PageLoadingFallback label="Loading Data Sources…" />}>
            <DataSourcesPage
              onBack={() => setIsDataSourcesOpen(false)}
            />
          </Suspense>
        )}

        {isHighwayInfoOpen && (
          <Suspense fallback={<PageLoadingFallback label="Loading Highway Directory…" />}>
            <HighwayDirectoryPage
              onBack={() => setIsHighwayInfoOpen(false)}
            />
          </Suspense>
        )}
      </Suspense>

      {/* Main Clean Map Canvas with Progressive Disclosure Floating Controls */}
      {!isDistanceCalculatorOpen && !isDataSourcesOpen && !isHighwayInfoOpen && !proofClaim && !isMyLocationOpen && !isReminderOpen && (
        <main className="flex min-h-0 flex-1 w-full flex-col bg-slate-900">
        {/* Route Planner as Main Content */}
        <div className="flex-shrink-0 relative z-20 w-full bg-slate-900">
          <RoutePlanner
            initialOriginId={plannerOrigin}
            initialDestId={plannerDest}
            initialVehicle={plannerVehicle}
            initialPreference={plannerPref}
            onRouteCalculated={handleRouteCalculated}
            onRouteClear={() => setActiveRoute(null)}
            simulationControls={simulationControls}
            onToggleMapFull={() => setIsMapFull((prev) => !prev)}
            isMapFull={isMapFull}
            onOpenMyLocation={() => setIsMyLocationOpen(true)}
            onShareTrip={() => setIsShareModalOpen(true)}
            onOpenPreTrip={() => setIsPreTripModalOpen(true)}
            onOpenSos={() => setIsSosModalOpen(true)}
            uiLanguage={language}
            liveIncidents={incidents}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            onViewOnMap={(target) => {
              if (target && typeof target.lat === 'number' && typeof target.lng === 'number' && !isNaN(target.lat) && !isNaN(target.lng)) {
                setFocusedTarget(target);
              } else if (activeRoute?.origin?.lat != null && activeRoute?.destination?.lat != null) {
                setFocusedTarget({
                  lat: (activeRoute.origin.lat + activeRoute.destination.lat) / 2,
                  lng: (activeRoute.origin.lng + activeRoute.destination.lng) / 2,
                  title: 'Planned Route',
                  zoom: 8,
                });
              }
              if (window.innerWidth < 640) {
                setActiveFeature(null);
              }
            }}
            onOpenHighwayDirectory={() => setIsHighwayInfoOpen(true)}
            onViewHighwayOnMap={(highway) => {
              if (highway.center) {
                setFocusedTarget({
                  lat: highway.center[0],
                  lng: highway.center[1],
                  title: `${highway.code} - ${highway.name}`,
                  zoom: 9,
                });
              }
              setIsHighwayInfoOpen(true);
            }}
          />
        </div>

        {/* Trip status strip — shown when map is full or planner is minimized */}
        {isMapFull && !isDistanceCalculatorOpen && !isDataSourcesOpen && !isHighwayInfoOpen && !proofClaim && !isMyLocationOpen && (
          <TripStatusBar
            route={activeRoute}
            alertCount={activeRoute?.incidentsOnRoute?.length ?? incidents.length}
          />
        )}

        {/* Interactive Map - fills remaining viewport */}
        <div className="flex-1 relative z-0 w-full min-h-[45dvh] sm:min-h-0">
          <InteractiveMap
            activeRoute={activeRoute}
            isDimmed={false}
          isAppReady={isAppReady}
            onSelectAlternativeRoute={(altRoute) => setActiveRoute(altRoute)}
            onSelectCity={handleSelectCityOnMap}
            onMyLocationMoreInfo={() => setIsMyLocationOpen(true)}
            focusedTarget={focusedTarget}
          />
        </div>

        {/* Right-Bottom Round +FAB Speed Dial Navigation Menu */}
        <SpeedDialFab
          activeFeature={activeFeature}
          onSelectFeature={(feat) => setActiveFeature(feat)}
          onOpenSos={() => setIsSosModalOpen(true)}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenHighwayInfo={() => setIsHighwayInfoOpen(true)}
        />

        {/* Left-Bottom "My Route" FAB — appears only when a route is planned.
        Clicking it scrolls the planner verdict into view (the route summary
        that lives below the fold). Sits on the left so it doesn't collide
        with the right-side SpeedDialFab. */}
        <MyRouteFab
          route={activeRoute}
          onClear={() => setActiveRoute(null)}
          onClick={() => {
            const verdict = document.getElementById('route-verdict');
            if (verdict) {
              verdict.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              // No verdict in DOM (e.g. the planner collapsed it): fall back
              // to the main scroll container so the FAB is never a dead click.
              document.querySelector('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        />
        {/* Feature Sliding Panel / Bottom Sheet (Progressive Disclosure - Only Shown When Clicked) */}
        {activeFeature && (
          <>
            {/* Backdrop click to dismiss on mobile */}
            <div
              className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] sm:hidden"
              onClick={() => setActiveFeature(null)}
            />

            {/* Panel Container: Mobile Bottom-Sheet (max-h-[85vh]), Desktop Left-Floating Panel */}
            <div
              className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:top-16 sm:left-4 sm:bottom-20 z-40 w-full sm:w-[480px] lg:w-[540px] xl:w-[580px] max-h-[85vh] sm:max-h-[calc(100dvh-140px)] flex flex-col bg-slate-900/98 backdrop-blur-2xl sm:rounded-2xl rounded-t-3xl border-t sm:border border-slate-800/80 shadow-2xl overflow-hidden animate-fadeIn"
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2 sm:hidden shrink-0" />

              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/70">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    {activeFeature === 'steps' && <Sparkles className="w-4 h-4" />}
                    {activeFeature === 'highways' && <Route className="w-4 h-4" />}
                  </div>
                    <div>
                      <h3 className="text-sm font-black text-white leading-none">
                        {activeFeature === 'steps' && 'Travel Sequence & Tips'}
                        {activeFeature === 'highways' && (activeRoute ? 'Highways on Your Route' : 'Highway Directory')}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
                        {activeFeature === 'steps' && 'Step-by-step journey prep & vehicle tips'}
                        {activeFeature === 'highways' && (activeRoute ? 'Route-corridor highway info & alerts' : 'Search all national highways')}
                      </p>
                    </div>
                </div>

                <button
                  onClick={() => setActiveFeature(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Close and return to map"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                {activeFeature === 'steps' && (
                  <TravelStepsGuide
                    onSelectTab={(tab) => setActiveFeature(tab)}
                    onOpenSos={() => setIsSosModalOpen(true)}
                    onOpenPreTrip={() => setIsPreTripModalOpen(true)}
                    onOpenOffline={() => setIsOfflineManagerOpen(true)}
                    onClose={() => setActiveFeature(null)}
                    activeRouteSummary={
                      activeRoute
                        ? {
                            originName: activeRoute.origin.name,
                            destinationName: activeRoute.destination.name,
                            distanceKm: activeRoute.totalDistanceKm,
                            durationMinutes: (activeRoute as any).totalDurationMinutes || activeRoute.estimatedTimeMinutes,
                            routeName: activeRoute.routeName || activeRoute.routeBadge,
                            routeBadge: activeRoute.routeBadge,
                            vehicle: activeRoute.vehicle,
                          }
                        : null
                    }
                    incidentCount={incidents.length}
                    activeVehicle={activeRoute?.vehicle || plannerVehicle}
                    onVehicleChange={(v) => setPlannerVehicle(v)}
                  />
                )}

                {activeFeature === 'highways' && (
                  <HighwayDirectory
                    liveIncidents={incidents}
                    userReports={userReports}
                    onSelectHighwayOnMap={(highway) => {
                      if (highway.center) {
                        setFocusedTarget({
                          lat: highway.center[0],
                          lng: highway.center[1],
                          title: `${highway.code} - ${highway.name}`,
                          zoom: 9,
                        });
                      }
                      if (window.innerWidth < 640) {
                        setActiveFeature(null);
                      }
                    }}
                    onPlanTripForHighway={handlePlanTripForHighway}
                    routeHighwayCodes={activeRoute ? activeRoute.steps.map((s) => s.highwayCode).filter(Boolean) : []}
                    filterToRouteOnly={!!activeRoute}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
      )}

      {/* Nagdhunga Tunnel Toll Modal */}
      <TollCalculatorModal
        isOpen={isTollModalOpen}
        onClose={() => setIsTollModalOpen(false)}
      />

      {/* Pre-Trip Vehicle Checklist Modal */}
      {activeRoute && (
        <PreTripModal
          isOpen={isPreTripModalOpen}
          onClose={() => setIsPreTripModalOpen(false)}
          routePlan={activeRoute}
          vehicle={plannerVehicle}
        />
      )}

      {/* Share Trip Plan Modal */}
      {activeRoute && (
        <ShareTripModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          routePlan={activeRoute}
          vehicle={plannerVehicle}
          preference={plannerPref}
        />
      )}

      {isLoginModalOpen && (
        <LoginScreen
          onClose={() => {
            setIsLoginModalOpen(false);
            // Clear the surfaced failure too, otherwise closing and reopening
            // the modal would immediately re-trigger the banner.
            clearRedirectError();
          }}
        />
      )}

      {/* Road Hazard Report Modal */}
      <RoadReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportSubmitted={() => {
          fetchLiveFeeds();
          // ReportingSection (admin panels + profile) listens for this and
          // reloads so a fresh report appears without a manual refresh.
          window.dispatchEvent(new Event('merosadak:report-submitted'));
        }}
      />

      {/* Mountain Offline GIS & Tile Pack Manager Modal */}
      <OfflineManagerModal activeRoute={activeRoute} />

      {/* Emergency Highway SOS Rescue Assistant Modal */}
      <SosEmergencyModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        activeRoute={activeRoute}
        defaultVehicle={plannerVehicle}
        onFocusCoordinatesOnMap={(lat, lng, title) => {
          setFocusedTarget({
            lat,
            lng,
            title,
            zoom: 13,
          });
        }}
      />

      {/* AI Admin Command Panel — update fuel, tolls, incidents via natural language */}
      <AdminCommandPanel
        isOpen={isAdminCommandOpen}
        onClose={() => setIsAdminCommandOpen(false)}
      />

      {/* Super Admin Panel — full page, only visible to superadmin */}
      {user && isSuperAdmin && isSuperAdminPanelOpen && (
        <SuperAdminPanel
          onClose={() => setIsSuperAdminPanelOpen(false)}
          userEmail={user.email || 'banjais@gmail.com'}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />
      )}

      {/* Office Admin Panel — full page, only visible to OfficeAdmin role.
      Scoped to Data Input + Data Sources + Settings (no user management,
      no analytics, no system config). */}
      {user && userRole === 'OfficeAdmin' && isOfficeAdminPanelOpen && (
        <OfficeAdminPanel
          onClose={() => setIsOfficeAdminPanelOpen(false)}
          userEmail={user.email || ''}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />
      )}

      {/* Mero Sadak AI — conversational support chat. Available to everyone
      (signed-in users get the personalization drawer: avatar + voice). */}
      {isAiAssistantOpen && (
        <AIAssistantChat
          userEmail={user?.email ?? null}
          isSignedIn={!!user}
          uiLanguage={language}
          activeRouteLabel={
            activeRoute
              ? `${activeRoute.origin.name} - ${activeRoute.destination.name}`
              : null
          }
          onClose={() => setIsAiAssistantOpen(false)}
          onOpenLogin={() => setIsLoginModalOpen(true)}
        />
      )}
    </PullToRefresh>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <CardArchiveProvider>
          <AppContent />
        </CardArchiveProvider>
      </OfflineProvider>
    </AuthProvider>
  );
}
