// src/App.tsx
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
import { BoundaryOverlay } from './components/BoundaryOverlay';
import { HighwayBrowser } from './components/HighwayBrowser';
import { ToastContainer, useToast } from './components/Toast';
import ReportIncidentOverlay from './components/ReportIncidentOverlay';
import { SOSOverlay } from './components/SOSOverlay';
import { SystemMenu } from './components/SystemMenu';
import { FloatingMenu } from './components/FloatingMenu';
import { MapEngineSelector } from './components/MapEngineSelector';
import { DriverDashboard } from './components/DriverDashboard';
import { DistanceCalculator } from './components/DistanceCalculator';
import { MapLayersToggle } from './components/MapLayersToggle';
import SearchOverlay from './components/SearchOverlay';
import { MonsoonRiskOverlay } from './components/MonsoonRiskOverlay';
import { RoadOverlay } from './components/RoadOverlay';
import { HighwayHighlightOverlay } from './components/HighwayHighlightOverlay';
import { MapControls } from './components/MapControls';
import { BottomInfoArea } from './components/BottomInfoArea';

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

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [[26.0, 79.5], [30.5, 88.5]];

const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(66,133,244,0.6);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// TileLayer component for map tiles
const TileLayerComponent = ({ 
  layer, 
  isDarkMode, 
  mapEngine 
}: { 
  layer: MapLayerType; 
  isDarkMode: boolean; 
  mapEngine: MapEngine | null;
}) => {
  // Default reliable tile URL
  const defaultTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  let url: string = defaultTileUrl;

  if (layer === 'satellite') {
    url = APP_CONFIG.map.satelliteTile || defaultTileUrl;
  } else if (mapEngine === 'nepal') {
    url = APP_CONFIG.map.nepalTile || defaultTileUrl;
  } else {
    url = isDarkMode 
      ? (APP_CONFIG.map.darkTile || defaultTileUrl)
      : (APP_CONFIG.map.streetTile || defaultTileUrl);
  }

  return (
    <TileLayer
      url={url}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      minZoom={6}
      bounds={mapEngine === 'nepal' ? NEPAL_MAX_BOUNDS : undefined}
      errorTileUrl="https://via.placeholder.com/256?text=Tile+Unavailable"
      updateWhenIdle={false}
      zIndex={1}
    />
  );
};

const MapResizeHandler = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize({ animate: true }), 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const MapEvents = ({ onClick }: { onClick: (latlng: { lat: number; lng: number }) => void }) => {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
};

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

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><div style="font-size:16px;">${iconHtml}</div></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
};

const MapController = ({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], target.zoom || 12, { animate: true });
  }, [target, map]);
  return null;
};

const GeoAutoCenter = ({ lat, lng, loading, engine }: { lat: number; lng: number; loading: boolean; engine: MapEngine | null }) => {
  const map = useMap();
  const hasFlown = useRef(false);
  useEffect(() => {
    if (!loading && !hasFlown.current && lat !== 0 && lng !== 0) {
      hasFlown.current = true;
      map.flyTo([lat, lng], engine === 'world' ? 7 : 12, { duration: 1.5 });
    }
  }, [loading, lat, lng, map, engine]);
  return null;
};

const MapEngineChanger = ({ engine, geoLat, geoLng, geoLoading }: { engine: MapEngine | null; geoLat: number; geoLng: number; geoLoading: boolean }) => {
  const map = useMap();
  const prevEngine = useRef(engine);
  useEffect(() => {
    if (engine && engine !== prevEngine.current) {
      prevEngine.current = engine;
      const targetZoom = engine === 'world' ? 6 : 7;
      const targetLat = (!geoLoading && geoLat !== 0) ? geoLat : NEPAL_CENTER[0];
      const targetLng = (!geoLoading && geoLng !== 0) ? geoLng : NEPAL_CENTER[1];
      map.flyTo([targetLat, targetLng], targetZoom, { duration: 1.5 });
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
  }, [layer, map]);
  return null;
};

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; retryCount: number }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  handleRetry = () => this.setState(prev => ({ hasError: false, retryCount: prev.retryCount + 1 }));
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-50 p-4">
          <p className="text-red-600 text-lg mb-4">Map failed to load</p>
          <button onClick={this.handleRetry} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Retry Loading Map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const { incidents, isLoading } = useNepalData();
  const { messages, ask, isProcessing } = useGemini();
  const { isConnected } = useWebSocket('wss://merosadak.banjays.workers.dev/ws/live');
  const geo = useGeolocation();
  const toast = useToast();

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
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showHighways, setShowHighways] = useState(false);
  const [isHighwayBrowserOpen, setIsHighwayBrowserOpen] = useState(false);

  const [aiPersona, setAiPersona] = useState('safety');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [moodEQ, setMoodEQ] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const serviceData = useServiceData(activeService, geo.lat, geo.lng, geo.loading);

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
    setIsSidebarOpen(true);
  };

  const handleServiceSelect = (serviceId: string | null) => {
    closeOverlays();
    setActiveService(serviceId);
    setIsSidebarOpen(true);
    setActiveSidebarTab('alerts');
  };

  const handleAskAI = (query: string) => {
    setActiveSidebarTab('chat');
    setIsSidebarOpen(true);
    ask(query, { lat: geo.lat, lng: geo.lng }, incidents, aiPersona);
  };

  const handleReportSuccess = () => {
    toast.success('Incident reported successfully! Thank you for helping others.');
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (isCalculatorOpen) setCalcPoints(prev => [...prev, latlng]);
  };

  const handleSelectHighway = (highwayCode: string) => {
    // For now, just close the browser and show highways
    setIsHighwayBrowserOpen(false);
    setShowHighways(true);
    // TODO: Zoom to highway bounds and highlight it
  };

  return (
    <div className={`h-screen w-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <Header
        isDarkMode={isDarkMode}
        onTogglePilot={() => { closeOverlays(); setShowDriverDashboard(true); }}
        onToggleMenu={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleSystemMenu={() => setIsSystemMenuOpen(!isSystemMenuOpen)}
        onOpenNotifications={openNotifications}
        noticeCount={(incidents || []).filter(i => i.severity === 'high').length}
      />

      <SOSOverlay isOpen={isSOSOpen} onClose={() => setIsSOSOpen(false)} userLocation={{ lat: geo.lat, lng: geo.lng }} />

      <HighwayBrowser
        isOpen={isHighwayBrowserOpen}
        onClose={() => setIsHighwayBrowserOpen(false)}
        onSelectHighway={handleSelectHighway}
        incidents={incidents}
      />

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

        <FloatingMenu
          onServiceSelect={handleServiceSelect}
          onOpenCalculator={() => { closeOverlays(); setIsCalculatorOpen(true); setCalcPoints([]); }}
          onOpenReport={() => setIsReportOpen(true)}
          onTogglePilot={() => { closeOverlays(); setShowDriverDashboard(true); }}
          activeService={activeService}
          incidents={incidents}
        />

        <MapLayersToggle
          currentLayer={mapLayer}
          onLayerChange={setMapLayer}
          activeFilters={roadFilters}
          onFilterToggle={(f) => setRoadFilters(prev => ({ ...prev, [f]: !prev[f] }))}
          isDarkMode={isDarkMode}
          mapEngine={mapEngine}
          onMapEngineChange={handleMapEngineSelect}
          onResetEngine={() => { setMapEngine(null); localStorage.removeItem('merosadak-map-engine'); }}
          showHighways={showHighways}
          onToggleHighways={() => setShowHighways(!showHighways)}
          onOpenHighwayBrowser={() => setIsHighwayBrowserOpen(true)}
        />

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
          incidents={incidents}
          serviceType={activeService}
          serviceResults={activeService ? serviceData.data : incidents}
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

        <main className={`flex-1 relative ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
          <SearchOverlay
            incidents={incidents}
            onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 12 })}
            onAskAI={handleAskAI}
            onSelectItem={setSelectedIncident}
          />

          <MapErrorBoundary>
            <MapContainer
              center={geo.loading || (geo.lat === 0 && geo.lng === 0) ? NEPAL_CENTER : [geo.lat, geo.lng]}
              zoom={geo.loading || (geo.lat === 0 && geo.lng === 0) ? (mapEngine === 'world' ? 5 : 7) : 12}
              minZoom={mapEngine === 'world' ? 3 : 6}
              maxZoom={19}
              maxBounds={mapEngine === 'world' ? [[-90, -180], [90, 180]] : NEPAL_MAX_BOUNDS}
              maxBoundsViscosity={0.95}
              zoomControl={false}
              className="h-full w-full"
            >
              <MapResizeHandler />
              <MapEvents onClick={handleMapClick} />

              {/* Nepal Boundary Layers - ONLY shown when Nepal map is selected */}
              {mapEngine === 'nepal' && (
                <BoundaryOverlay
                  showDistricts={false}
                  showProvinces={true}
                  showLocal={false}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* Highway Highlight Overlay - show all highways or only incident highways */}
              {mapEngine === 'nepal' && showHighways && (
                <HighwayHighlightOverlay
                  incidents={showHighways ? [] : incidents} // Empty array shows all highways, incidents array shows only incident highways
                  isVisible={true}
                />
              )}

              {/* Road & Monsoon overlays only on Nepal map */}
              {mapEngine === 'nepal' && <MonsoonRiskOverlay incidents={incidents} />}
              {mapEngine === 'nepal' && <RoadOverlay isVisible={true} filters={roadFilters} />}
              {mapEngine === 'nepal' && <HighwayHighlightOverlay incidents={incidents} isVisible={true} />}

              <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
                {(incidents || [])
                  .filter(i => i.hasExactLocation && i.lat !== undefined && i.lng !== undefined)
                  .map((i) => (
                  <Marker
                    key={i.id}
                    position={[i.lat!, i.lng!]}
                    icon={getMarkerIcon(i.type, i.severity)}
                    eventHandlers={{ click: () => setSelectedIncident(i) }}
                  />
                ))}
              </MarkerClusterGroup>

              {!geo.loading && geo.lat !== 0 && geo.lng !== 0 && (
                <Marker position={[geo.lat, geo.lng]} icon={userLocationIcon} />
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

      {!showDriverDashboard && (
        <button
          onClick={() => setIsSOSOpen(true)}
          className="fixed bottom-10 right-4 z-[1500] flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-xl active:scale-90 transition-all"
        >
          <ShieldAlert size={20} />
          <span className="font-black uppercase tracking-wider">SOS</span>
        </button>
      )}

      <BottomInfoArea
        selectedItem={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 14 })}
        onAskAI={handleAskAI}
        isDarkMode={isDarkMode}
      />

      {/* Report Incident Overlay */}
      <ReportIncidentOverlay
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        location={geo.lat !== 0 ? { lat: geo.lat, lng: geo.lng } : undefined}
        onSuccess={handleReportSuccess}
      />

      {/* Toast Notifications */}
      {toast.ToastContainer}

      {isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white z-50">Loading map data...</div>}
    </div>
  );
};

export default App;