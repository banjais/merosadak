// src/components/MonsoonRiskOverlay.tsx
import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { L } from '../lib/leaflet';
import { useWeatherMonsoon } from '../WeatherMonsoonContext';
import { useSettings } from '../SettingsContext';

interface MonsoonRiskOverlayProps {
  isDarkMode?: boolean;
}

export const MonsoonRiskOverlay: React.FC<MonsoonRiskOverlayProps> = ({ isDarkMode = false }) => {
  const { monsoonIncidents: incidents, loadingMonsoon, errorMonsoon } = useWeatherMonsoon();
  const { isDarkMode: settingsDarkMode } = useSettings(); // Use settings dark mode if prop not provided
  // Filter only monsoon-related incidents with coordinates
  const monsoonIncidents = (incidents || []).filter(i =>
    (i.type?.toUpperCase().includes('MONSOON') ||
      i.title?.toUpperCase().includes('MONSOON') ||
      i.title?.toUpperCase().includes('RAIN') ||
      i.title?.toUpperCase().includes('FLOOD') ||
      i.title?.toUpperCase().includes('LANDSLIDE')) &&
    i.lat !== undefined && i.lng !== undefined
  );

  if (monsoonIncidents.length === 0) return null;

  return (
    <>
      {monsoonIncidents.map((i) => {
        const isExtreme = i.title?.toUpperCase().includes('EXTREME') || i.severity === 'high';
        const isHigh = i.title?.toUpperCase().includes('HIGH') || i.severity === 'medium';
        const color = isExtreme ? '#ef4444' : isHigh ? '#f97316' : '#eab308';

        return (
          <React.Fragment key={i.id}>
            {/* Pulsing risk circle */}
            {(isExtreme || isHigh) && (
              <Circle
                center={[i.lat!, i.lng!]}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.12,
                  color: color,
                  weight: 2,
                  dashArray: '4, 8',
                }}
                radius={isExtreme ? 3500 : 2200}
              />
            )}

            {/* Custom Monsoon Marker */}
            <Marker
              position={[i.lat!, i.lng!]}
              icon={L.divIcon({
                className: 'monsoon-risk-icon',
                html: `
                  <div class="relative flex items-center justify-center w-10 h-10">
                    <div class="absolute w-10 h-10 rounded-full bg-${isExtreme ? 'red' : 'orange'}-500 opacity-30 animate-ping"></div>
                    <div class="z-10 bg-white dark:bg-slate-900 border-4 border-${isExtreme ? 'red' : 'orange'}-500 rounded-full p-2 shadow-xl flex items-center justify-center text-xl">
                      ⛈️
                    </div>
                  </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup>
                <div className="p-2 max-w-[260px]">
                  <h4 className="font-bold text-lg text-red-600 mb-1 flex items-center gap-2">
                    ⛈️ {i.title}
                  </h4>
                  <p className="text-sm leading-tight text-slate-700 dark:text-slate-300">
                    {i.description}
                  </p>
                  {i.incidentDistrict && (
                    <p className="text-xs mt-2 text-slate-500">
                      District: <strong>{i.incidentDistrict}</strong>
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};