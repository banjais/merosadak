import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { TravelIncident } from '../types';

interface MonsoonRiskOverlayProps {
  incidents: TravelIncident[];
}

export const MonsoonRiskOverlay: React.FC<MonsoonRiskOverlayProps> = ({ incidents }) => {
  const monsoonIncidents = incidents.filter(i => i.type === 'MONSOON');

  if (monsoonIncidents.length === 0) return null;

  return (
    <>
      {monsoonIncidents.map(i => {
        const isExtreme = i.title.includes('EXTREME');
        const isHigh = i.title.includes('HIGH');
        const color = isExtreme ? '#ef4444' : isHigh ? '#f97316' : '#eab308';
        
        return (
          <React.Fragment key={i.id}>
            {/* Pulsing ring for high risk */}
            {(isExtreme || isHigh) && (
              <Circle
                center={[i.lat, i.lng]}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.1,
                  color: color,
                  weight: 1,
                  dashArray: '5, 10'
                }}
                radius={2000}
              />
            )}
            
            <Marker 
              position={[i.lat, i.lng]} 
              icon={L.divIcon({
                className: 'monsoon-risk-icon',
                html: `
                  <div class="relative flex items-center justify-center">
                    <div class="absolute w-8 h-8 rounded-full bg-${isExtreme ? 'red' : 'orange'}-500 opacity-20 animate-ping"></div>
                    <div class="z-10 bg-white dark:bg-slate-900 border-2 border-${isExtreme ? 'red' : 'orange'}-500 rounded-full p-1.5 shadow-lg">
                      <span class="text-xs">⛈️</span>
                    </div>
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-red-600 mb-1">{i.title}</h4>
                  <p className="text-xs leading-tight opacity-80">{i.description}</p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};
