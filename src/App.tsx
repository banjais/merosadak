import React, { useState, useEffect } from 'react';
import { RoutePlanner } from './components/RoutePlanner';
import { InteractiveMap } from './components/InteractiveMap';
import { HighwayDirectory } from './components/HighwayDirectory';
import { RoadAlertsFeed } from './components/RoadAlertsFeed';
import { RoadReportModal } from './components/RoadReportModal';
import { DistanceMatrixModal } from './components/DistanceMatrixModal';
import { WeatherPassesPanel } from './components/WeatherPassesPanel';
import { HighwayPOIsPanel } from './components/HighwayPOIsPanel';
import { TrafficCorridorPanel } from './components/TrafficCorridorPanel';
import { RegionalDialectPhrasesPanel } from './components/RegionalDialectPhrasesPanel';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { SosEmergencyModal } from './components/SosEmergencyModal';
import { TollCalculatorModal } from './components/TollCalculatorModal';
import { PreTripModal } from './components/PreTripModal';
import { ShareTripModal } from './components/ShareTripModal';
import { AppDrawer } from './components/AppDrawer';
import { TravelStepsGuide } from './components/TravelStepsGuide';
import { SpeedDialFab } from './components/SpeedDialFab';
import { ActiveRouteElevationCard } from './components/ActiveRouteElevationCard';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { getStoredOfflineBundle } from './utils/offlineSync';
import {
  RoutePlanResult,
  CityNode,
  RoadIncident,
  UserRoadReport,
  HighwayWeatherNode,
  HighwayPOI,
  TrafficCorridor,
  VehicleType,
  RoutePreference,
} from './types';
import {
  LIVE_ROAD_INCIDENTS,
  INITIAL_USER_REPORTS,
  HIGHWAY_WEATHER_NODES,
  HIGHWAY_POIS,
  TRAFFIC_CORRIDORS,
  CITIES_AND_JUNCTIONS,
} from './data/nepalHighwaysData';
import { findOptimizedRoute } from './utils/routeOptimizer';
import {
  Compass,
  AlertTriangle,
  CloudFog,
  MapPin,
  Activity,
  Route,
  Navigation,
  Calculator,
  PhoneCall,
  PlusCircle,
  ShieldAlert,
  CloudDownload,
  Languages,
  Menu,
  Maximize,
  Minimize,
  Layers,
  Share2,
  Bell,
  CheckCheck,
  Locate,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';

export type SubViewTab = 'route' | 'incidents' | 'weather' | 'pois' | 'traffic' | 'highways' | 'dialects';
export type ActiveFeatureType = SubViewTab | 'steps' | null;

function AppContent() {
  const [activeFeature, setActiveFeature] = useState<ActiveFeatureType>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePlanResult | null>(null);
  const [plannerOrigin, setPlannerOrigin] = useState<string>('ktm');
  const [plannerDest, setPlannerDest] = useState<string>('pkr');
  const [plannerVehicle, setPlannerVehicle] = useState<VehicleType>('car');
  const [plannerPref, setPlannerPref] = useState<RoutePreference>('fastest');

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDistanceModalOpen, setIsDistanceModalOpen] = useState(false);
  const [isTollModalOpen, setIsTollModalOpen] = useState(false);
  const [isPreTripModalOpen, setIsPreTripModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isMapFull, setIsMapFull] = useState(false);

  // Top header state
  const [language, setLanguage] = useState<'EN' | 'NE'>('EN');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Offline context
  const { isOnline, cacheStats, setIsOfflineManagerOpen } = useOffline();

  // Data states
  const [incidents, setIncidents] = useState<RoadIncident[]>(LIVE_ROAD_INCIDENTS);
  const [userReports, setUserReports] = useState<UserRoadReport[]>(INITIAL_USER_REPORTS);
  const [weatherNodes, setWeatherNodes] = useState<HighwayWeatherNode[]>(HIGHWAY_WEATHER_NODES);
  const [pois, setPois] = useState<HighwayPOI[]>(HIGHWAY_POIS);
  const [trafficCorridors, setTrafficCorridors] = useState<TrafficCorridor[]>(TRAFFIC_CORRIDORS);

  // Focus on map target
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

  // Initialize from URL search parameters or default route plan
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const urlOrigin = searchParams.get('origin');
        const urlDest = searchParams.get('dest');
        const urlVehicle = (searchParams.get('vehicle') as VehicleType) || 'car';
        const urlPref = (searchParams.get('pref') as RoutePreference) || 'fastest';
        const urlTab = searchParams.get('tab') as SubViewTab;

        const origin = urlOrigin || 'ktm';
        const dest = urlDest || 'pkr';

        if (urlOrigin) setPlannerOrigin(urlOrigin);
        if (urlDest) setPlannerDest(urlDest);
        if (urlVehicle) setPlannerVehicle(urlVehicle);
        if (urlPref) setPlannerPref(urlPref);

        if (urlTab && ['route', 'incidents', 'weather', 'pois', 'traffic', 'highways', 'dialects', 'steps'].includes(urlTab)) {
          setActiveFeature(urlTab as ActiveFeatureType);
        }

        const initialPlan = findOptimizedRoute(origin, dest, urlPref, urlVehicle);
        if (initialPlan) {
          setActiveRoute(initialPlan);
        }
      }
    } catch (e) {
      const initialPlan = findOptimizedRoute('ktm', 'pkr', 'fastest', 'car');
      if (initialPlan) {
        setActiveRoute(initialPlan);
      }
    }
  }, []);

  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  // Fetch updated data from server or local offline bundle
  const fetchLiveFeeds = async () => {
    setIsRefreshingWeather(true);
    try {
      const [alertsRes, wxRes, poiRes, trRes] = await Promise.all([
        fetch('/api/road-alerts'),
        fetch('/api/weather'),
        fetch('/api/pois'),
        fetch('/api/traffic'),
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        if (data.incidents) setIncidents(data.incidents);
        if (data.userReports) setUserReports(data.userReports);
      }
      if (wxRes.ok) {
        const data = await wxRes.json();
        if (data.weatherNodes) setWeatherNodes(data.weatherNodes);
      }
      if (poiRes.ok) {
        const data = await poiRes.json();
        if (data.pois) setPois(data.pois);
      }
      if (trRes.ok) {
        const data = await trRes.json();
        if (data.corridors) setTrafficCorridors(data.corridors);
      }
    } catch (err) {
      console.log('[Mero Sadak] Network unreachable. Checking offline local bundle...');
      const offlineBundle = getStoredOfflineBundle();
      if (offlineBundle) {
        if (offlineBundle.incidents) setIncidents(offlineBundle.incidents);
        if (offlineBundle.userReports) setUserReports(offlineBundle.userReports);
        if (offlineBundle.weatherNodes) setWeatherNodes(offlineBundle.weatherNodes);
        if (offlineBundle.pois) setPois(offlineBundle.pois);
        if (offlineBundle.corridors) setTrafficCorridors(offlineBundle.corridors);
      }
    } finally {
      setIsRefreshingWeather(false);
    }
  };

  useEffect(() => {
    fetchLiveFeeds();
  }, []);

  const handleRouteCalculated = (route: RoutePlanResult) => {
    setActiveRoute(route);
    if (route?.destination) {
      setFocusedTarget({
        lat: route.destination.lat,
        lng: route.destination.lng,
        title: `${route.destination.name} (Destination)`,
        zoom: 11,
      });
    }
  };

  const handleSelectCityOnMap = (city: CityNode, type: 'origin' | 'destination') => {
    if (type === 'origin') setPlannerOrigin(city.id);
    if (type === 'destination') setPlannerDest(city.id);
    setActiveFeature('route');
  };

  const handleDistanceMatrixSelect = (originId: string, destId: string) => {
    setPlannerOrigin(originId);
    setPlannerDest(destId);
    setActiveFeature('route');
  };

  const handleSelectIncident = (inc: RoadIncident | UserRoadReport) => {
    setSelectedIncidentId(inc.id);
    setActiveFeature('incidents');
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

  const handleSelectWeatherNode = (node: HighwayWeatherNode) => {
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const resetMapView = () => {
    setFocusedTarget({
      lat: 28.3949,
      lng: 84.124,
      title: 'Nepal Overview',
      zoom: 7,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Offline Status Banner */}
      <OfflineStatusBanner />

      {/* Left Drawer Menu */}
      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeFeature === 'steps' || activeFeature === null ? 'route' : activeFeature}
        onNavigateTab={(tab) => {
          setActiveFeature(tab);
          setIsDrawerOpen(false);
        }}
        onOpenTravelSteps={() => {
          setActiveFeature('steps');
          setIsDrawerOpen(false);
        }}
        onOpenDistanceMatrix={() => setIsDistanceModalOpen(true)}
        onOpenTollModal={() => setIsTollModalOpen(true)}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenPreTripModal={() => setIsPreTripModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
        incidentsCount={incidents.length}
      />

      {/* Top Header Matching Reference UI */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-5 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          {/* Left: Menu Button, App Logo, Header & Sub-header */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm"
              title="Open Navigation Menu"
              id="btn-header-menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="flex items-center space-x-2.5 cursor-pointer group select-none"
              onClick={resetMapView}
              title="Reset Nepal Map View"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-amber-500/10 group-hover:border-amber-500/50 transition">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#f59e0b" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-black tracking-tight text-white font-display">MERO SADAK</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                    मेरो सडक
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider hidden sm:block">
                  Nepal National Highway Network &amp; GIS
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Notifications Bell, Fullscreen Maximize, Language Toggle & Emergency SOS */}
          <div className="flex items-center space-x-2 relative">
            {/* Notification Bell & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-xl border text-xs font-semibold transition relative ${
                  isNotificationsOpen
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
                }`}
                title="Road Alerts & Notifications"
                id="btn-header-notifications"
              >
                <Bell className="w-4 h-4" />
                {incidents.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                    {incidents.length}
                  </span>
                )}
              </button>

              {/* Notifications Popover Dropdown */}
              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div
                    id="header-notifications-dropdown"
                    className="absolute right-0 mt-2 w-84 sm:w-96 bg-slate-950/98 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-fadeIn"
                  >
                    <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            Highway Alerts &amp; Notices
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            {incidents.length} active road incident{incidents.length !== 1 ? 's' : ''} reported
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        LIVE SYNC
                      </span>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {incidents.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          <CheckCheck className="w-6 h-6 mx-auto mb-1.5 text-emerald-400 opacity-80" />
                          <span>All monitored highway corridors are currently clear!</span>
                        </div>
                      ) : (
                        incidents.slice(0, 6).map((inc) => (
                          <div
                            key={inc.id}
                            className={`p-2.5 rounded-xl border transition group ${
                              inc.severity === 'critical'
                                ? 'bg-slate-900/80 border-rose-900/60 hover:border-rose-500/70'
                                : inc.severity === 'high'
                                ? 'bg-slate-900/80 border-amber-900/60 hover:border-amber-500/70'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5 flex-wrap mb-0.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      inc.severity === 'critical'
                                        ? 'bg-rose-500 text-white'
                                        : inc.severity === 'high'
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-sky-500 text-slate-950'
                                    }`}
                                  >
                                    {inc.type}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-amber-300">
                                    {inc.highwayCode}
                                  </span>
                                  <span className="text-[10px] font-bold text-white truncate">
                                    {inc.locationName}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                  {inc.description}
                                </p>
                              </div>

                              <button
                                onClick={() => {
                                  if (inc.lat && inc.lng) {
                                    setFocusedTarget({
                                      lat: inc.lat,
                                      lng: inc.lng,
                                      title: `${inc.highwayCode} - ${inc.locationName}`,
                                      zoom: 12,
                                    });
                                  }
                                  setIsNotificationsOpen(false);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition shrink-0"
                                title="View on Map"
                              >
                                <Locate className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                              <span>Reported by {inc.reportedBy}</span>
                              <span className="font-mono text-slate-400">{inc.timestamp}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setActiveFeature('incidents');
                          setIsNotificationsOpen(false);
                        }}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                      >
                        <span>Open Road Alerts Feed</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Maximize / Fullscreen Option */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Maximize'}
              id="btn-header-maximize"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'EN' ? 'NE' : 'EN')}
              className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-slate-700/80 rounded-xl text-xs font-black transition"
              title="Toggle Language (English / नेपाली)"
              id="btn-header-language"
            >
              {language}
            </button>
          </div>
        </div>
      </header>

      {/* Main Clean Map Canvas with Progressive Disclosure Floating Controls */}
      <main className="flex-1 w-full h-[calc(100dvh-57px)] relative overflow-hidden bg-slate-950">
        {/* Full Interactive GIS Map Canvas - No boxes, edge-to-edge */}
        <div className="absolute inset-0 z-0">
          <InteractiveMap
            activeRoute={activeRoute}
            onSelectAlternativeRoute={(altRoute) => setActiveRoute(altRoute)}
            onSelectCity={handleSelectCityOnMap}
            focusedTarget={focusedTarget}
            weatherNodes={weatherNodes}
            onSelectWeatherNode={handleSelectWeatherNode}
            selectedWeatherNodeId={selectedWeatherId}
          />
        </div>

        {/* Floating Active Route Elevation Profile Card (Appears beneath route details when a route is active on the map) */}
        {activeRoute && activeFeature !== 'route' && (
          <ActiveRouteElevationCard
            activeRoute={activeRoute}
            onOpenPlanner={() => setActiveFeature('route')}
            onClearRoute={() => setActiveRoute(null)}
            onViewOnMap={(target) => setFocusedTarget(target)}
          />
        )}

        {/* Right-Bottom Round +FAB Speed Dial Navigation Menu */}
        <SpeedDialFab
          activeFeature={activeFeature}
          onSelectFeature={(feat) => setActiveFeature(feat)}
          onOpenSos={() => setIsSosModalOpen(true)}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          incidentsCount={incidents.length}
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
              className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:top-16 sm:left-4 sm:bottom-20 z-40 w-full sm:w-[480px] lg:w-[540px] xl:w-[580px] max-h-[85vh] sm:max-h-[calc(100dvh-140px)] flex flex-col bg-slate-900/98 backdrop-blur-2xl sm:rounded-2xl rounded-t-3xl border-t sm:border border-slate-800/80 shadow-2xl overflow-hidden animate-slideUp sm:animate-fadeIn"
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2 sm:hidden shrink-0" />

              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/70">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    {activeFeature === 'steps' && <Sparkles className="w-4 h-4" />}
                    {activeFeature === 'route' && <Compass className="w-4 h-4" />}
                    {activeFeature === 'incidents' && <AlertTriangle className="w-4 h-4" />}
                    {activeFeature === 'weather' && <CloudFog className="w-4 h-4" />}
                    {activeFeature === 'traffic' && <Activity className="w-4 h-4" />}
                    {activeFeature === 'pois' && <MapPin className="w-4 h-4" />}
                    {activeFeature === 'highways' && <Route className="w-4 h-4" />}
                    {activeFeature === 'dialects' && <Languages className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white leading-none">
                      {activeFeature === 'steps' && 'Travel Sequence & Tips'}
                      {activeFeature === 'route' && 'Route & ETA Planner'}
                      {activeFeature === 'incidents' && `Live Road Alerts (${incidents.length})`}
                      {activeFeature === 'weather' && 'Passes & Weather Telemetry'}
                      {activeFeature === 'traffic' && 'Traffic Corridors & Speed'}
                      {activeFeature === 'pois' && 'POIs & EV Fast Charging'}
                      {activeFeature === 'highways' && 'National Highways (NH01–NH80)'}
                      {activeFeature === 'dialects' && 'Transit Regional Dialects'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
                      {activeFeature === 'steps' && 'Step-by-step journey prep & vehicle tips'}
                      {activeFeature === 'route' && 'Point-to-point transit and mountain profile'}
                      {activeFeature === 'incidents' && 'Landslides, roadworks and DoR notices'}
                      {activeFeature === 'weather' && 'High-altitude passes, fog and rain'}
                      {activeFeature === 'traffic' && 'Real-time speed variance and bottlenecks'}
                      {activeFeature === 'pois' && 'Fuel, EV charging and medical facilities'}
                      {activeFeature === 'highways' && 'Nepal road network inventory'}
                      {activeFeature === 'dialects' && 'Transit driving phrases in local tongues'}
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

                {activeFeature === 'route' && (
                  <RoutePlanner
                    initialOriginId={plannerOrigin}
                    initialDestId={plannerDest}
                    initialVehicle={plannerVehicle}
                    initialPreference={plannerPref}
                    onRouteCalculated={handleRouteCalculated}
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
                  />
                )}

                {activeFeature === 'incidents' && (
                  <RoadAlertsFeed
                    incidents={incidents}
                    userReports={userReports}
                    activeRoute={activeRoute}
                    onOpenReportModal={() => setIsReportModalOpen(true)}
                    onUpvoteReport={handleUpvote}
                    onSelectIncident={(inc) => {
                      handleSelectIncident(inc);
                      if (window.innerWidth < 640) {
                        setActiveFeature(null);
                      }
                    }}
                  />
                )}

                {activeFeature === 'weather' && (
                  <WeatherPassesPanel
                    weatherNodes={weatherNodes}
                    onSelectNode={(node) => {
                      handleSelectWeatherNode(node);
                      if (window.innerWidth < 640) {
                        setActiveFeature(null);
                      }
                    }}
                    selectedNodeId={selectedWeatherId}
                    onRefreshWeather={fetchLiveFeeds}
                    isRefreshing={isRefreshingWeather}
                  />
                )}

                {activeFeature === 'pois' && (
                  <HighwayPOIsPanel
                    pois={pois}
                    onSelectPOI={(poi) => {
                      handleSelectPOI(poi);
                      if (window.innerWidth < 640) {
                        setActiveFeature(null);
                      }
                    }}
                    selectedPOIId={selectedPOIId}
                  />
                )}

                {activeFeature === 'traffic' && (
                  <TrafficCorridorPanel
                    corridors={trafficCorridors}
                    onSelectCorridor={(corridor) => {
                      handleSelectTraffic(corridor);
                      if (window.innerWidth < 640) {
                        setActiveFeature(null);
                      }
                    }}
                    selectedCorridorId={selectedTrafficId}
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
                    onPlanTripForHighway={(start, end) => {
                      setPlannerOrigin('ktm');
                      setPlannerDest('pkr');
                      setActiveFeature('route');
                    }}
                  />
                )}

                {activeFeature === 'dialects' && (
                  <RegionalDialectPhrasesPanel
                    onNavigateToRoute={() => setActiveFeature('route')}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Distance Matrix Modal */}
      <DistanceMatrixModal
        isOpen={isDistanceModalOpen}
        onClose={() => setIsDistanceModalOpen(false)}
        onSelectRoute={handleDistanceMatrixSelect}
      />

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

      {/* Road Hazard Report Modal */}
      <RoadReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportSubmitted={fetchLiveFeeds}
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
    </div>
  );
}

export default function App() {
  return (
    <OfflineProvider>
      <AppContent />
    </OfflineProvider>
  );
}
