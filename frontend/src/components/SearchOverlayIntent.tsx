// src/components/SearchOverlayIntent.tsx
// Intent-aware search overlay with smart result display

import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, X } from 'lucide-react';
import { TravelIncident } from '../types';
import { debouncedSearch, GroupedSearchResults, SearchResult } from '../services/enhancedSearchService';
import { detectSearchIntent, IntentResult } from '../services/searchIntent';
import { SmartSearchResult } from './SmartSearchResult';

interface SearchOverlayIntentProps {
  isDarkMode: boolean;
  userLocation: { lat: number; lng: number } | null;
  onSelectDestination: (result: SearchResult) => void;
  onAskAI: (query: string) => void;
  onIntentChange?: (intent: IntentResult) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const SearchOverlayIntent: React.FC<SearchOverlayIntentProps> = ({
  isDarkMode,
  userLocation,
  onSelectDestination,
  onAskAI,
  onIntentChange,
  onFocusChange
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupedSearchResults>({
    places: [],
    highways: [],
    pois: [],
    recents: []
  });
  const [currentIntent, setCurrentIntent] = useState<IntentResult>({
    intent: 'mixed',
    originalQuery: ''
  });
  const [showResults, setShowResults] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Debounced search with intent detection
  useEffect(() => {
    debouncedSearch(query, userLocation, 10, (groupedResults, intent) => {
      setResults(groupedResults);
      setCurrentIntent(intent);
      setShowResults(true);
      if (onIntentChange) {
        onIntentChange(intent);
      }
    });
  }, [query, userLocation, onIntentChange]);

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
    setShowResults(false);
    onSelectDestination(result);

    // Save to recents
    const { saveRecentSearch } = require('../services/enhancedSearchService');
    saveRecentSearch(result);
  };

  const handleFocus = () => {
    if (onFocusChange) onFocusChange(true);
    if (query.length >= 2) setShowResults(true);
  };

  const handleBlur = () => {
    // Timeout to allow click events on results before hiding
    setTimeout(() => {
      if (onFocusChange) onFocusChange(false);
    }, 200);
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
    <div ref={cardRef} className="relative w-full max-w-2xl z-[500]">
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search place, highway, weather, traffic..."
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

      {/* Smart Results */}
      {showResults && (query.length >= 2 || hasResults) && (
        <SmartSearchResult
          isDarkMode={isDarkMode}
          intent={currentIntent}
          results={[...results.places, ...results.highways, ...results.pois]}
          onSelect={handleSelect}
          onClose={() => setShowResults(false)}
          userLocation={userLocation}
        />
      )}
    </div>
  );
};
