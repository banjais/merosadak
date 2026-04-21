// src/components/SmartSearchResult.tsx
// Displays search results based on detected intent

import React from 'react';
import { X, Navigation, CloudRain, Car, Fuel, MapPin, Route } from 'lucide-react';
import { IntentResult, getIntentDescription, getIntentIcon } from '../services/searchIntent';
import { SearchResult } from '../services/enhancedSearchService';
import { useSettings } from '../SettingsContext';

interface SmartSearchResultProps {
  intent: IntentResult;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
}

export const SmartSearchResult: React.FC<SmartSearchResultProps> = ({ // isDarkMode is now from context
  intent,
  results,
  onSelect,
  onClose,
  userLocation
}) => {
  const { isDarkMode } = useSettings();
  // Group results by type
  const places = results.filter(r => r.type === 'place');
  const highways = results.filter(r => r.type === 'highway');
  const pois = results.filter(r => r.type === 'poi' || r.type === 'traffic');
  const recents = results.filter(r => r.type === 'recent');

  const hasResults = places.length > 0 || highways.length > 0 || pois.length > 0;

  return (
    <div className={`mt-2 rounded-xl shadow-2xl border backdrop-blur-xl overflow-hidden max-h-96 overflow-y-auto transition-colors duration-300 ${isDarkMode
        ? 'bg-slate-900/95 border-slate-700/50'
        : 'bg-white/95 border-white/50'
      }`}>
      {/* Intent Header */}
      <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getIntentIcon(intent)}</span>
            <div>
              <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {getIntentDescription(intent)}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Highway Results */}
      {highways.length > 0 && (
        <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            🛣️ Highways
          </h4>
          <div className="space-y-2">
            {highways.map((result) => (
              <button
                key={`highway-${result.id}`}
                onClick={() => onSelect(result)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Route size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
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
                <Navigation size={16} className="text-blue-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Place Results */}
      {places.length > 0 && (
        <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            📍 Places
          </h4>
          <div className="space-y-2">
            {places.map((result) => (
              <button
                key={`place-${result.id}`}
                onClick={() => onSelect(result)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <MapPin size={18} className="text-green-600 dark:text-green-400" />
                </div>
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
                        {result.distance.toFixed(0)} km
                      </span>
                    )}
                  </div>
                </div>
                <Navigation size={16} className="text-green-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POI / Traffic Results */}
      {pois.length > 0 && (
        <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h4 className={`text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {intent.intent === 'traffic' ? '🚦 Traffic' : '📍 Points of Interest'}
          </h4>
          <div className="space-y-2">
            {pois.map((result) => (
              <button
                key={`poi-${result.id}`}
                onClick={() => onSelect(result)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                  }`}
              >
                <div className={`p-2 rounded-lg ${result.type === 'traffic'
                    ? 'bg-red-100 dark:bg-red-900/20'
                    : 'bg-amber-100 dark:bg-amber-900/20'
                  }`}>
                  {result.type === 'traffic' ? (
                    <Car size={18} className="text-red-600 dark:text-red-400" />
                  ) : (
                    <Fuel size={18} className="text-amber-600 dark:text-amber-400" />
                  )}
                </div>
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
                {result.distance && (
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {result.distance.toFixed(1)} km
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!hasResults && (
        <div className="p-6 text-center">
          <div className="text-4xl mb-2">🔍</div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No results found for "{intent.originalQuery}"
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Try searching for a place, highway, or POI
          </p>
        </div>
      )}
    </div>
  );
};
