// src/App.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Bell, MessageSquare, Menu, Globe } from 'lucide-react'; // Added icons

import Header from './components/Header';
import { NepalBounds } from './components/NepalBounds';
import SearchOverlay from './components/SearchOverlay';
import Sidebar from './components/Sidebar'; // ✅ Import new Sidebar
import { useNepalData } from './hooks/useNepalData';
import { useGemini } from './hooks/useGemini';
import { DriverDashboard } from './components/DriverDashboard';
import { LoadingScreen } from './components/LoadingScreen';
import { FloatingMenu } from './components/FloatingMenu';
import { DistanceCalculator } from './components/DistanceCalculator';
import { MapLayersToggle, MapLayerType } from './components/MapLayersToggle';
import { SystemMenu } from './components/SystemMenu';
import { MapControls } from './components/MapControls';
import { SOSOverlay } from './components/SOSOverlay';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useWebSocket } from './hooks/useWebSocket';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * 🎨 Dynamic Marker Customization
 * Creates colored markers based on incident type and severity
 */
const getMarkerIcon = (type: string, severity: string) => {
  const color = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f59e0b' : '#6366f1';
  let iconHtml = '📍';
  const t = type.toLowerCase();

  // 🚦 Road & Traffic
  if (t.includes('road')) iconHtml = '🚧';
  else if (t.includes('traffic') || t.includes('congestion')) iconHtml = '🚗';
  
  // ⛈️ Weather & Monsoon
  else if (t.includes('weather')) iconHtml = '⛅';
  else if (t.includes('monsoon') || t.includes('flood') || t.includes('landslide')) iconHtml = '⛈️';
  else if (t.includes('rain')) iconHtml = '🌧️';

  // 🏥 POIs (Diverse Types)
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
    html: `<div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50% 50% 50% 2px; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            <div style="transform: rotate(45deg); font-size: 16px; margin-top: -2px; margin-left: -2px;">${iconHtml}</div>
           </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });
};

const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];

const MapController = ({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], target.zoom || 12, { animate: true });
  }, [target, map]);
  return null;
};

const App: React.FC = () => {
  const { incidents, isLoading, boundary, refresh } = useNepalData();
  const { messages, ask, isProcessing } = useGemini();
  const { isConnected: isLive } = useWebSocket();

  const [activeTab, setActiveTab] = useState<'alerts' | 'chat'>('alerts');
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  
  // ✅ Managed Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme-mode') === 'dark');
  const [showPilotDashboard, setShowPilotDashboard] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // New states for measurement and context
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcPoints, setCalcPoints] = useState<{lat: number, lng: number}[]>([]);
  const [mapContextText, setMapContextText] = useState<string | undefined>(undefined);
  const [activeService, setActiveService] = useState<string | null>(null);

  // 🌍 Map Control States
  const [mapLayer, setMapLayer] = useState<MapLayerType>('standard');
  const [roadFilters, setRoadFilters] = useState({ blocked: true, oneway: true, open: true });
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const [isSOSOpen, setIsSOSOpen] = useState(false);

  // AI & Voice Personalization
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [aiMode, setAiMode] = useState<'safe' | 'pro'>('safe');
  const [verbosity, setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [moodEQ, setMoodEQ] = useState(true);

  useEffect(() => {
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // ✅ Consolidated Logic
  const handleSendMessage = async (text: string) => {
    const contextInstruction = verbosity === 'brief' 
      ? "[Instruction: Be extremely concise and brief, use bullet points] " 
      : "[Instruction: Provide a detailed and comprehensive report with deep insights] ";
    
    await ask(contextInstruction + text, { lat: NEPAL_CENTER[0], lng: NEPAL_CENTER[1] }, incidents);
  };

  const handleAIQuery = (query: string) => {
    setIsSidebarOpen(true);
    setActiveTab('chat');
    handleSendMessage(query);
  };

  // 💠 Custom Cluster Icon Function
  const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    let sizeClass = 'cluster-small';
    if (count > 10) sizeClass = 'cluster-medium';
    if (count > 50) sizeClass = 'cluster-large';

    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `custom-marker-cluster ${sizeClass}`,
      iconSize: L.point(40, 40, true),
    });
  };

  const handleLocationSelect = (item: any) => {
    if (item.type === 'road') {
      // It's a highway from the backend search
      setTargetLocation({ lat: item.lat, lng: item.lng, zoom: 10 });
      setIsSidebarOpen(false);
      // Optional: Logic to highlight entire highway can be added if we have full GeoJSON lines
    } else {
      // It's a specific incident or location
      setTargetLocation({ lat: item.lat, lng: item.lng, zoom: 16 });
    }
  };

  // 🗺️ Map Event Handler
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (isCalculatorOpen) {
          setCalcPoints(prev => [...prev, e.latlng]);
        } else {
          setMapContextText(`Marker: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
        }
      },
    });
    return null;
  };

  if (initialLoading) {
    return <LoadingScreen onComplete={() => setInitialLoading(false)} />;
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-all duration-700 ${showPilotDashboard ? 'bg-slate-950 scale-95 opacity-90' : isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Header 
        isDarkMode={isDarkMode} 
        onTogglePilot={() => setShowPilotDashboard(true)}
        onToggleMenu={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleSystemMenu={() => setIsSystemMenuOpen(!isSystemMenuOpen)}
        onToggleSOS={() => setIsSOSOpen(true)}
        noticeCount={incidents.filter(i => i.severity === 'high').length}
      />

      <SOSOverlay 
        isOpen={isSOSOpen} 
        onClose={() => setIsSOSOpen(false)} 
        userLocation={{ lat: NEPAL_CENTER[0], lng: NEPAL_CENTER[1] }} // In real app, use live geolocation
      />

      <SystemMenu 
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        isOpen={isSystemMenuOpen}
        onClose={() => setIsSystemMenuOpen(false)}
        onOpenSettings={() => {}}
        voiceGender={voiceGender}
        setVoiceGender={setVoiceGender}
        aiMode={aiMode}
        setAiMode={setAiMode}
        verbosity={verbosity}
        setVerbosity={setVerbosity}
        moodEQ={moodEQ}
        setMoodEQ={setMoodEQ}
      />

      {showPilotDashboard && (
        <DriverDashboard 
          onClose={() => setShowPilotDashboard(false)} 
          speed={42} 
          isLive={isLive}
        />
      )}

      <div className={`flex flex-1 relative overflow-hidden mode-transition ${showPilotDashboard ? 'blur-sm grayscale brightness-50 pointer-events-none' : ''}`}>
        
        {/* ✅ Distance Calculator Overlay */}
        {isCalculatorOpen && (
          <DistanceCalculator 
            onClose={() => setIsCalculatorOpen(false)} 
            points={calcPoints} 
            clearPoints={() => setCalcPoints([])}
          />
        )}

        {/* ✅ Floating Services Menu */}
        {!showPilotDashboard && (
          <FloatingMenu 
            onServiceSelect={(id) => {
              setActiveService(id);
              setIsSidebarOpen(true);
              setActiveTab('alerts');
            }} 
            onOpenCalculator={() => { setIsCalculatorOpen(true); setCalcPoints([]); }}
          />
        )}

        {/* ✅ Map Layers & Filters Toggle */}
        {!showPilotDashboard && (
          <MapLayersToggle 
            currentLayer={mapLayer}
            onLayerChange={setMapLayer}
            activeFilters={roadFilters}
            onFilterToggle={(f) => setRoadFilters(prev => ({ ...prev, [f]: !prev[f] }))}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ✅ Managed Sidebar Component */}
        {!showPilotDashboard && (
          <Sidebar 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            incidents={incidents}
            onSelectIncident={handleLocationSelect}
            chatMessages={messages}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            isDarkMode={isDarkMode}
            onRefresh={() => { refresh(); setActiveService(null); }}
            isRefreshing={isLoading}
            serviceType={activeService}
            serviceResults={incidents.filter(i => activeService ? i.type.toLowerCase().includes(activeService.toLowerCase()) : true)}
          />
        )}

        {/* ✅ Floating Toggle Buttons (Visible when Sidebar is Closed) */}
        {!isSidebarOpen && (
           <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
             <button 
               onClick={() => { setActiveTab('alerts'); setIsSidebarOpen(true); }}
               className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 text-indigo-600 hover:scale-110 transition-transform"
               title="Open Alerts"
             >
               <Bell className="w-5 h-5" />
             </button>
             <button 
               onClick={() => { setActiveTab('chat'); setIsSidebarOpen(true); }}
               className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 text-indigo-600 hover:scale-110 transition-transform"
               title="Open AI Chat"
             >
               <MessageSquare className="w-5 h-5" />
             </button>
           </div>
        )}

        {/* Map Area */}
        <main className={`flex-1 relative transition-all duration-300 ${isSidebarOpen ? 'ml-0 sm:ml-80 md:ml-96' : 'ml-0'}`}>
          <SearchOverlay 
            isDarkMode={isDarkMode} 
            incidents={incidents} 
            onSelectLocation={handleLocationSelect}
            onAskAI={handleAIQuery}
            mapSelectionContext={mapContextText}
            onClearContext={() => setMapContextText(undefined)}
          />

          <MapContainer 
            center={NEPAL_CENTER} 
            zoom={7} 
            minZoom={6}
            maxZoom={18}
            maxBounds={[[26, 80], [31, 89]]} 
            className="h-full w-full" 
            zoomControl={false}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            zoomSnap={0.1}
            zoomDelta={0.5}
            wheelDebounceTime={40}
            wheelPxPerZoomLevel={120}
          >
            <MapEvents />
            
            {/* Dynamic TileLayers */}
            {mapLayer === 'standard' && (
              <TileLayer url={isDarkMode?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png":"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} />
            )}
            {mapLayer === 'satellite' && (
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            )}
            {mapLayer === 'terrain' && (
              <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
            )}
            {mapLayer === '3d' && (
               <TileLayer url="https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=YOUR_API_KEY_HERE" /> // Placeholder for a more 3D-ish style
            )}

            <MapControls />

            <NepalBounds boundary={boundary} isDarkMode={isDarkMode} />

            {/* 💠 Cluster Group for better organization */}
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
              {/* Filtered Incidents Rendering */}
              {incidents
                .filter(i => {
                  if (i.type.toLowerCase().includes('road')) {
                    if (i.description.toLowerCase().includes('block') && !roadFilters.blocked) return false;
                    if (i.description.toLowerCase().includes('one-way') && !roadFilters.oneway) return false;
                    if (i.description.toLowerCase().includes('resumed') && !roadFilters.open) return false;
                  }
                  return true;
                })
                .map(i => (
                  <Marker 
                    key={i.id} 
                    position={[i.lat, i.lng]} 
                    icon={getMarkerIcon(i.type, i.severity)}
                  >
                    <Popup>
                      <div className="p-2 min-w-[150px]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{i.type.includes('Road') ? '🚧' : i.type.includes('Traffic') ? '🚗' : '📍'}</span>
                          <h5 className="font-bold text-indigo-600 leading-tight m-0">{i.title}</h5>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 m-0 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                          {i.description}
                        </p>
                        <div className="mt-2 text-[9px] opacity-50 font-mono">
                          LAT: {i.lat.toFixed(4)} | LNG: {i.lng.toFixed(4)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MarkerClusterGroup>

            <MapController target={targetLocation} />
          </MapContainer>

          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white text-xs font-bold tracking-widest uppercase">Syncing Nepal Map...</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
