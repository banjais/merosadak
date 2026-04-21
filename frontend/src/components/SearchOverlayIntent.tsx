import React, { useState, useEffect } from 'react';
import { Search, Mic, X, MapPin, Navigation, History, Sparkles, Wand2, Database, LayoutGrid, AlertTriangle, ChefHat, Fuel, Stethoscope, Gauge, ArrowRight, Camera } from 'lucide-react';
import { useToast } from '../ToastContext';
import { useSettings } from '../SettingsContext';
import { PopularSearches } from '../PopularSearches';
import { getSearchSuggestions } from '../services/geminiService';

interface SearchOverlayIntentProps {
  isDarkMode: boolean;
  isHighContrast?: boolean;
  lang?: string;
  userLocation: { lat: number; lng: number } | null;
  onSelectDestination: (result: any) => void;
  onAskAI: (text: string) => void;
  onFocusChange: (active: boolean) => void;
  initialQuery?: string;
  searchRadius: number;
  onRadiusChange: (radius: number) => void;
  onResultsUpdate?: (results: any[]) => void;
  isPredictionMode?: boolean;
  onTogglePrediction?: () => void;
}

const VoiceWaveform = () => (
  <div className="flex items-center gap-0.5 px-1 h-5">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="w-1 bg-primary rounded-full animate-pulse"
        style={{
          height: `${[40, 100, 60, 80, 50][i]}%`,
          animationDelay: `${i * 0.1}s`,
        }}
      />
    ))}
  </div>
);

export const SearchOverlayIntent: React.FC<SearchOverlayIntentProps> = ({
  isDarkMode,
  userLocation,
  onSelectDestination,
  onAskAI,
  onFocusChange,
  initialQuery = '',
  searchRadius,
  onRadiusChange,
  onResultsUpdate,
  isPredictionMode,
  onTogglePrediction
}) => {
  const { isHighContrast } = useSettings();
  const { info, success, error } = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ai' | 'db'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>(JSON.parse(localStorage.getItem('merosadak_recent_searches') || '[]'));

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setIsActive(true);
      onFocusChange(true);
    }
  }, [initialQuery, onFocusChange]);

  // 🚨 Emergency Intent Detection: Auto-toggles scope for critical keywords
  useEffect(() => {
    const emergencyTerms = ['emergency', 'sos', 'hospital', 'ambulance', 'police', 'accident', 'fire', 'rescue'];
    const lowerQuery = query.toLowerCase();

    if (emergencyTerms.some(term => lowerQuery.includes(term))) {
      // If radius is too low, auto-expand to find critical infrastructure
      if (searchRadius < 50) {
        onRadiusChange(150); // Set to Regional scope
        info("Emergency intent detected: Expanding search scope to find nearest assistance.");
      }
      // Force DB mode for official infrastructure
      setFilterMode('db');
    }
  }, [query, onRadiusChange, searchRadius]);

  // Real-time AI Query Completions
  useEffect(() => {
    if (query.length < 3) {
      setAiSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAiLoading(true);
      const suggestions = await getSearchSuggestions(
        query,
        userLocation || { lat: 27.7172, lng: 85.3240 }
      );
      setAiSuggestions(suggestions);
      setIsAiLoading(false);
    }, 600); // Debounce to prevent API flooding

    return () => clearTimeout(timer);
  }, [query, userLocation]);

  const handleSearchFocus = () => {
    setIsActive(true);
    onFocusChange(true);
  };

  const handleClose = () => {
    setIsActive(false);
    onFocusChange(false);
    setQuery('');
    setCategoryFilter(null);
    onResultsUpdate?.([]);
  };

  const handleSelect = (term: string) => {
    setQuery(term);
    // Logic for actual search execution would go here
    const newRecents = [term, ...recents.filter(r => r !== term)].slice(0, 5);
    setRecents(newRecents);
    localStorage.setItem('merosadak_recent_searches', JSON.stringify(newRecents));
  };

  // Real-time Database Search Results (Filtered by Radius)
  useEffect(() => {
    if (!query || query.length < 2 || filterMode === 'ai') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsDbLoading(true);
      if (!userLocation) return;

      const emergencyTerms = ['emergency', 'sos', 'hospital', 'ambulance', 'police', 'accident', 'fire', 'rescue'];
      const isEmergency = emergencyTerms.some(term => query.toLowerCase().includes(term));

      // Simulate a real-time database lookup with radius constraints
      let mockMatches = [
        { id: '1', name: `${query} Central`, type: 'place', distance: searchRadius * 0.15, lat: userLocation.lat + 0.012, lng: userLocation.lng + 0.008, trafficHistory: [15, 30, 60, 95, 80, 40], status: 'active' },
        { id: '2', name: `NH - ${query} Junction`, type: 'highway', distance: searchRadius * 0.4, lat: userLocation.lat - 0.008, lng: userLocation.lng + 0.015, trafficHistory: [5, 15, 80, 100, 65, 25], status: 'active' },
        { id: '3', name: `${query} Medical Center`, type: 'medical', distance: searchRadius * 0.6, lat: userLocation.lat + 0.020, lng: userLocation.lng - 0.012, trafficHistory: [30, 45, 50, 60, 55, 45], status: 'active' },
        { id: '4', name: `${query} Fuel Stop`, type: 'fuel', distance: searchRadius * 0.9, lat: userLocation.lat - 0.015, lng: userLocation.lng - 0.020, trafficHistory: [40, 70, 85, 95, 85, 75], status: 'inactive' },
      ].filter(item => item.distance <= searchRadius);

      // 🚨 High-Priority Filter: In an emergency, we must only return active service providers
      if (isEmergency) {
        mockMatches = mockMatches.filter(m => m.status === 'active');
      }

      // 🕒 'Open Now' Filter: Excludes inactive POIs when toggled
      if (showOnlyOpen) {
        mockMatches = mockMatches.filter(m => m.status === 'active');
      }

      if (categoryFilter) {
        mockMatches = mockMatches.filter(m => m.type === categoryFilter);
      }

      setSearchResults(mockMatches);
      onResultsUpdate?.(mockMatches);
      setIsDbLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, searchRadius, filterMode, categoryFilter, showOnlyOpen, userLocation, onResultsUpdate]);

  const handleShareSnapshot = () => {
    success("Search snapshot captured. Ready to share mission context.");
  };

  const handleMicClick = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice search is not supported in this browser.");
      return;
    }
    setIsListening(true);
    // In a full implementation, we'd start the SpeechRecognition instance here.
    // For now, we simulate the listening window.
    setTimeout(() => {
      setIsListening(false);
      // Placeholder for final query setting
      // setQuery('Pokhara Highway');
    }, 4000);
  };

  const getSuggestionIconConfig = (type: string) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('highway') || t.includes('road')) return { icon: <AlertTriangle size={16} />, color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (t.includes('food') || t.includes('rest')) return { icon: <ChefHat size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (t.includes('fuel') || t.includes('gas')) return { icon: <Fuel size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' };
    if (t.includes('medical') || t.includes('hospital')) return { icon: <Stethoscope size={16} />, color: 'text-rose-500', bg: 'bg-rose-500/10' };
    return { icon: <MapPin size={16} />, color: 'text-primary', bg: 'bg-primary/10' };
  };

  return (
    <div className={`relative w-full max-w-lg transition-all duration-500 ${isActive ? 'z-[1300]' : ''}`}>
      {/* Backdrop when active */}
      {isActive && (
        <div
          className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[-1]"
          onClick={handleClose}
        />
      )}

      <div className={`
        relative rounded-[2.5rem] transition-all duration-300 shadow-2xl overflow-hidden
        ${isDarkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-white/40'}
        border backdrop-blur-2xl
        ${isActive ? 'scale-105' : 'scale-100'}
      `}>
        <div className="flex items-center px-6 py-4 gap-3">
          <Search className={isDarkMode ? 'text-slate-400' : 'text-slate-400'} size={20} />
          <input
            type="text"
            value={query}
            onFocus={handleSearchFocus}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination, highway or ask AI..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40"
          />
          {isListening ? (
            <div className="flex items-center gap-2 bg-primary/10 rounded-full px-2 py-1 animate-in zoom-in duration-300 ring-4 ring-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.4)] animate-pulse">
              <VoiceWaveform />
              <button onClick={() => setIsListening(false)} className="text-primary hover:text-primary-dim">
                <X size={14} />
              </button>
            </div>
          ) : query ? (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-surface-container-high rounded-full">
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={handleMicClick}
              className="p-1 hover:bg-primary/10 text-primary transition-colors rounded-full group relative"
              title="Voice Search"
            >
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-0 group-active:opacity-100" />
              <Mic size={20} />
            </button>
          )}
        </div>

        {isActive && (
          <div className="p-6 pt-2 border-t border-outline/10 max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 duration-300">
            {/* Search Filter Toggle: Switch between AI and Standard DB results */}
            <div className="flex items-center gap-1.5 mb-6 p-1 rounded-2xl bg-surface-container-low border border-outline/5 transition-colors duration-300">
              {[
                { id: 'all', label: 'All', icon: <LayoutGrid size={12} /> },
                { id: 'ai', label: 'AI Only', icon: <Wand2 size={12} /> },
                { id: 'db', label: 'Standard', icon: <Database size={12} /> }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setFilterMode(filter.id as any)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${filterMode === filter.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                      : 'text-on-surface-variant/40 hover:bg-surface-container-high'
                    }
                  `}
                >
                  {filter.icon}
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

            {/* Active Mode indicator */}
            {filterMode !== 'all' && (
              <div className="px-2 mb-4">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1.5 opacity-50">
                  <Sparkles size={10} /> Mode: {filterMode === 'ai' ? 'Predictive AI Assistant' : 'Official Highway Database'}
                </p>
              </div>
            )}

            {/* Search Radius Slider: Control POI scope */}
            {(filterMode === 'all' || filterMode === 'db') && (
              <div className="mb-8 px-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                    <Gauge size={12} /> Search Scope (Radius)
                  </div>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{searchRadius} KM</span>
                </div>
                <div className="flex gap-1 mb-3">
                  {[
                    { l: 'Local', v: 5 },
                    { l: 'District', v: 45 },
                    { l: 'Regional', v: 150 }
                  ].map(preset => (
                    <button key={preset.l} onClick={() => onRadiusChange(preset.v)} className={`flex-1 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border transition-all ${searchRadius === preset.v ? 'bg-primary text-white border-primary' : 'bg-surface-container-low text-on-surface-variant/40 border-outline/10'}`}>
                      {preset.l}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={searchRadius}
                  onChange={(e) => onRadiusChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-1 px-1">
                  <span className="text-[8px] font-bold text-on-surface-variant/30 uppercase">Local (1km)</span>
                  <span className="text-[8px] font-bold text-on-surface-variant/30 uppercase">Regional (200km)</span>
                </div>
              </div>
            )}

            {/* 🏷️ Category Quick Filters */}
            {(filterMode === 'all' || filterMode === 'db') && query.length >= 2 && (
              <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 animate-in fade-in slide-in-from-left-2 duration-300">
                {[
                  { id: 'fuel', label: 'Fuel', icon: <Fuel size={12} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  { id: 'medical', label: 'Medical', icon: <Stethoscope size={12} />, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                  { id: 'food', label: 'Food', icon: <ChefHat size={12} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { id: 'highway', label: 'Highways', icon: <AlertTriangle size={12} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${categoryFilter === cat.id
                      ? 'bg-primary text-white border-primary shadow-md scale-105'
                      : `${cat.bg} ${cat.color} border-outline/10 hover:border-primary/30`
                      }`}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                ))}
                <div className="w-px h-6 bg-outline/10 mx-1 self-center shrink-0" />
                <button
                  onClick={() => setShowOnlyOpen(!showOnlyOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${showOnlyOpen
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                    : 'bg-surface-container-low text-on-surface-variant/40 border-outline/10 hover:border-emerald-500/30'
                    }`}
                >
                  <Clock size={12} />
                  Open Now
                </button>
              </div>
            )}

            {/* 🔍 Dynamic Search Results (DB Context) */}
            {query.length >= 2 && (filterMode === 'all' || filterMode === 'db') && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                    <Database size={12} /> {categoryFilter ? `${categoryFilter.toUpperCase()} Matches` : 'Database Matches'}
                    {searchResults.length > 0 && (
                      <button
                        onClick={handleShareSnapshot}
                        className="ml-2 p-1 rounded-lg bg-surface-container-high hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all group/snap"
                        title="Share Search Snapshot"
                      >
                        <Camera size={12} className="group-hover/snap:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                  {isDbLoading && (
                    <div className="w-3 h-3 border-2 border-outline/20 border-t-primary rounded-full animate-spin" />
                  )}
                </div>

                {searchResults.length === 0 && !isDbLoading ? (
                  <p className="px-3 py-4 text-[10px] text-on-surface-variant/40 italic text-center rounded-2xl border border-dashed border-outline/10">No matches found within {searchRadius}km</p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((result) => {
                      const config = getSuggestionIconConfig(result.type);
                      return (
                        <button
                          key={result.id}
                          onClick={() => result.status !== 'inactive' && handleSelect(result.name)}
                          className={`flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-surface-container-high transition-all group text-left ${result.status === 'inactive' ? 'opacity-40 grayscale cursor-not-allowed' : ''
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-on-surface truncate">{result.name}</div>
                            <div className="text-[9px] font-bold text-primary uppercase mt-0.5">{result.distance.toFixed(1)} km away</div>
                          </div>
                          <ArrowRight size={14} className="text-on-surface-variant/20 group-hover:text-primary transition-all group-hover:translate-x-1" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AI-Powered Query Completions */}
            {query.length >= 3 && (filterMode === 'all' || filterMode === 'ai') && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                    <Wand2 size={12} className={isAiLoading ? 'animate-pulse' : ''} /> AI Suggestions
                  </div>
                  {isAiLoading && (
                    <div className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  )}
                </div>
                <div className="space-y-1">
                  {aiSuggestions.map((suggestion, i) => {
                    const config = getSuggestionIconConfig(suggestion.type);
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelect(suggestion.query)}
                        className={`flex items-center gap-4 w-full p-3 rounded-2xl transition-all group ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-primary/5'}`}
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${config.bg} ${config.color} transition-transform group-hover:scale-110 shadow-sm`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-xs font-bold text-on-surface group-hover:text-primary truncate transition-colors">{suggestion.query}</div>
                          <div className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest mt-0.5">{suggestion.type || 'place'}</div>
                        </div>
                        <Sparkles size={12} className="text-primary/20 group-hover:text-primary transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standard Results / Popular Categories */}
            {(filterMode === 'all' || filterMode === 'db') && (
              !query && <PopularSearches onSelect={handleSelect} isDarkMode={isDarkMode} />
            )}

            {/* Recent Searches */}
            {(filterMode === 'all' || filterMode === 'db') && recents.length > 0 && !query && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                  <History size={12} /> Recent Searches
                </div>
                <div className="space-y-1">
                  {recents.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(r)}
                      className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-surface-container-high transition-colors group"
                    >
                      <Navigation size={14} className="text-on-surface-variant/20 group-hover:text-primary" />
                      <span className="text-xs font-bold text-on-surface-variant group-hover:text-primary">{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};