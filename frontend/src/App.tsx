// App.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MapContainer, 
  Marker, 
  Popup, 
  TileLayer, 
  useMap, 
  useMapEvents 
} from 'react-leaflet';
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

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [[26.0, 79.5], [30.5, 88.5]];

// User location icon
const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(66,133,244,0.6);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ==========================
// Error Boundary
// ==========================
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('MapErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return <div className="absolute inset-0 flex items-center justify-center text-red-500 font-bold bg-white/80">Map failed to load. Please refresh.</div>;
    }
    return this.props.children;
  }
}

// ==========================
// Map Resize Handler (fixes gray tiles on load/refresh)
// ==========================
const MapResizeHandler = () => {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 300); // Small delay after mount

    return () => clearTimeout(timer);
  }, [map]);

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

  if (t.includes('road') || t.includes('block')) iconHtml = '🚧';
  else if (t.includes('traffic')) iconHtml = '🚗';
  else if (t.includes('weather') || t.includes('flood') || t.includes('landslide')) iconHtml = '⛈️';
  else if (t.includes('hospital')) iconHtml = '🏥';
  else if (t.includes('fuel')) iconHtml = '⛽';
  else if (t.includes('food')) iconHtml = '🍛';
  else if (t.includes('temple')) iconHtml = '🛕';

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
// Tile Layer Component
// ==========================
const TileLayerComponent = ({ 
  layer, 
  isDarkMode, 
  mapEngine 
}: { 
  layer: MapLayerType; 
  isDarkMode: boolean; 
  mapEngine: MapEngine | null;
}) => {
  const tileUrls: Record<MapLayerType, string> = {
    standard: mapEngine === 'nepal' 
      ? APP_CONFIG.map.nepalTile 
      : (isDarkMode ? APP_CONFIG.map.darkTile : APP_CONFIG.map.streetTile),
    satellite: APP_CONFIG.map.satelliteTile,
    terrain: APP_CONFIG.map.terrainTile,
    '3d': isDarkMode ? APP_CONFIG.map.darkTile : APP_CONFIG.map.streetTile,
  };

  const url = tileUrls[layer] || tileUrls.standard;

  return (
    <TileLayer
      url={url}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      minZoom={6}
      bounds={mapEngine === 'nepal' ? NEPAL_MAX_BOUNDS : undefined}
      errorTileUrl="https://via.placeholder.com/256?text=Tile+Unavailable" // Fallback for broken tiles
      updateWhenIdle={false}
      zIndex={1}
    />
  );
};

// ==========================
// Map Controller Components (unchanged but kept clean)
// ==========================
const MapController = ({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView([target.lat, target.lng], target.zoom || 12, { animate: true });
    }
  }, [target, map]);
  return null;
};

const GeoAutoCenter = ({ lat, lng, loading, engine }: { 
  lat: number; lng: number; loading: boolean; engine: MapEngine | null;
}) => {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (!loading && !hasFlown.current && lat !== 0 && lng !== 0) {
      hasFlown.current = true;
      const targetZoom = engine === 'world' ? 7 : 12;
      map.flyTo([lat, lng], targetZoom, { duration: 1.5 });
    }
  }, [loading, lat, lng, map, engine]);

  return null;
};

const MapEngineChanger = ({ engine, geoLat, geoLng, geoLoading }: { 
  engine: MapEngine | null; geoLat: number; geoLng: number; geoLoading: boolean;
}) => {
  const map = useMap();
  const prevEngine = useRef(engine);

  useEffect(() => {
    if (engine && engine !== prevEngine.current) {
      prevEngine.current = engine;
      if (engine === 'world') {
        map.flyTo([28, 84], 6, { duration: 1.5 });
      } else {
        const targetLat = (!geoLoading && geoLat !== 0) ? geoLat : NEPAL_CENTER[0];
        const targetLng = (!geoLoading && geoLng !== 0) ? geoLng : NEPAL_CENTER[1];
        map.flyTo([targetLat, targetLng], 7, { duration: 1.5 });
      }
    }
  }, [engine, map, geoLat, geoLng, geoLoading]);

  return null;
};

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
    }
  };

  // Helper for WebSocket
  const getWebSocketUrl = (): string => {
    const apiUrl = APP_CONFIG.apiBaseUrl;
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    try {
      const url = new URL(apiUrl);
      return `${wsProtocol}//${url.host}/ws/live`;
    } catch {
      return 'ws://localhost:4000/ws/live';
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
        {isCalculatorOpen && (
          <DistanceCalculator 
            points={calcPoints} 
            onClose={() => setIsCalculatorOpen(false)} 
            clearPoints={() => setCalcPoints([])} 
          />
        )}

        {!showDriverDashboard && (
          <FloatingMenu
            onServiceSelect={handleServiceSelect}
            onOpenCalculator={() => { closeOverlays(); setIsCalculatorOpen(true); setCalcPoints([]); }}
            activeService={activeService}
            incidents={incidents}
          />
        )}

        {!showDriverDashboard && (
          <MapLayersToggle 
            currentLayer={mapLayer} 
            onLayerChange={setMapLayer} 
            activeFilters={roadFilters} 
            onFilterToggle={(f) => setRoadFilters(prev => ({ ...prev, [f]: !prev[f] }))} 
            isDarkMode={isDarkMode}
            mapEngine={mapEngine} 
            onMapEngineChange={handleMapEngineSelect} 
            onResetEngine={() => { setMapEngine(null); localStorage.removeItem('merosadak-map-engine'); }} 
          />
        )}

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
            isDarkMode={isDarkMode}
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
              key={mapEngine || 'default'}   // Important: forces remount on engine change
              center={geo.loading || (geo.lat === 0 && geo.lng === 0) ? NEPAL_CENTER : [geo.lat, geo.lng]}
              zoom={geo.loading || (geo.lat === 0 && geo.lng === 0) ? 7 : 12}
              minZoom={6}
              maxZoom={18}
              maxBounds={NEPAL_MAX_BOUNDS}
              maxBoundsViscosity={0.9}        // Higher = stronger restriction
              zoomControl={false}
              className="h-full w-full"
              whenCreated={(map) => {
                // Extra safety for tile loading
                setTimeout(() => map.invalidateSize(), 100);
              }}
            >
              <MapResizeHandler />
              <MapEvents onClick={handleMapClick} />

              {mapEngine === 'nepal' && <NepalBounds boundary={boundary} isDarkMode={isDarkMode} />}
              {mapEngine === 'nepal' && <MonsoonRiskOverlay incidents={incidents} />}
              {mapEngine === 'nepal' && (
                <RoadOverlay 
                  isVisible={true} 
                  filters={roadFilters} 
                />
              )}

              <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
                {incidents.map((i) => (
                  <Marker
                    key={i.id}
                    position={[i.lat, i.lng]}
                    icon={getMarkerIcon(i.type, i.severity)}
                    eventHandlers={{ 
                      click: () => {
                        setSelectedIncident(i);
                        setTargetLocation({ lat: i.lat, lng: i.lng, zoom: 14 });
                      }
                    }}
                  />
                ))}
              </MarkerClusterGroup>

              {!geo.loading && geo.lat !== 0 && geo.lng !== 0 && (
                <Marker position={[geo.lat, geo.lng]} icon={userLocationIcon}>
                  <Popup>You are here</Popup>
                </Marker>
              )}

              <TileLayerComponent 
                layer={mapLayer} 
                isDarkMode={isDarkMode} 
                mapEngine={mapEngine} 
              />

              <MapController target={targetLocation} />
              <GeoAutoCenter lat={geo.lat} lng={geo.lng} loading={geo.loading} engine={mapEngine} />
              <Map3DToggle layer={mapLayer} />
              <MapEngineChanger engine={mapEngine} geoLat={geo.lat} geoLng={geo.lng} geoLoading={geo.loading} />
              <MapControls userLocation={geo.loading ? null : { lat: geo.lat, lng: geo.lng }} />
            </MapContainer>
          </MapErrorBoundary>
        </main>
      </div>

      {/* SOS Button */}
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

      {isLoading && (
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center text-primary font-bold z-50">
          Syncing Map Data...
        </div>
      )}
    </div>
  );
};

export default App;