// src/App.tsx
import React, { useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { BoundaryOverlay } from './components/BoundaryOverlay';
import { HighwayHighlightOverlay } from './components/HighwayHighlightOverlay';
import { MapControls } from './components/MapControls';
import { BottomInfoArea } from './components/BottomInfoArea';
import ReportIncidentOverlay from './components/ReportIncidentOverlay';
import { SOSOverlay } from './components/SOSOverlay';
import { FloatingMenu } from './components/FloatingMenu';
import { MapLayersToggle } from './components/MapLayersToggle';
import { DriverDashboard } from './components/DriverDashboard';
import { DistanceCalculator } from './components/DistanceCalculator';
import SearchOverlay from './components/SearchOverlay';
import { MonsoonRiskOverlay } from './components/MonsoonRiskOverlay';
import { RoadOverlay } from './components/RoadOverlay';

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

// Fix default Leaflet marker
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

const App: React.FC = () => {
  const { incidents, isLoading } = useNepalData();
  const { messages, ask, isProcessing } = useGemini();
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`;
  const { isConnected } = useWebSocket(wsUrl);
  const geo = useGeolocation();
  const toast = useServiceData('', geo.lat, geo.lng); // reuse service data hook for now

  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDriverDashboard, setShowDriverDashboard] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcPoints, setCalcPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | '3d'>('standard');
  const [mapEngine, setMapEngine] = useState<'nepal' | 'world'>(() => 'nepal');
  const [roadFilters, setRoadFilters] = useState({ blocked: true, oneway: true, resumed: true });
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [showHighways, setShowHighways] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const serviceData = useServiceData('', geo.lat, geo.lng);

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (isCalculatorOpen) setCalcPoints(prev => [...prev, latlng]);
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <Header
        isDarkMode={false}
        onTogglePilot={() => setShowDriverDashboard(true)}
        onToggleMenu={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenNotifications={() => setIsSidebarOpen(true)}
        noticeCount={(incidents || []).filter(i => i.severity === 'high').length}
      />

      <SOSOverlay isOpen={isSOSOpen} onClose={() => setIsSOSOpen(false)} userLocation={{ lat: geo.lat, lng: geo.lng }} />

      <FloatingMenu onOpenCalculator={() => setIsCalculatorOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        incidents={incidents}
        onSelectIncident={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 14 })}
        chatMessages={messages}
        onSendMessage={(msg) => ask(msg, { lat: geo.lat, lng: geo.lng }, incidents)}
        isProcessing={isProcessing}
      />

      {showDriverDashboard && <DriverDashboard onClose={() => setShowDriverDashboard(false)} speed={42} isLive={isConnected} />}

      {isCalculatorOpen && <DistanceCalculator points={calcPoints} onClose={() => setIsCalculatorOpen(false)} clearPoints={() => setCalcPoints([])} />}

      <main className="flex-1 relative">
        <SearchOverlay incidents={incidents} onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 12 })} onAskAI={(msg) => ask(msg, { lat: geo.lat, lng: geo.lng }, incidents)} />

        <MapContainer
          center={geo.loading || geo.lat === 0 ? NEPAL_CENTER : [geo.lat, geo.lng]}
          zoom={geo.loading || geo.lat === 0 ? 7 : 12}
          minZoom={6}
          maxZoom={19}
          maxBounds={NEPAL_MAX_BOUNDS}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url={mapLayer === 'satellite' ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
            attribution='&copy; OpenStreetMap contributors'
          />

          <BoundaryOverlay isDarkMode={false} />

          {showHighways && <HighwayHighlightOverlay incidents={incidents} isVisible={true} />}

          <MonsoonRiskOverlay incidents={incidents} />
          <RoadOverlay isVisible={true} filters={roadFilters} />

          <MarkerClusterGroup>
            {(incidents || [])
              .filter(i => i.hasExactLocation && i.lat && i.lng)
              .map((i) => (
                <Marker key={i.id} position={[i.lat!, i.lng!]} icon={getMarkerIcon(i.type, i.severity)} eventHandlers={{ click: () => setSelectedIncident(i) }} />
              ))}
          </MarkerClusterGroup>

          {!geo.loading && geo.lat !== 0 && geo.lng !== 0 && <Marker position={[geo.lat, geo.lng]} icon={userLocationIcon} />}

          <MapControls userLocation={!geo.loading ? { lat: geo.lat, lng: geo.lng } : null} />
        </MapContainer>
      </main>

      {!showDriverDashboard && (
        <button
          onClick={() => setIsSOSOpen(true)}
          className="fixed bottom-10 right-4 z-[1500] flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-xl"
        >
          SOS
        </button>
      )}

      <BottomInfoArea selectedItem={selectedIncident} onClose={() => setSelectedIncident(null)} onSelectLocation={(loc) => setTargetLocation({ lat: loc.lat, lng: loc.lng, zoom: 14 })} onAskAI={(msg) => ask(msg, { lat: geo.lat, lng: geo.lng }, incidents)} />

      <ReportIncidentOverlay isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} location={geo.lat !== 0 ? { lat: geo.lat, lng: geo.lng } : undefined} onSuccess={() => console.log('Reported')} />
    </div>
  );
};

export default App;