// src/components/POIOverlay.tsx
// Renders POI markers on the map based on selected category

import React, { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { L } from '../lib/leaflet';
import { EnhancedPOI, POICategory, UserPOIPreferences, TripContext } from '../types/poi';
import { searchEnhancedPOIs, getCategoryColorClass } from '../services/enhancedPOIService';

interface POIOverlayProps {
  category: POICategory | null;
  userLocation: { lat: number; lng: number } | null;
  mapCenter: [number, number];
  mapZoom: number;
  userPreferences: UserPOIPreferences;
  onSelectPOI?: (poi: EnhancedPOI) => void;
}

export const POIOverlay: React.FC<POIOverlayProps> = ({
  category,
  userLocation,
  mapCenter,
  mapZoom,
  userPreferences,
  onSelectPOI
}) => {
  const [pois, setPOIs] = useState<EnhancedPOI[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category || !userLocation) {
      setPOIs([]);
      return;
    }

    const fetchPOIs = async () => {
      setLoading(true);
      try {
        const context: TripContext = {
          timeOfDay: getTimeOfDay(),
          weather: 'clear',
          tripDuration: 0,
          distanceTraveled: 0,
          isHighway: false,
          hasChildren: false,
          hasElderly: false
        };

        const grouped = await searchEnhancedPOIs(
          category,
          userLocation,
          userPreferences,
          context,
          20
        );

        const categoryPOIs = grouped[category] || [];
        setPOIs(categoryPOIs.slice(0, 15)); // Limit to 15 markers for performance
      } catch (err) {
        console.error('[POIOverlay] Failed to fetch POIs:', err);
        setPOIs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPOIs();
  }, [category, userLocation, mapCenter, mapZoom, userPreferences]);

  if (!category || pois.length === 0) {
    return null;
  }

  return (
    <>
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={createPOIIcon(poi, category)}
          eventHandlers={{
            click: () => {
              if (onSelectPOI) {
                onSelectPOI(poi);
              }
            }
          }}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h4 className="font-bold text-sm mb-1">
                {poi.icon} {poi.name}
              </h4>
              {poi.address && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  📍 {poi.address}
                </p>
              )}
              {poi.distance && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">
                  {poi.distance.toFixed(1)} km away
                </p>
              )}
              {poi.rating && (
                <p className="text-xs text-amber-600 mb-1">
                  {'⭐'.repeat(Math.round(poi.rating))} {poi.rating.toFixed(1)}
                </p>
              )}
              {poi.isOpen !== undefined && (
                <p className={`text-xs font-bold mb-1 ${poi.isOpen ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {poi.isOpen ? '✅ Open Now' : '❌ Closed'}
                </p>
              )}
              {poi.description && (
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  {poi.description}
                </p>
              )}
              {poi.phone && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  📞 {poi.phone}
                </p>
              )}
              {poi.isAccessible && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
                  ♿ Wheelchair Accessible
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

// Create custom POI icon
function createPOIIcon(poi: EnhancedPOI, category: POICategory): L.DivIcon {
  const categoryInfo = POI_CATEGORIES.find(c => c.id === category);
  const icon = categoryInfo?.icon || '📍';

  return L.divIcon({
    className: 'custom-poi-marker',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center text-xl border-2 border-gray-200 dark:border-slate-700">
          ${icon}
        </div>
        ${poi.score > 150 ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>' : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
}

// Get time of day
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// Import POI_CATEGORIES for icon lookup
import { POI_CATEGORIES } from '../types/poi';
