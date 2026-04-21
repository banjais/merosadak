// src/components/SearchOverlayEnhanced.tsx
// Enhanced search with debouncing, grouped results, and route selection

import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, X, Navigation, MapPin, Route } from 'lucide-react';
import { useSettings } from '../SettingsContext';
import {
  debouncedSearch,
  saveRecentSearch,
  GroupedSearchResults,
  SearchResult
} from '../services/enhancedSearchService';
import { apiFetch } from '../api';

interface SearchOverlayEnhancedProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectDestination: (result: SearchResult) => void;
  onAskAI: (query: string) => void;
}

export const SearchOverlayEnhanced: React.FC<SearchOverlayEnhancedProps> = ({
  userLocation,
  onSelectDestination,
  onAskAI
}) => {
  const { isDarkMode } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupedSearchResults>({
    places: [],
    highways: [],
    pois: [],
    recents: []
  });
  const [showResults, setShowResults] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    debouncedSearch(query, userLocation, 7, (groupedResults) => {
      setResults(groupedResults);
      setShowResults(true);
    });
  }, [query, userLocation]);

  // Close on outside click
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

  // Handle result selection
  const handleSelect = async (result: SearchResult) => {
    setSelectedResult(result);
    setShowResults(false);
    saveRecentSearch(result);

    // Save to recents
    if (result.type === 'place' || result.type === 'highway') {
      onSelectDestination(result);
    }
  };

  // Voice search
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const hasResults = results.places.length > 0 || results.highways.length > 0 ||
    results.pois.length > 0 || results.recents.length > 0;

  return (
    <div ref={cardRef} className="absolute top-20 left-4 right-4 md:left-8 md:right-8 z-[500]">
      {/* Search Input */}
      <div className={`flex items-center gap-3 p-3 rounded-2xl shadow-xl border backdrop-blur-xl transition-colors duration-300 ${isDarkMode
          ? 'bg-slate-900/90 border-slate-700/50'
          : 'bg-white/90 border-white/50'
        }`}>
        <Search size={20} className="text-gray-400 flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Search place, highway, POI..."
          className={`flex-1 bg-transparent outline-none text-sm ${isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            }`}
        />

        <button
          onClick={startVoiceSearch}
          className={`p-2 rounded-full transition-colors ${isListening
              ? 'bg-red-500 text-white animate-pulse'
              : isDarkMode
                ? 'hover:bg-slate-800 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          title="Voice search"
        >
          <Mic size={18} />
        </button>

        {query && (
          <button
            onClick={() => { setQuery(''); setShowResults(false); }}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && hasResults && (
        <div className={`mt-2 rounded-xl shadow-2xl border backdrop-blur-xl overflow-hidden max-h-96 overflow-y-auto transition-colors duration-300 ${isDarkMode
            ? 'bg-slate-900/95 border-slate-700/50'
            : 'bg-white/95 border-white/50'
          }`}>
          {/* Recent Searches */}
          {results.recents.length > 0 && (
            <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                🕐 Recent
              </h4>
              {results.recents.map((result) => (
                <button
                  key={`recent-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {result.name}
                    </p>
                    {result.subtitle && (
                      <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Places */}
          {results.places.length > 0 && (
            <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                📍 Places ({results.places.length})
              </h4>
              {results.places.map((result) => (
                <button
                  key={`place-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {result.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {result.subtitle && (
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {result.subtitle}
                        </p>
                      )}
                      {result.distance && (
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {result.distance} km
                        </span>
                      )}
                    </div>
                  </div>
                  <Navigation size={16} className="text-blue-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Highways */}
          {results.highways.length > 0 && (
            <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                🛣️ Highways ({results.highways.length})
              </h4>
              {results.highways.map((result) => (
                <button
                  key={`highway-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {result.name}
                    </p>
                    {result.subtitle && (
                      <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <Route size={16} className="text-green-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* POIs */}
          {results.pois.length > 0 && (
            <div className={`p-3 ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                📍 Points of Interest ({results.pois.length})
              </h4>
              {results.pois.map((result) => (
                <button
                  key={`poi-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {result.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {result.subtitle && (
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {result.subtitle}
                        </p>
                      )}
                      {result.distance && (
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {result.distance} km
                        </span>
                      )}
                    </div>
                  </div>
                  <MapPin size={16} className="text-amber-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
