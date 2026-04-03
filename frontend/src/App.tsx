import React, { useState, useEffect, useRef, ErrorInfo, useMemo } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ShieldAlert } from 'lucide-react';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { NepalBounds } from './components/NepalBounds';
import SearchOverlay from './components/SearchOverlay';
import { DriverDashboard } from './components/DriverDashboard';
import { FloatingMenu } from './components/FloatingMenu';
import { DistanceCalculator } from './components/DistanceCalculator';
import { MapLayersToggle, MapLayerType } from './components/MapLayersToggle';
import { MapEngineSelector, MapEngine } from './components/MapEngineSelector';
import { SystemMenu } from './components/SystemMenu';
import { MapControls } from './components/MapControls';
import { SOSOverlay } from './components/SOSOverlay';
import { MonsoonRiskOverlay } from './components/MonsoonRiskOverlay';
import { BottomInfoArea } from './components/BottomInfoArea';
import { MapLabel } from './components/MapLabel';
import { RoadOverlay } from './components/RoadOverlay';

import { APP_CONFIG } from './config/config';
import { useNepalData } from './hooks/useNepalData';
import { useGemini } from './hooks/useGemini';
import { useWebSocket } from './hooks/useWebSocket';
import { useGeolocation } from './hooks/useGeolocation';
import { useServiceData } from './hooks/useServiceData';
import { TravelIncident } from './types';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];
const NEPAL_BOUNDS: [number, number][] = [
  [26.35, 80.05], // Southwest
  [30.45, 80.05], // Northwest
  [30.45, 88.20], // Northeast
  [26.35, 88.20], // Southeast
];

// Strict Nepal bounds for maxBounds restriction (never show outside Nepal)
// These bounds are slightly larger than Nepal to allow smooth interaction within the country
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [[26.0, 79.5], [30.5, 88.5]];

// User location marker icon
const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(66,133,244,0.6);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ==========================
// Error Boundary Component
// ==========================
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MapErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div className="absolute inset-0 flex items-center justify-center text-error font-headline font-bold bg-surface/80">Map failed to load.</div>;
    }
    return this.props.children;
  }
}

// ==========================
// Map Jump Controller
// ==========================
const MapController = ({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], target.zoom || 12, { animate: true });
  }, [target, map]);
  return null;
};

// ==========================
// Auto-fly to user's city on geolocation fix
// Note: Always stays within Nepal bounds regardless of engine mode
const GeoAutoCenter = ({ lat, lng, loading, engine }: { lat: number; lng: number; loading: boolean; engine: MapEngine | null }) => {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    // Only auto-center once when geolocation is first available
    if (!loading && !hasFlown.current && lat !== 0 && lng !== 0) {
      hasFlown.current = true;
      // Fly to user location with appropriate zoom based on engine mode
      const targetZoom = engine === 'world' ? 7 : 12;
      map.flyTo([lat, lng], targetZoom, { duration: 1.5 });
    }
  }, [loading, lat, lng, map, engine]);

  return null;
};

// ==========================
// Map Click Handler
// ==========================
const MapEvents = ({ onClick }: { onClick: (latlng: { lat: number; lng: number }) => void }) => {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// ==========================
// Marker Icon Generator
// ==========================
const getMarkerIcon = (type: string, severity: string) => {
  const color = severity === 'high' ? '#ac3434' : severity === 'medium' ? '#f59e0b' : '#0062a2';
  let iconHtml = '📍';
  const t = type.toLowerCase();
  if (t.includes('road')) iconHtml = '🚧';
  else if (t.includes('traffic') || t.includes('congestion')) iconHtml = '🚗';
  else if (t.includes('weather') || t.includes('monsoon') || t.includes('flood') || t.includes('landslide')) iconHtml = '⛈️';
  else if (t.includes('hospital') || t.includes('medical') || t.includes('clinic')) iconHtml = '🏥';
  else if (t.includes('fuel') || t.includes('petrol') || t.includes('gas')) iconHtml = '⛽';
  else if (t.includes('food') || t.includes('restaurant') || t.includes('cafe') || t.includes('dhaba')) iconHtml = '🍛';
  else if (t.includes('temple') || t.includes('religious') || t.includes('gompa')) iconHtml = '🛕';
  else if (t.includes('bank') || t.includes('atm')) iconHtml = '💰';
  else if (t.includes('parking')) iconHtml = '🅿️';
  else if (t.includes('repair') || t.includes('workshop')) iconHtml = '🔧';
  else if (t.includes('hotel') || t.includes('lodge') || t.includes('stay')) iconHtml = '🏨';
  else if (t.includes('police')) iconHtml = '👮';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50%; display:flex;align-items:center;justify-content:center;border:2px solid white;">
            <div style="font-size:16px;">${iconHtml}</div>
           </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
};

// ==========================
// Tile Layer Switcher — swaps tiles based on mapLayer, mapEngine, and dark mode
// ==========================
const TileLayerSwitcher = ({ layer, isDarkMode, mapEngine }: { layer: MapLayerType; isDarkMode: boolean; mapEngine: MapEngine | null }) => {
  const map = useMap();
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const tileUrls: Record<string, string> = {
    standard: mapEngine === 'nepal' 
      ? APP_CONFIG.map.nepalTile 
      : (isDarkMode ? APP_CONFIG.map.darkTile : APP_CONFIG.map.streetTile),
    satellite: APP_CONFIG.map.satelliteTile,
    terrain: APP_CONFIG.map.terrainTile,
    '3d': isDarkMode ? APP_CONFIG.map.darkTile : APP_CONFIG.map.streetTile,
  };

  useEffect(() => {
    const url = tileUrls[layer] || tileUrls.standard;

    if (!tileLayerRef.current) {
      tileLayerRef.current = L.tileLayer(url, { 
        maxZoom: 19,
        minZoom: 6,
        maxBounds: mapEngine === 'nepal' ? NEPAL_MAX_BOUNDS : undefined,
        bounds: mapEngine === 'nepal' ? NEPAL_MAX_BOUNDS : undefined,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
    } else {
      tileLayerRef.current.setUrl(url);
    }
  }, [layer, map, isDarkMode, mapEngine]);

  return null;
};

// ==========================
// Map Engine Changer — flies map to correct view when engine changes
// Note: Both modes stay within Nepal bounds - 'world' just shows a wider context view
const MapEngineChanger = ({ engine, geoLat, geoLng, geoLoading }: { engine: MapEngine | null; geoLat: number; geoLng: number; geoLoading: boolean }) => {
  const map = useMap();
  const prevEngine = useRef(engine);

  useEffect(() => {
    if (engine && engine !== prevEngine.current) {
      prevEngine.current = engine;
      if (engine === 'world') {
        // World mode: show wider view but still centered on Nepal region
        map.flyTo([28, 84], 6, { duration: 1.5 });
      } else {
        // Nepal mode: focus on user location if available, otherwise Nepal center
        const targetLat = (!geoLoading && geoLat !== 0 && geoLng !== 0) ? geoLat : NEPAL_CENTER[0];
        const targetLng = (!geoLoading && geoLat !== 0 && geoLng !== 0) ? geoLng : NEPAL_CENTER[1];
        map.flyTo([targetLat, targetLng], 7, { duration: 1.5 });
      }
    }
  }, [engine, map, geoLat, geoLng, geoLoading]);

  return null;
};

// ==========================
// 3D Perspective Toggle — applies CSS class for tilted map view
// ==========================
const Map3DToggle = ({ layer }: { layer: MapLayerType }) => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    if (layer === '3d') {
      parent.classList.add('map-3d-container');
      container.classList.add('map-3d-active');
    } else {
      parent.classList.remove('map-3d-container');
      container.classList.remove('map-3d-active');
    }

    return () => {
      parent.classList.remove('map-3d-container');
      container.classList.remove('map-3d-active');
    };
  }, [layer, map]);

  return null;
};

// ==========================
// Helper: Convert API URL to WebSocket URL
// ==========================
const getWebSocketUrl = (): string => {
  const apiUrl = APP_CONFIG.apiBaseUrl;
  // Convert https:// to wss:// and http:// to ws://
  const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
  try {
    const url = new URL(apiUrl);
    return `${wsProtocol}//${url.host}/ws/live`;
  } catch {
    // Fallback to default
    return 'ws://localhost:4000/ws/live';
  }
};

// ==========================
// Main App
// ==========================
const App: React.FC = () => {
  const { incidents, isLoading, boundary } = useNepalData();
  const { messages, ask, isProcessing, clearChat } = useGemini();
  const { isConnected } = useWebSocket(getWebSocketUrl());
  const geo = useGeolocation();

  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDriverDashboard, setShowDriverDashboard] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcPoints, setCalcPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('standard');
  const [mapEngine, setMapEngine] = useState<MapEngine | null>(() => {
    const saved = localStorage.getItem('merosadak-map-engine');
    return (saved === 'nepal' || saved === 'world') ? saved : 'nepal';
  });
  const [roadFilters, setRoadFilters] = useState({ blocked: true, oneway: true, resumed: true });
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'alerts' | 'chat'>('alerts');
  const [aiPersona, setAiPersona] = useState('safety');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [moodEQ, setMoodEQ] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Live service data — must be after activeService state
  const serviceData = useServiceData(activeService, geo.lat, geo.lng, geo.loading);

  const serviceResultsForSidebar = useMemo(() => {
    if (!activeService) return [];
    return serviceData.data.map(s => ({
      id: s.id,
      type: s.type,
      title: s.name,
      description: s.address || s.description || `${s.type} service point`,
      lat: s.lat,
      lng: s.lng,
      severity: 'success' as const,
      timestamp: new Date().toISOString(),
      distance: s.distance,
      phone: s.phone,
      hours: s.hours,
      rating: s.rating,
      status: s.status,
      source: s.source,
    }));
  }, [activeService, serviceData.data]);


  const handleMapEngineSelect = (engine: MapEngine) => {
    setMapEngine(engine);
    localStorage.setItem('merosadak-map-engine', engine);
  };

  const closeOverlays = () => {
    setShowDriverDashboard(false);
    setIsCalculatorOpen(false);
    setIsSystemMenuOpen(false);
    setActiveService(null);
  };

  const openNotifications = () => {
    closeOverlays();
    setActiveSidebarTab('alerts');
    setActiveService(null);
    setIsSidebarOpen(true);
  };

  const handleServiceSelect = (serviceId: string | null) => {
    closeOverlays();
    setActiveService(serviceId);
    setIsSidebarOpen(true);
    setActiveSidebarTab('alerts');
  };

  const handleAskAI = (query: string, image?: string) => {
    setActiveSidebarTab('chat');
    setIsSidebarOpen(true);
    ask(query, { lat: geo.lat, lng: geo.lng }, incidents, aiPersona, image);
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (isCalculatorOpen) {
      setCalcPoints((prev) => [...prev, latlng]);
    } else {
      console.log('Map clicked:', latlng);
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <Header
        isDarkMode={isDarkMode}
        onTogglePilot={() => { closeOverlays(); setShowDriverDashboard(true); }}
        onToggleMenu={() => { if (!isSidebarOpen) closeOverlays(); setIsSidebarOpen(!isSidebarOpen); }}
        onToggleSystemMenu={() => { if (!isSystemMenuOpen) closeOverlays(); setIsSystemMenuOpen(!isSystemMenuOpen); }}
        onOpenNotifications={openNotifications}
        noticeCount={incidents.filter(i => i.severity === 'high').length}
      />

      <SOSOverlay isOpen={isSOSOpen} onClose={() => setIsSOSOpen(false)} userLocation={{ lat: geo.lat, lng: geo.lng }} />

      {mapEngine === null && <MapEngineSelector onSelect={handleMapEngineSelect} />}

      <SystemMenu
        isOpen={isSystemMenuOpen}
        onClose={() => setIsSystemMenuOpen(false)}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        aiMode={aiMode}
        setAiMode={setAiMode}
        voiceGender={voiceGender}
        setVoiceGender={setVoiceGender}
        verbosity={verbosity}
        setVerbosity={setVerbosity}
        moodEQ={moodEQ}
        setMoodEQ={setMoodEQ}
      />

      {showDriverDashboard && <DriverDashboard onClose={() => setShowDriverDashboard(false)} speed={42} isLive={isConnected} />}

      <div className="flex-1 relative flex">
        {isCalculatorOpen && <DistanceCalculator points={calcPoints} onClose={() => setIsCalculatorOpen(false)} clearPoints={() => setCalcPoints([])} />}
        {!showDriverDashboard && (
          <FloatingMenu
            onServiceSelect={handleServiceSelect}
            onOpenCalculator={() => { closeOverlays(); setIsCalculatorOpen(true); setCalcPoints([]); }}
            activeService={activeService}
            incidents={incidents}
          />
        )}
        {!showDriverDashboard && <MapLayersToggle currentLayer={mapLayer} onLayerChange={setMapLayer} activeFilters={roadFilters} onFilterToggle={(f) => setRoadFilters(prev => ({ ...prev, [f]: !prev[f] }))} isDarkMode={false} mapEngine={mapEngine} onMapEngineChange={handleMapEngineSelect} onResetEngine={() => { setMapEngine(null); localStorage.removeItem('merosadak-map-engine'); }} />}
        {!showDriverDashboard && (
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
            activeTab={activeSidebarTab}
            setActiveTab={setActiveSidebarTab} 
            incidents={incidents} 
            serviceType={activeService} 
            serviceResults={activeService ? serviceResultsForSidebar : incidents}
            onSelectService={handleServiceSelect}
            onSelectIncident={(loc) => {
               setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 14 });
               setSelectedIncident(loc);
            }}
            chatMessages={messages}
            onSendMessage={handleAskAI}
            activePersona={aiPersona}
            onPersonaChange={setAiPersona}
            voiceGender={voiceGender}
            onGenderChange={setVoiceGender}
            isProcessing={isProcessing}
            isDarkMode={false}
          />
        )}

        <main className={`flex-1 relative ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
          <SearchOverlay 
             incidents={incidents} 
             onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 12 })} 
             onAskAI={handleAskAI} 
             onSelectItem={(item) => setSelectedIncident(item)}
          />

            <MapErrorBoundary>
            <MapContainer 
              key={mapEngine || 'init'}
              center={geo.loading || (geo.lat === 0 && geo.lng === 0) ? NEPAL_CENTER : [geo.lat, geo.lng]} 
              zoom={geo.loading || (geo.lat === 0 && geo.lng === 0) ? 7 : 12} 
              minZoom={6} 
              maxZoom={18}
              maxBounds={NEPAL_MAX_BOUNDS}
              maxBoundsViscosity={1.0}
              zoomControl={false}
              className="h-full w-full"
            >
              <MapEvents onClick={handleMapClick} />
              {mapEngine === 'nepal' && <NepalBounds boundary={boundary} isDarkMode={false} />}
              {mapEngine === 'nepal' && <MonsoonRiskOverlay incidents={incidents} />}
              {mapEngine === 'nepal' && <RoadOverlay isVisible={true} filters={roadFilters} />}
              <MarkerClusterGroup>
                {incidents.map(i => (
                  <Marker 
                    key={i.id} 
                    position={[i.lat, i.lng]} 
                    icon={getMarkerIcon(i.type, i.severity)}
                    eventHandlers={{ click: () => setSelectedIncident(i) }}
                  />
                ))}
              </MarkerClusterGroup>
              {!geo.loading && (
                <Marker position={[geo.lat, geo.lng]} icon={userLocationIcon}>
                  <Popup>You are here</Popup>
                </Marker>
              )}

              <MapController target={targetLocation} />
              <GeoAutoCenter lat={geo.lat} lng={geo.lng} loading={geo.loading || mapEngine === 'world'} engine={mapEngine} />
              <TileLayerSwitcher layer={mapLayer} isDarkMode={isDarkMode} mapEngine={mapEngine} />
              <Map3DToggle layer={mapLayer} />
              <MapEngineChanger engine={mapEngine} geoLat={geo.lat} geoLng={geo.lng} geoLoading={geo.loading} />
              <MapControls userLocation={geo.loading ? null : { lat: geo.lat, lng: geo.lng }} />
            </MapContainer>
          </MapErrorBoundary>
        </main>
      </div>

      {/* SOS Button — bottom-right */}
      {!showDriverDashboard && !isSOSOpen && (
        <div className="fixed bottom-10 right-4 z-[1500]">
          <button
            onClick={() => { closeOverlays(); setIsSOSOpen(true); }}
            className="relative group flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-[0_8px_30px_rgba(220,38,38,0.5)] active:scale-90 transition-all"
          >
            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
            <ShieldAlert size={20} className="relative z-10" />
            <span className="relative z-10 text-sm font-black uppercase tracking-wider">SOS</span>
          </button>
        </div>
      )}

      <BottomInfoArea 
        selectedItem={selectedIncident} 
        onClose={() => setSelectedIncident(null)} 
        onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 14 })}
        onAskAI={handleAskAI}
        isDarkMode={isDarkMode}
      />

      {isLoading && <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center text-primary font-headline font-bold">Syncing Map Data...</div>}
    </div>
  );
};

export default App;
