// src/components/SearchOverlay.tsx
import React, { useState, useEffect } from 'react';
import { Search, Mic, Sparkles, Navigation, Map, MoreVertical, X } from 'lucide-react';
import { TravelIncident } from '../types';

interface SearchOverlayProps {
  isDarkMode: boolean;
  incidents: TravelIncident[];
  onSelectLocation: (incident: TravelIncident) => void;
  onAskAI: (topic: string) => void;
  mapSelectionContext?: string;
  onClearContext?: () => void;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ isDarkMode, incidents, onSelectLocation, onAskAI }) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<TravelIncident[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TravelIncident | null>(null);

  // 🛰️ Global Search with local fallback
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length > 1) {
        try {
          // 1. Try backend global search (roads, POIs, locations)
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.length > 0) {
              setResults(result.data);
              setShowResults(true);
              return;
            }
          }

          // 2. Fallback to local filtering if backend search is offline/empty
          const hits = incidents.filter(i => 
            i.title.toLowerCase().includes(query.toLowerCase()) || 
            i.description.toLowerCase().includes(query.toLowerCase())
          );
          setResults(hits);
          setShowResults(true);
        } catch (err) {
          console.error("Search failed, using local fallback");
        }
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300); // ⏱️ Debounce for 300ms

    return () => clearTimeout(handler);
  }, [query, incidents]);

  const handleMicClick = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    
    setIsListening(true);
    // @ts-ignore - experimental API
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setQuery(text);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const basicCardClass = `absolute top-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-[1000] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl border transition-all duration-300 glass-pilot ${isDarkMode ? 'border-white/5 text-white' : 'border-black/5 text-slate-800'}`;

  return (
    <>
      <div className={basicCardClass}>
        {mapSelectionContext && (
          <div className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-2">
               <Navigation size={12} className="animate-pulse" />
               <span>Map Selection Active</span>
            </div>
            <button onClick={onClearContext}><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center p-3 gap-3">
          <Search className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <input 
            value={mapSelectionContext || query}
            onChange={(e) => setQuery(e.target.value)}
            className={`flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-900'} ${mapSelectionContext ? 'font-black italic text-indigo-500' : ''}`}
            placeholder={isListening ? "Listening..." : "Search places, roads, updates..."}
          />
          <button onClick={handleMicClick} className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}>
            <Mic className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button 
            onClick={() => onAskAI("General road conditions")} 
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI</span>
          </button>
        </div>

        {/* Results Dropdown */}
        {showResults && results.length > 0 && !selectedItem && (
          <div className={`border-t max-h-64 overflow-y-auto ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'} rounded-b-2xl`}>
            {results.map(r => (
              <div 
                key={r.id} 
                className={`p-3 border-b border-dashed border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex items-center justify-between group`}
                onClick={() => {
                  setSelectedItem(r);
                  onSelectLocation(r);
                  setShowResults(false);
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-bold">
                      {r.type === 'road' ? '🛣️' : r.type === 'location' ? '📍' : r.type === 'weather' ? '🌦️' : r.type === 'traffic' ? '🚥' : '✨'}
                      {r.name}
                    </h4>
                    {r.source === 'local' ? (
                      <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md font-black uppercase tracking-tighter border border-blue-200 dark:border-blue-800">Official</span>
                    ) : r.source === 'osm' || r.source === 'tomtom' ? (
                      <span className="text-[8px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-md font-black uppercase tracking-tighter border border-purple-200 dark:border-purple-800">Community</span>
                    ) : null}
                  </div>
                  <p className={`text-[11px] font-medium leading-tight ${r.subtitle?.includes('❌') ? 'text-red-500' : r.subtitle?.includes('⚠️') ? 'text-amber-500' : 'opacity-60'}`}>
                    {r.subtitle}
                  </p>
                </div>
                <Navigation className="w-4 h-4 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>

  {/* Selected Item Floating Details Card */}
  {selectedItem && (
    <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-[1000] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[32px] p-5 border animate-in slide-in-from-bottom-10 fade-in duration-300 glass-pilot ${isDarkMode ? 'border-white/5 text-white' : 'border-black/5 text-slate-800'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-indigo-500">
              {selectedItem.type === 'road' ? '🛣️' : selectedItem.type === 'weather' ? '🌦️' : selectedItem.type === 'traffic' ? '🚥' : '📍'}
              {selectedItem.name || (selectedItem as any).title}
            </h2>
            {selectedItem.source === 'local' ? (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Official</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest leading-none">Community</span>
              </div>
            )}
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${selectedItem.subtitle?.includes('❌') ? 'text-red-500' : selectedItem.subtitle?.includes('⚠️') ? 'text-amber-500' : 'text-emerald-500'}`}>
            {selectedItem.source === 'local' ? `✓ Verified by Dept. of Roads (DOR)` : `📡 Unofficial: Community Sourced Data`}
          </p>
        </div>
        <button onClick={() => setSelectedItem(null)} className="opacity-50 hover:opacity-100 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Rich Statistics for Highways */}
      {selectedItem.type === 'road' && (selectedItem as any).extra && (
        <div className="grid grid-cols-3 gap-2 my-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
           <div className="text-center">
             <div className="text-[10px] opacity-60">Segments</div>
             <div className="font-bold text-sm">{(selectedItem as any).extra.segments || 0}</div>
           </div>
           <div className="text-center border-l border-slate-200 dark:border-slate-700">
             <div className="text-[10px] opacity-60">Blocks</div>
             <div className="font-bold text-sm text-red-500">{(selectedItem as any).extra.blocked || 0}</div>
           </div>
           <div className="text-center border-l border-slate-200 dark:border-slate-700">
             <div className="text-[10px] opacity-60">Risk</div>
             <div className="font-bold text-sm text-amber-600">⛈️ {(selectedItem as any).extra.highRiskMonsoon || 0}</div>
           </div>
        </div>
      )}

      {/* 🌦️ Smart Weather Stats */}
      {selectedItem.type === 'weather' && (selectedItem as any).extra && (
        <div className="grid grid-cols-2 gap-3 my-4 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
          <div className="text-center">
            <div className="text-[10px] opacity-60">Humidity</div>
            <div className="font-bold text-sm">{(selectedItem as any).extra.humidity}%</div>
          </div>
          <div className="text-center border-l border-indigo-100 dark:border-indigo-800">
            <div className="text-[10px] opacity-60">Wind</div>
            <div className="font-bold text-sm">{(selectedItem as any).extra.windSpeed} km/h</div>
          </div>
        </div>
      )}

      {/* 🚦 Smart Traffic Stats */}
      {selectedItem.type === 'traffic' && (selectedItem as any).extra && (
        <div className="grid grid-cols-2 gap-3 my-4 bg-amber-50/50 dark:bg-amber-900/20 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30">
          <div className="text-center">
            <div className="text-[10px] opacity-60">Avg Speed</div>
            <div className="font-bold text-sm">{(selectedItem as any).extra.currentSpeed} km/h</div>
          </div>
          <div className="text-center border-l border-amber-100 dark:border-amber-800">
            <div className="text-[10px] opacity-60">Flow Confidence</div>
            <div className="font-bold text-sm">{Math.round((selectedItem as any).extra.confidence * 100)}%</div>
          </div>
        </div>
      )}

      <p className="text-[11px] sm:text-sm opacity-80 mb-4 sm:mb-6 leading-relaxed line-clamp-3 sm:line-clamp-none">
        {selectedItem.type === 'road' 
          ? `Current status monitoring for ${selectedItem.name}. This is a critical artery in the Nepal road network.` 
          : (selectedItem as any).description || `Information for ${selectedItem.name} within Nepal territory.`}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ActionButton 
          icon={<Navigation className="w-4 h-4 sm:w-5 sm:h-5" />} 
          label="Travel" 
          onClick={() => onSelectLocation(selectedItem)} 
          isPrimary 
        />
        <ActionButton 
          icon={<Map className="w-4 h-4 sm:w-5 sm:h-5" />} 
          label="Explore" 
          onClick={() => onSelectLocation(selectedItem)} 
        />
        <ActionButton 
          icon={<Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />} 
          label="Ask AI" 
          onClick={() => onAskAI(`Check if the route to ${selectedItem.name} is blocked.`)} 
        />
      </div>

      {/* 💠 Intent-Aware Related Services Carousel */}
      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Related Discovery
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
           {[
             { id: 'fuel', icon: <Fuel size={14} className="text-orange-500" />, label: 'Fuel' },
             { id: 'food', icon: <ChefHat size={14} className="text-emerald-500" />, label: 'Food' },
             { id: 'medical', icon: <Stethoscope size={14} className="text-red-500" />, label: 'Medical' },
             { id: 'weather', icon: <CloudRain size={14} className="text-blue-500" />, label: 'Weather' },
             { id: 'roads', icon: <AlertTriangle size={14} className="text-amber-500" />, label: 'Roads' }
           ].map(serv => (
             <button 
               key={serv.id}
               className="flex flex-col items-center gap-2 shrink-0 group"
               onClick={() => {
                  setSelectedItem(null);
                  onAskAI(`Show me ${serv.label} nearby on the way to ${selectedItem.name}`);
               }}
             >
               <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center transition-all group-hover:bg-indigo-600/20 group-hover:border-indigo-500/30 group-hover:-translate-y-1">
                 {serv.icon}
               </div>
               <span className="text-[8px] font-black text-slate-500 uppercase group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{serv.label}</span>
             </button>
           ))}
        </div>
      </div>
    </div>
  )}
    </>
  );
};

const ActionButton = ({ icon, label, onClick, isPrimary }: { icon: any, label: string, onClick: () => void, isPrimary?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all ${isPrimary ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 hover:scale-105' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
  >
    {icon}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

export default SearchOverlay;
