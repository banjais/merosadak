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
} from 'lucide-react';
import { TravelIncident, ChatMessage } from '../types';
import { RoadStatusDashboard } from './RoadStatusDashboard';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'alerts' | 'chat';
  setActiveTab: (tab: 'alerts' | 'chat') => void;
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
  activePersona: string;
  onPersonaChange: (persona: string) => void;
  voiceGender: 'male' | 'female';
  onGenderChange: (gender: 'male' | 'female') => void;
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
  activePersona,
  onPersonaChange,
  voiceGender,
  onGenderChange
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
    absolute top-0 left-0 h-full z-[2000] shadow-[30px_0_60px_rgba(27,51,85,0.08)] transform transition-transform duration-300 ease-in-out
    flex flex-col border-r bg-white/85 backdrop-blur-xl border-white/40
    w-full sm:w-80 md:w-96
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <div className={baseClasses}>
      {/* Header Tabs */}
      <div className="flex items-center p-4 gap-2 border-b border-outline/10 shrink-0">
        <button 
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-bold font-label transition-all ${activeTab === 'alerts' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'bg-surface-container-low text-on-surface-variant'}`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            <span>{serviceType ? serviceType.toUpperCase() : 'SAFETY'}</span>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-bold font-label transition-all ${activeTab === 'chat' ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-lg' : 'bg-surface-container-low text-on-surface-variant'}`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI CHAT</span>
          </div>
        </button>
        <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant">
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
              const roadIncidents = (incidents || []).filter(i => {
                const s = (i.status || i.type || '').toLowerCase();
                return s.includes('block') || s.includes('one') || s.includes('resum');
              });
              const blockedCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('block')).length;
              const oneLaneCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('one')).length;
              const resumedCount = roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('resum') && !(i.status || i.type || '').toLowerCase().includes('block') && !(i.status || i.type || '').toLowerCase().includes('one')).length;
              return (
                <div className="flex gap-1.5 p-2 rounded-xl bg-surface-container-low border border-outline/10 mb-2">
                  <button onClick={() => onSelectService('roads')} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 transition-all">
                    <ShieldBan size={12} className="text-error" />
                    <span className="text-[10px] font-black text-error font-headline">{blockedCount}</span>
                    <span className="text-[8px] font-bold text-error/60 uppercase font-label">Blocked</span>
                  </button>
                  <button onClick={() => onSelectService('roads')} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-all">
                    <ArrowRightLeft size={12} className="text-amber-600" />
                    <span className="text-[10px] font-black text-amber-600 font-headline">{oneLaneCount}</span>
                    <span className="text-[8px] font-bold text-amber-600/60 uppercase font-label">1-Lane</span>
                  </button>
                  <button onClick={() => onSelectService('roads')} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-all">
                    <CheckCircle2 size={12} className="text-secondary" />
                    <span className="text-[10px] font-black text-secondary font-headline">{resumedCount}</span>
                    <span className="text-[8px] font-bold text-secondary/60 uppercase font-label">Clear</span>
                  </button>
                </div>
              );
            })()}

            {/* Quick Category Filters */}
            <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar scrollbar-hide mb-4 pb-2 border-b border-outline/10">
              {[
                { id: 'fuel', icon: <Fuel size={14} />, color: 'bg-primary' },
                { id: 'food', icon: <ChefHat size={14} />, color: 'bg-secondary' },
                { id: 'hospital', icon: <Stethoscope size={14} />, color: 'bg-error' },
                { id: 'traffic', icon: <TrafficIcon size={14} />, color: 'bg-primary' },
                { id: 'monsoon', icon: <CloudRain size={14} />, color: 'bg-tertiary' },
                { id: 'roads', icon: <AlertTriangle size={14} />, color: 'bg-amber-500' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onSelectService(cat.id)}
                  className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-xl transition-all ${serviceType === cat.id ? `${cat.color} text-white shadow-lg scale-110` : 'bg-surface-container-low text-on-surface-variant hover:text-primary'}`}
                >
                  {cat.icon}
                </button>
              ))}
              <button 
                onClick={() => onSelectService(null)}
                className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-xl transition-all ${!serviceType ? 'bg-surface-container-high' : 'bg-surface-container-low text-on-surface-variant hover:text-error'}`}
              >
                <Ban size={14} />
              </button>
            </div>

            {serviceType === 'roads' ? (
              /* Road Status Dashboard */
              <div>
                <div className="flex items-center justify-between mb-2 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest font-label flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Road Status Dashboard
                  </span>
                  <button 
                    onClick={() => onSelectService(null)} 
                    className="text-[9px] font-bold text-on-surface-variant hover:text-error uppercase transition-colors font-label"
                  >
                    Clear
                  </button>
                </div>
                <RoadStatusDashboard 
                  incidents={incidents} 
                  onSelectIncident={(incident) => onSelectIncident(incident)}
                />
              </div>
            ) : (
              /* Regular list for other services */
              <>
                {serviceType && (
                  <div className="flex items-center justify-between mb-2 bg-primary/5 p-2.5 rounded-xl border border-primary/10">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest font-label">Showing {serviceType}</span>
                    <button 
                      onClick={() => onSelectService(null)} 
                      className="text-[9px] font-bold text-on-surface-variant hover:text-error uppercase transition-colors font-label"
                    >
                      Clear
                    </button>
                  </div>
                )}
                
                {(serviceType ? (serviceResults || []) : incidents).length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant/50 text-sm italic font-body">No active {serviceType || 'safety'} items found in this region</div>
                ) : (
                  (serviceType ? serviceResults || [] : incidents).map((incident: any) => (
                    <div 
                      key={incident.id} 
                      onClick={() => onSelectIncident(incident)}
                      className="p-4 rounded-[1.5rem] border border-outline/10 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group bg-surface-container-lowest shadow-sm hover:border-primary/40"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full font-label ${incident.severity==='high'?'bg-error/10 text-error':incident.severity==='medium'?'bg-amber-500/10 text-amber-600':incident.severity==='success'?'bg-secondary/10 text-secondary':'bg-secondary/10 text-secondary'}`}>
                          {incident.status || incident.severity || 'Normal'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/40 font-mono italic">
                          {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Live'}
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
                  ))
                )}
              </>
            )}
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
      {activeTab === 'chat' && (
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
      )}
    </div>
  );
};

export default Sidebar;
