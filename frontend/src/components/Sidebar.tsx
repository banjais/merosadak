// src/components/Sidebar.tsx
import React, { useRef, useEffect } from 'react';
import { X, MessageSquare, Bell, Send, MapPin, AlertTriangle } from 'lucide-react';
import { TravelIncident, ChatMessage } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'alerts' | 'chat';
  setActiveTab: (tab: 'alerts' | 'chat') => void;
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  isDarkMode: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  serviceType?: string | null;
  serviceResults?: any[];
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
  serviceType,
  serviceResults
}) => {
  const [input, setInput] = React.useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isPulling, setIsPulling] = React.useState(false);
  const startY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab, isOpen]);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput('');
  };

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
      setPullDistance(Math.min(diff * 0.5, 100)); // Elastic pull effect
      if (diff > 10) e.preventDefault(); // Prevent native scroll
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
    absolute top-0 left-0 h-full z-[2000] shadow-[30px_0_60px_rgba(0,0,0,0.2)] transform transition-transform duration-300 ease-in-out
    flex flex-col border-r glass-pilot
    w-full sm:w-80 md:w-96
    ${isDarkMode ? 'border-white/5 text-white' : 'border-black/5 text-slate-800'}
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <div className={baseClasses}>
      {/* Header Tabs */}
      <div className="flex items-center p-4 gap-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button 
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'alerts' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            <span>{serviceType ? serviceType.toUpperCase() : 'SAFETY'}</span>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI CHAT</span>
          </div>
        </button>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
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
             <div className={`p-2 rounded-full bg-indigo-600 text-white shadow-lg transition-transform ${pullDistance > 60 ? 'scale-110 rotate-180' : 'scale-100'}`}>
                <AlertTriangle className="w-5 h-5 pointer-events-none" />
             </div>
             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                {pullDistance > 60 ? 'Release to Refresh' : 'Pull for Updates'}
             </span>
          </div>
        </div>

        {/* Global Refreshing State */}
        {isRefreshing && (
          <div className="sticky top-0 left-0 w-full flex justify-center py-2 z-50 animate-in fade-in slide-in-from-top-4">
             <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl ring-4 ring-indigo-600/20">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                Syncing Live...
             </div>
          </div>
        )}

        {activeTab === 'alerts' ? (
          <div className="space-y-3">
            {serviceType && (
              <div className="flex items-center justify-between mb-4 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Showing {serviceType}</span>
                <button 
                  onClick={() => onRefresh && onRefresh()} 
                  className="text-[9px] font-bold text-slate-500 hover:text-indigo-500 uppercase transition-colors"
                >
                  Clear Filter
                </button>
              </div>
            )}
            
            {(serviceType ? (serviceResults || []) : incidents).length === 0 ? (
              <div className="text-center py-10 opacity-50 text-sm italic">No active {serviceType || 'safety'} items found in this region</div>
            ) : (
              (serviceType ? serviceResults || [] : incidents).map((incident: any) => (
                <div 
                  key={incident.id} 
                  onClick={() => onSelectIncident(incident)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500' : 'bg-white border-slate-100 hover:border-indigo-400 shadow-sm'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${incident.severity==='high'?'bg-red-500/10 text-red-500':incident.severity==='medium'?'bg-orange-500/10 text-orange-500':'bg-emerald-500/10 text-emerald-500'}`}>
                      {incident.severity || 'Normal'}
                    </span>
                    <span className="text-[10px] opacity-40 font-mono italic">
                      {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Live'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-indigo-500 mb-1 group-hover:text-indigo-400">
                    {incident.title || incident.name}
                  </h4>
                  <p className="text-xs opacity-70 line-clamp-2 leading-relaxed">
                    {incident.description || incident.subtitle || 'Infrastructure detail for current region.'}
                  </p>
                  
                  {incident.distance && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-[10px] font-bold text-indigo-400">
                      <Navigation size={10} />
                      {incident.distance.toFixed(1)} km from you
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-20 opacity-40">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-xs">Ask me about road conditions, routing, or general travel advice in Nepal!</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-5 shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isProcessing && (
                 <div className="flex justify-start">
                   <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none flex gap-1">
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                   </div>
                 </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input (Only visible in Chat Tab) */}
      {activeTab === 'chat' && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 rounded-full text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="p-2.5 bg-indigo-600 disabled:opacity-50 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
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
