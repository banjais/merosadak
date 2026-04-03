import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, Sparkles, Navigation, X } from 'lucide-react';
import { TravelIncident } from '../types';
import { apiFetch } from '../api';

interface SearchOverlayProps {
  isDarkMode: boolean;
  incidents: TravelIncident[];
  onSelectLocation: (incident: TravelIncident) => void;
  onAskAI: (topic: string) => void;
  onSelectItem?: (incident: TravelIncident) => void;
  mapSelectionContext?: string;
  onClearContext?: () => void;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ 
  isDarkMode, 
  incidents, 
  onSelectLocation, 
  onAskAI, 
  onSelectItem, 
  mapSelectionContext, 
  onClearContext 
}) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<TravelIncident[]>([]);
  const [showResults, setShowResults] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showResults) return;
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showResults]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length > 1) {
        try {
          const result = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}&limit=8`);
          if (result.success && result.data.length > 0) {
            setResults(result.data);
            setShowResults(true);
            return;
          }
        } catch (err) {}

        const lowerQuery = query.toLowerCase();
        const hits = incidents.filter(i => {
          const titleMatch = i.title?.toLowerCase().includes(lowerQuery);
          const descMatch = i.description?.toLowerCase().includes(lowerQuery);
          const locationMatch = i.location?.toLowerCase().includes(lowerQuery);
          const nameMatch = i.name?.toLowerCase().includes(lowerQuery);
          return titleMatch || descMatch || locationMatch || nameMatch;
        });
        
        if (hits.length > 0) {
          setResults(hits.slice(0, 8));
          setShowResults(true);
        } else {
          setResults([]);
          setShowResults(true);
        }
      } else if (query.trim().length === 0) {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

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

  return (
    <>
      <div className="absolute inset-0 z-[999] pointer-events-none">
      <div ref={cardRef} className="pointer-events-auto absolute top-20 left-4 right-4 z-[1000]">
        {/* Search Input */}
        <div className="relative">
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl p-3 rounded-[1.5rem] shadow-[0_12px_32px_rgba(27,51,85,0.08)] border border-white/40">
            <Search className="w-5 h-5 text-primary flex-shrink-0 ml-1" />
            <input 
              value={mapSelectionContext || query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none focus:ring-0 w-full font-headline font-bold text-on-surface placeholder:text-on-surface-variant/50 text-sm outline-none"
              placeholder={isListening ? "Listening..." : "Where are you heading?"}
            />

            {/* Mic Button */}
            <button 
              onClick={handleMicClick}
              className={`p-2 rounded-full transition-all flex-shrink-0 ${isListening ? 'bg-error text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            >
              {isListening ? (
                <div className="flex gap-0.5 items-end h-4">
                  <div className="w-0.5 bg-white rounded-full h-2 animate-pulse"></div>
                  <div className="w-0.5 bg-white rounded-full h-4 animate-pulse"></div>
                  <div className="w-0.5 bg-white rounded-full h-3 animate-pulse"></div>
                </div>
              ) : (
                <Mic size={18} />
              )}
            </button>

            {/* AI Button */}
            <button 
              onClick={() => onAskAI("General road conditions")} 
              className="p-2 bg-gradient-to-br from-primary to-tertiary text-white rounded-full shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-90 flex-shrink-0"
            >
              <Sparkles size={18} />
            </button>
          </div>
        </div>

        {/* Results Dropdown */}
        {showResults && (
          <div className="mt-2 bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-[0_12px_32px_rgba(27,51,85,0.1)] border border-white/40 max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-on-surface-variant font-body">No results found for "{query}"</div>
            ) : (
              results.map(r => (
                <div 
                  key={r.id} 
                  className="p-3 border-b border-outline/5 last:border-b-0 hover:bg-primary/5 cursor-pointer flex items-center justify-between group"
                  onClick={() => {
                    onSelectLocation(r);
                    if (onSelectItem) onSelectItem(r);
                    setShowResults(false);
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-bold text-on-surface font-headline">
                        {r.type === 'road' ? '🛣️' : r.type === 'location' ? '📍' : r.type === 'weather' ? '🌦️' : r.type === 'traffic' ? '🚥' : '✨'}
                        {r.name}
                      </h4>
                      {r.source === 'local' ? (
                        <span className="text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-tighter">Official</span>
                      ) : r.source === 'osm' || r.source === 'tomtom' ? (
                        <span className="text-[8px] px-1.5 py-0.5 bg-tertiary/10 text-tertiary rounded-full font-bold uppercase tracking-tighter">Community</span>
                      ) : null}
                    </div>
                    <p className={`text-[11px] font-medium leading-tight text-on-surface-variant font-body ${r.subtitle?.includes('❌') ? 'text-error' : r.subtitle?.includes('⚠️') ? 'text-amber-600' : ''}`}>
                      {r.subtitle}
                    </p>
                  </div>
                  <Navigation className="w-4 h-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default SearchOverlay;
