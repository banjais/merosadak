import React, { useRef, useEffect, useState } from 'react';
import {
  X,
  MessageSquare,
  Bell,
  Send,
  Navigation,
  AlertTriangle,
  Fuel,
  ChefHat,
  Stethoscope,
  TrafficCone as TrafficIcon,
  CloudRain,
  Ban,
  Settings,
  Zap,
  Camera,
  ShieldBan,
  ArrowRightLeft,
  CheckCircle2,
  Map as MapIcon,
  Compass,
  Globe,
  Layers,
  Settings as SettingsIcon,
  AlarmClock,
  CalendarCheck,
  Users
} from 'lucide-react';
import { TravelIncident, ChatMessage } from '../types';
import { RoadStatusDashboard } from './RoadStatusDashboard';
import { SourceBadge } from './SourceBadge';
import { haversineDistance } from '../services/geoUtils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'alerts' | 'chat' | 'summary' | 'services' | 'fleet';
  setActiveTab: (tab: 'alerts' | 'chat' | 'summary' | 'services' | 'fleet') => void;
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string, image?: string) => void;
  isProcessing: boolean;
  isDarkMode: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  serviceType?: string | null;
  serviceResults?: any[];
  onSelectService: (service: string | null) => void;
  nearbyGhostUsers?: any[];
  userLocation?: any;
  activePersona: 'safety' | 'explorer' | 'pro';
  onPersonaChange: (persona: 'safety' | 'explorer' | 'pro') => void;
  voiceGender: 'male' | 'female';
  onGenderChange: (gender: 'male' | 'female') => void;
  onToggleLayers?: () => void;
  onToggleSystemMenu?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  incidents,
  onSelectIncident,
  chatMessages,
  onSendMessage,
  isProcessing,
  isRefreshing,
  isDarkMode,
  serviceType,
  serviceResults,
  onSelectService,
  nearbyGhostUsers = [],
  userLocation,
  activePersona,
  onPersonaChange,
  voiceGender,
  onGenderChange,
  onToggleLayers,
  onToggleSystemMenu
}) => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if (input.trim() || selectedImage) {
      onSendMessage(input, selectedImage || undefined);
      setInput('');
      setSelectedImage(null);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab, isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].pageY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 100));
      if (diff > 10) e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60 && onRefresh) {
      onRefresh();
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  const baseClasses = `
    absolute top-0 left-0 h-full z-[1800] shadow-[30px_0_60px_rgba(27,51,85,0.08)] transform transition-transform duration-300 ease-in-out
    flex flex-col border-r backdrop-blur-xl transition-colors duration-300
    w-full sm:w-80 md:w-96
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isDarkMode
      ? 'bg-slate-900/90 border-slate-700'
      : 'bg-white/85 border-white/40'
    }
  `;

  return (
    <div className={baseClasses}>
      {/* Header Tabs */}
      <div className={`flex items-center p-4 gap-2 border-b shrink-0 transition-colors ${isDarkMode ? 'border-slate-700' : 'border-outline/10'
        }`}>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-bold font-label transition-all ${activeTab === 'alerts'
            ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg'
            : isDarkMode
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              : 'bg-surface-container-low text-on-surface-variant'
            }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            <span>{serviceType ? serviceType.toUpperCase() : 'SAFETY'}</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-bold font-label transition-all ${activeTab === 'chat'
            ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg'
            : isDarkMode
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              : 'bg-surface-container-low text-on-surface-variant'
            }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI CHAT</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-bold font-label transition-all ${activeTab === 'fleet'
            ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg'
            : isDarkMode
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              : 'bg-surface-container-low text-on-surface-variant'
            }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span>FLEET</span>
          </div>
        </button>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode
          ? 'hover:bg-slate-800 text-slate-400'
          : 'hover:bg-surface-container-low text-on-surface-variant'
          }`}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull Indicator */}
        <div
          className="absolute top-0 left-0 w-full flex justify-center overflow-hidden transition-all duration-200 pointer-events-none z-50"
          style={{ height: pullDistance + 'px', opacity: pullDistance / 60 }}
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <div className={`p-2 rounded-full bg-gradient-to-br from-primary to-tertiary text-white shadow-lg transition-transform ${pullDistance > 60 ? 'scale-110 rotate-180' : 'scale-100'}`}>
              <AlertTriangle className="w-5 h-5 pointer-events-none" />
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter font-label">
              {pullDistance > 60 ? 'Release to Refresh' : 'Pull for Updates'}
            </span>
          </div>
        </div>

        {/* Global Refreshing State */}
        {isRefreshing && (
          <div className="sticky top-0 left-0 w-full flex justify-center py-2 z-50 animate-in fade-in slide-in-from-top-4">
            <div className="bg-gradient-to-br from-primary to-tertiary text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-xl font-label">
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              Syncing Live...
            </div>
          </div>
        )}

        {activeTab === 'alerts' ? (
          <div className="space-y-3">
            {/* Road Status Summary Bar */}
            {(() => {
              const roadIncidents = (incidents || []).filter(i =>
                (i.status || i.type || '').toLowerCase().match(/block|one|resum/)
              );
              const blockedCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('block')).length;
              const oneLaneCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('one')).length;
              const resumedCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('resum')).length;
              return (
                <div className="flex gap-2 p-3 rounded-2xl bg-surface-container-low border border-outline/10 mb-4 shadow-sm">
                  {[
                    { label: 'Blocked', count: blockedCount, icon: <ShieldBan size={14} />, color: 'text-error', bg: 'bg-error/10' },
                    { label: '1-Lane', count: oneLaneCount, icon: <ArrowRightLeft size={14} />, color: 'text-amber-600', bg: 'bg-amber-500/10' },
                    { label: 'Resumed', count: resumedCount, icon: <CheckCircle2 size={14} />, color: 'text-emerald-600', bg: 'bg-emerald-500/10' }
                  ].map((stat, idx) => (
                    <div key={idx} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl ${stat.bg} transition-transform hover:scale-105 cursor-default`}>
                      <div className={stat.color}>{stat.icon}</div>
                      <span className={`text-xs font-black ${stat.color} font-headline mt-0.5`}>{stat.count}</span>
                      <span className={`text-[7px] font-black uppercase tracking-tighter ${stat.color} opacity-60 font-label`}>{stat.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {!serviceType ? (
              /* DEFAULT VIEW: Service Selection & Recent Updates */
              <div>
                <h4 className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] mb-3 px-1">Explore Services</h4>
                <div className="grid grid-cols-3 gap-2 mb-8">
                  {[
                    { id: 'roads', label: 'Road Status', icon: <AlertTriangle size={18} />, color: 'text-amber-500' },
                    { id: 'traffic', label: 'Traffic', icon: <TrafficIcon size={18} />, color: 'text-blue-500' },
                    { id: 'hospital', label: 'Medical', icon: <Stethoscope size={18} />, color: 'text-rose-500' },
                    { id: 'monsoon', label: 'Monsoon', icon: <CloudRain size={18} />, color: 'text-amber-500' },
                    { id: 'fuel', label: 'Fuel', icon: <Fuel size={18} />, color: 'text-orange-500' },
                    { id: 'food', label: 'Food', icon: <ChefHat size={18} />, color: 'text-emerald-500' }
                  ].map((service) => (
                    <button
                      key={service.id}
                      onClick={() => onSelectService(service.id)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface-container-low border border-outline/5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className={`mb-1.5 ${service.color}`}>{service.icon}</div>
                      <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-primary transition-colors">{service.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] mb-1 px-1">Recent Safety Updates</h4>
                  {incidents.slice(0, 5).map((incident: any) => (
                    <div
                      key={incident.id}
                      onClick={() => onSelectIncident(incident)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline/5 hover:border-primary/20 transition-all cursor-pointer group"
                    >
                      <div className={`w-2 h-2 rounded-full ${incident.severity === 'high' ? 'bg-error animate-pulse' : 'bg-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-on-surface truncate group-hover:text-primary">{incident.title || incident.name}</p>
                        <p className="text-[9px] text-on-surface-variant/50 uppercase font-bold tracking-tighter">{incident.incidentDistrict || 'Nepal'}</p>
                      </div>
                      <ArrowRightLeft size={12} className="text-on-surface-variant/20 group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            ) : serviceType === 'roads' ? (
              /* ROAD DASHBOARD VIEW */
              <div>
                <div className="flex items-center justify-between mb-4 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} /> Road Status Dashboard
                  </span>
                  <button onClick={() => onSelectService(null)} className="p-1 hover:text-error transition-colors"><X size={14} /></button>
                </div>
                <RoadStatusDashboard incidents={incidents} onSelectIncident={onSelectIncident} />
              </div>
            ) : (
              /* SPECIFIC SERVICE LIST VIEW */
              <>
                <div className="flex items-center justify-between mb-4 bg-primary/5 p-3 rounded-2xl border border-primary/10">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Navigation size={14} /> Nearby {serviceType}
                  </span>
                  <button onClick={() => onSelectService(null)} className="p-1 hover:text-error transition-colors"><X size={14} /></button>
                </div>

                {(serviceResults || []).length === 0 && !isProcessing && (
                  <div className="text-center py-10 opacity-40 italic text-xs">No local data found for this category.</div>
                )}

                {(serviceResults || []).map((incident: any) => (
                  <div key={incident.id} className="p-4 rounded-2xl bg-surface-container-low border border-outline/10 hover:border-primary/30 transition-all group mb-4">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full font-label ${incident.severity === 'high' ? 'bg-error/10 text-error' : incident.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' : incident.severity === 'success' ? 'bg-secondary/10 text-secondary' : 'bg-secondary/10 text-secondary'}`}>
                          {incident.status || incident.severity || 'Normal'}
                        </span>
                        <SourceBadge source={incident.source} />
                      </div>
                      <span className="text-[10px] text-on-surface-variant/40 font-mono italic">
                        {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                      </span>
                    </div>
                    <h4 className="text-sm font-headline font-bold text-primary mb-1 group-hover:text-primary-dim">
                      {incident.title || incident.name}
                    </h4>
                    {incident.road_refno && (
                      <div className="text-[10px] text-on-surface-variant/50 font-mono mb-1">
                        Ref: {incident.road_refno}
                      </div>
                    )}
                    <p className="text-xs text-on-surface-variant/70 line-clamp-2 leading-relaxed font-body">
                      {incident.description || incident.subtitle || 'Infrastructure detail for current region.'}
                    </p>

                    {/* Sheet data fields */}
                    <div className="mt-2 space-y-0.5">
                      {incident.incidentDistrict && (
                        <div className="text-[10px] text-on-surface-variant/50">
                          <span className="font-bold">District:</span> {incident.incidentDistrict}
                          {incident.incidentPlace && ` — ${incident.incidentPlace}`}
                        </div>
                      )}
                      {incident.chainage && (
                        <div className="text-[10px] text-on-surface-variant/50">
                          <span className="font-bold">Chainage:</span> {incident.chainage}
                        </div>
                      )}
                      {incident.incidentStarted && (
                        <div className="text-[10px] text-on-surface-variant/50">
                          <span className="font-bold">Started:</span> {incident.incidentStarted}
                          {incident.estimatedRestoration && ` | Est: ${incident.estimatedRestoration}`}
                        </div>
                      )}
                      {incident.resumedDate && (
                        <div className="text-[10px] text-secondary font-bold">
                          Resumed: {incident.resumedDate}
                        </div>
                      )}
                      {incident.blockedHours && (
                        <div className="text-[10px] text-on-surface-variant/50">
                          <span className="font-bold">Blocked:</span> {incident.blockedHours}h
                        </div>
                      )}
                      {incident.contactPerson && (
                        <div className="text-[10px] text-on-surface-variant/50">
                          <span className="font-bold">Contact:</span> {incident.contactPerson}
                        </div>
                      )}
                      {incident.restorationEfforts && (
                        <div className="text-[10px] text-on-surface-variant/50 mt-1 italic">
                          {incident.restorationEfforts}
                        </div>
                      )}
                      {incident.remarks && (
                        <div className="text-[10px] text-on-surface-variant/40 mt-0.5 italic">
                          {incident.remarks}
                        </div>
                      )}
                    </div>

                    {incident.distance && (
                      <div className="mt-3 pt-3 border-t border-outline/10 flex items-center gap-2 text-[10px] font-bold text-primary font-label">
                        <Navigation size={10} />
                        {incident.distance.toFixed(1)} km from you
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : activeTab === 'fleet' ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-4 bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} /> Mission Fleet Status
              </span>
              <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                {nearbyGhostUsers.length} Units Online
              </span>
            </div>

            <div className="space-y-2">
              {nearbyGhostUsers.map((u) => {
                const dist = userLocation
                  ? haversineDistance(userLocation.lat, userLocation.lng, u.lat, u.lng)
                  : null;

                return (
                  <div key={u.id} className="p-4 rounded-3xl bg-surface-container-low border border-outline/5 hover:border-primary/20 transition-all group shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-black text-on-surface uppercase tracking-tight">Unit: {u.id.slice(0, 8)}</span>
                      </div>
                      {dist !== null && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                          {dist.toFixed(2)} KM
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-outline/5">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-0.5">Safety Vector</span>
                        <span className={`text-sm font-black font-headline ${u.safetyScore && u.safetyScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {Math.round(u.safetyScore || 0)}%
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-0.5">Mech. Stress</span>
                        <span className={`text-sm font-black font-headline ${u.mechanicalStress && u.mechanicalStress > 60 ? 'text-error' : 'text-primary'}`}>
                          {Math.round(u.mechanicalStress || 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {nearbyGhostUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                  <Users size={40} className="mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">Scanning for fleet...</p>
                  <p className="text-[10px] uppercase mt-2">Ensure Ghost Mode is enabled to discover peers</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* AI Personality Toggle */}
            <div className="mb-4 flex items-center justify-between px-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold font-label transition-all ${showSettings ? 'bg-gradient-to-br from-primary to-primary-dim text-white' : 'bg-surface-container-low text-on-surface-variant'}`}
              >
                <Settings size={12} className={showSettings ? 'animate-spin-slow' : ''} />
                <span>AI CONFIG</span>
              </button>
              {activePersona && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest italic font-label">
                  Current: {activePersona}
                </div>
              )}
            </div>

            {showSettings && (
              <div className="mb-6 p-3 bg-primary/5 rounded-2xl border border-primary/10 animate-in slide-in-from-top-2 duration-300">
                <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2 font-label">
                  <Zap size={12} /> Personality Mode
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'safety', label: 'Safety', desc: 'Alerts First' },
                    { id: 'expert', label: 'Expert', desc: 'Route Pro' },
                    { id: 'brief', label: 'Brief', desc: 'Action Only' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onPersonaChange(p.id);
                        setShowSettings(false);
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${activePersona === p.id ? 'bg-white border-primary shadow-md scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <span className="text-[11px] font-bold text-primary leading-tight font-headline">{p.label}</span>
                      <span className="text-[8px] text-on-surface-variant/60 leading-tight font-body">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-20 text-on-surface-variant/40">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-xs font-body">Ask me about road conditions, routing, or general travel advice in Nepal!</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-5 shadow-sm font-body ${m.role === 'user' ? 'bg-gradient-to-br from-primary to-primary-dim text-white rounded-br-none' : 'bg-surface-container-low text-on-surface rounded-bl-none'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-low p-3 rounded-2xl rounded-bl-none flex gap-1">
                    <span className="w-1.5 h-1.5 bg-on-surface-variant/40 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-on-surface-variant/40 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-on-surface-variant/40 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      {
        activeTab === 'chat' && (
          <div className="p-4 border-t border-outline/10 bg-surface-container-low">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2.5 rounded-full text-xs outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest border border-outline/10 font-body text-on-surface"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="p-2.5 bg-gradient-to-br from-primary to-primary-dim disabled:opacity-50 text-white rounded-full hover:shadow-lg transition-all shadow-md shadow-primary/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default Sidebar;
