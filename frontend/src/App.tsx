import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useNepalData } from "./hooks/useNepalData";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { TravelIncident, ChatMessage } from "./types";
import { apiFetch } from "./api";
import { useTranslation } from "./i18n";

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
import { ToastContainer } from "./components/Toast";
import { OfflineBanner } from "./components/OfflineBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { Toast } from "./components/Toast";

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

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
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

  const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), []);

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
    setReportIncidentOpen(true);
  }, []);

  const handleTogglePilot = useCallback(() => {
    setPilotMode(prev => !prev);
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

  const handleAskAI = useCallback(async (query: string) => {
    setChatMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsProcessing(true);
    setActiveTab('chat');
    setSidebarOpen(true);

    try {
      const result = await apiFetch<any>(`/ai/chat?q=${encodeURIComponent(query)}`, {
        method: 'POST',
        body: JSON.stringify({
          context: { incidents, userLocation, voiceGender, aiMode, verbosity, moodEQ }
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

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const toggleSystemMenu = useCallback(() => setSystemMenuOpen(prev => !prev), []);

  const serviceResults = useMemo(() => {
    if (!serviceType) return [];
    return incidents.filter(i => {
      const type = (i.type || '').toLowerCase();
      return type.includes(serviceType);
    });
  }, [serviceType, incidents]);

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

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
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
            isDarkMode
              ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <MapEventHandler onMapClick={handleMapClick} />
        <BoundaryOverlay isDarkMode={isDarkMode} />
        <MapControls userLocation={userLocation} />
      </MapContainer>

      <Header
        isDarkMode={isDarkMode}
        onTogglePilot={handleTogglePilot}
        onToggleMenu={toggleSidebar}
        onToggleSystemMenu={toggleSystemMenu}
        onOpenNotifications={() => { }}
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

      <SearchOverlay
        isDarkMode={isDarkMode}
        incidents={incidents}
        onSelectLocation={handleSelectLocation}
        onAskAI={handleAskAI}
        onSelectItem={setSelectedItem}
      />

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
      />

      <BottomInfoArea
        selectedItem={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSelectLocation={handleSelectLocation}
        onAskAI={handleAskAI}
        isDarkMode={isDarkMode}
      />

      <HighwayBrowser
        isOpen={highwayBrowserOpen}
        onClose={() => setHighwayBrowserOpen(false)}
        onSelectHighway={(code) => console.log("Selected highway:", code)}
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />

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

      {/* Offline Banner */}
      {isOffline && <OfflineBanner />}
    </div>
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