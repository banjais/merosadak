// src/components/ContextualInfoCards.tsx
// Shows weather, traffic, POIs for selected destination

import React from 'react';
import { CloudRain, Car, Fuel, UtensilsCrossed, Hospital, AlertTriangle } from 'lucide-react';

interface ContextualInfoCardsProps {
  destination: { name: string; lat: number; lng: number };
  weather?: any;
  traffic?: any;
  pois?: any[];
  monsoonRisk?: string;
}

export const ContextualInfoCards: React.FC<ContextualInfoCardsProps> = ({
  destination,
  weather,
  traffic,
  pois = [],
  monsoonRisk
}) => {
  // Group POIs by category
  const groupedPOIs = pois.reduce((acc: any, poi: any) => {
    const category = categorizePOI(poi.type);
    if (!acc[category]) acc[category] = [];
    acc[category].push(poi);
    return acc;
  }, {});

  return (
    <div className="p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-slate-700">
      {/* Destination Header */}
      <div className="mb-4">
        <h3 className="font-bold text-lg dark:text-white">{destination.name}</h3>
        {monsoonRisk && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold mt-1 ${
            monsoonRisk === 'EXTREME' ? 'bg-red-100 text-red-700' :
            monsoonRisk === 'HIGH' ? 'bg-orange-100 text-orange-700' :
            monsoonRisk === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            <AlertTriangle size={12} />
            Monsoon Risk: {monsoonRisk}
          </div>
        )}
      </div>

      {/* Horizontal Scroll Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {/* Weather Card */}
        <div className="flex-shrink-0 w-32 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <CloudRain size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Weather</span>
          </div>
          {weather ? (
            <>
              <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{weather.temp}°C</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">{weather.condition}</p>
            </>
          ) : (
            <p className="text-xs text-blue-500">Loading...</p>
          )}
        </div>

        {/* Traffic Card */}
        <div className="flex-shrink-0 w-32 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <Car size={16} className="text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Traffic</span>
          </div>
          {traffic ? (
            <>
              <p className="text-lg font-black text-amber-900 dark:text-amber-100">
                {traffic.status === 'clear' ? '✅ Clear' :
                 traffic.status === 'moderate' ? '⚠️ Moderate' : '🔴 Heavy'}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {traffic.incidents || 0} incident{traffic.incidents !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-amber-500">Loading...</p>
          )}
        </div>

        {/* Fuel Card */}
        {groupedPOIs.fuel && (
          <div className="flex-shrink-0 w-32 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-xs font-bold text-green-700 dark:text-green-300">Fuel</span>
            </div>
            <p className="text-2xl font-black text-green-900 dark:text-green-100">
              {groupedPOIs.fuel.length}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">nearby</p>
          </div>
        )}

        {/* Food Card */}
        {groupedPOIs.food && (
          <div className="flex-shrink-0 w-32 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed size={16} className="text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-bold text-orange-700 dark:text-orange-300">Food</span>
            </div>
            <p className="text-2xl font-black text-orange-900 dark:text-orange-100">
              {groupedPOIs.food.length}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">nearby</p>
          </div>
        )}

        {/* Hospital Card */}
        {groupedPOIs.hospital && (
          <div className="flex-shrink-0 w-32 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <Hospital size={16} className="text-red-600 dark:text-red-400" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">Hospital</span>
            </div>
            <p className="text-2xl font-black text-red-900 dark:text-red-100">
              {groupedPOIs.hospital.length}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">nearby</p>
          </div>
        )}
      </div>

      {/* POI Lists (Expandable) */}
      {Object.keys(groupedPOIs).length > 0 && (
        <div className="mt-4 space-y-3">
          {Object.entries(groupedPOIs).map(([category, poisList]: [string, any]) => (
            <div key={category} className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {getCategoryIcon(category)} {category} ({poisList.length})
              </h4>
              <div className="space-y-2">
                {poisList.slice(0, 3).map((poi: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">•</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{poi.name}</p>
                      {poi.distance && (
                        <p className="text-gray-500 dark:text-gray-400">{poi.distance.toFixed(1)} km away</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function categorizePOI(type?: string): string {
  if (!type) return 'other';
  const t = type.toLowerCase();
  if (t.includes('fuel') || t.includes('petrol') || t.includes('gas')) return 'fuel';
  if (t.includes('food') || t.includes('restaurant') || t.includes('hotel')) return 'food';
  if (t.includes('hospital') || t.includes('medical') || t.includes('health')) return 'hospital';
  if (t.includes('police')) return 'police';
  if (t.includes('tourist') || t.includes('attraction')) return 'tourist';
  return 'other';
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'fuel': return '⛽';
    case 'food': return '🍽️';
    case 'hospital': return '🏥';
    case 'police': return '🚔';
    case 'tourist': return '📸';
    default: return '📍';
  }
}
