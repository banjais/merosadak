import React, { useState, useMemo } from 'react';
import {
  Plus,
  X,
  CloudRain,
  AlertTriangle,
  Fuel,
  ChefHat,
  Stethoscope,
  Ruler,
  TrafficCone as TrafficIcon,
  ShieldBan,
  Megaphone,
} from 'lucide-react';
import { TravelIncident, IncidentType } from '../types';

interface FloatingMenuProps {
  onServiceSelect: (service: string) => void;
  onOpenCalculator: () => void;
  onOpenReport?: () => void;
  onTogglePilot?: () => void; // Driver mode toggle
  activeService: string | null;
  incidents?: TravelIncident[];
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ 
  onServiceSelect, 
  onOpenCalculator, 
  onOpenReport,
  onTogglePilot,
  activeService, 
  incidents = [] 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const serviceStats = useMemo(() => {
    const roadIncidents = (incidents || []).filter(i => {
      const s = (i.status || i.type || '').toLowerCase();
      return s.includes('block') || s.includes('one') || s.includes('resum');
    });

    const fuelStations = (incidents || []).filter(i => i.type === IncidentType.POI && (i.title?.toLowerCase().includes('fuel') || i.description?.toLowerCase().includes('fuel'))).length;
    const medicalFacilities = (incidents || []).filter(i => i.type === IncidentType.POI && (i.title?.toLowerCase().includes('hospital') || i.title?.toLowerCase().includes('medical') || i.description?.toLowerCase().includes('health'))).length;
    const trafficIncidents = (incidents || []).filter(i => i.type === IncidentType.TRAFFIC).length;
    const weatherAlerts = (incidents || []).filter(i => i.type === IncidentType.MONSOON || i.type === IncidentType.WEATHER).length;

    return {
      roads: {
        blocked: roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('block')).length,
        total: roadIncidents.length,
      },
      fuel: fuelStations,
      medical: medicalFacilities,
      traffic: trafficIncidents,
      weather: weatherAlerts,
    };
  }, [incidents]);

  const services = [
    { id: 'fuel', icon: <Fuel size={20} />, label: 'Fuel', color: 'bg-primary', count: serviceStats.fuel },
    { id: 'food', icon: <ChefHat size={20} />, label: 'Food', color: 'bg-secondary', count: 0 },
    { id: 'hospital', icon: <Stethoscope size={20} />, label: 'Medical', color: 'bg-error', count: serviceStats.medical },
    { id: 'traffic', icon: <TrafficIcon size={20} />, label: 'Traffic', color: 'bg-primary', count: serviceStats.traffic },
    { id: 'monsoon', icon: <CloudRain size={20} />, label: 'Weather', color: 'bg-tertiary', count: serviceStats.weather },
    { id: 'roads', icon: <AlertTriangle size={20} />, label: 'Roads', color: 'bg-amber-500', count: serviceStats.roads.blocked },
  ];

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleServiceClick = (serviceId: string) => {
    onServiceSelect(activeService === serviceId ? null : serviceId);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 lg:bottom-10 lg:right-40 z-[2000] flex flex-row-reverse items-end gap-2 pointer-events-none">
      
      {/* Main FAB Button */}
      <div className="pointer-events-auto flex-shrink-0">
        <button
          onClick={handleToggle}
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-primary to-tertiary text-white shadow-[0_8px_25px_rgba(0,98,162,0.35)] flex items-center justify-center active:scale-90 transition-all duration-300 ${isOpen ? 'rotate-45' : ''}`}
        >
          {isOpen ? <X size={20} className="md:w-6 md:h-6" /> : <Plus size={20} className="md:w-6 md:h-6" />}
        </button>
      </div>

      {/* Expanded Services — right to left at the bottom, scrollable on mobile */}
      <div className={`pointer-events-auto flex flex-row-reverse items-end gap-1.5 md:gap-2 transition-all duration-300 overflow-x-auto max-w-[calc(100vw-5rem)] md:max-w-none pb-1 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
        {services.map((s, i) => {
          const isActive = activeService === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleServiceClick(s.id)}
              className={`relative flex flex-col items-center gap-0.5 md:gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-xl transition-all flex-shrink-0 ${
                isActive
                  ? `${s.color} text-white shadow-lg scale-105 md:scale-110`
                  : 'bg-white/80 backdrop-blur-xl border border-white/40 text-on-surface-variant hover:bg-primary/10 hover:text-primary'
              }`}
              title={s.label}
              style={{ transitionDelay: isOpen ? `${i * 30}ms` : '0ms' }}
            >
              {s.icon}
              <span className="text-[7px] md:text-[8px] font-bold uppercase font-label whitespace-nowrap">{s.label}</span>
              {/* Service count badge */}
              {s.count > 0 && (
                <span className={`absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 w-4 h-4 md:w-5 md:h-5 ${s.id === 'roads' ? 'bg-error' : 'bg-primary'} text-white text-[6px] md:text-[8px] font-black rounded-full flex items-center justify-center shadow-md ${s.id === 'roads' ? 'animate-pulse' : ''}`}>
                  {s.count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => { onOpenReport?.(); setIsOpen(false); }}
          className="flex flex-col items-center gap-0.5 md:gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-xl transition-all bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg flex-shrink-0"
          title="Report Incident"
        >
          <Megaphone size={16} className="md:w-5 md:h-5" />
          <span className="text-[7px] md:text-[8px] font-bold uppercase font-label whitespace-nowrap">Report</span>
        </button>

        <div className="w-px h-6 md:h-8 bg-outline/15 mx-0.5 flex-shrink-0" />

        <button
          onClick={() => { onOpenCalculator(); setIsOpen(false); }}
          className="flex flex-col items-center gap-0.5 md:gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-xl transition-all bg-white/80 backdrop-blur-xl border border-white/40 text-on-surface-variant hover:bg-primary/10 hover:text-primary flex-shrink-0"
          title="Measure Distance"
        >
          <Ruler size={16} className="md:w-5 md:h-5" />
          <span className="text-[7px] md:text-[8px] font-bold uppercase font-label whitespace-nowrap">Measure</span>
        </button>

        {onTogglePilot && (
          <button
            onClick={() => { onTogglePilot?.(); setIsOpen(false); }}
            className="flex flex-col items-center gap-0.5 md:gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-xl transition-all bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-500/30 flex-shrink-0 animate-pulse"
            title="Driver Mode"
          >
            <Navigation size={16} className="md:w-5 md:h-5" />
            <span className="text-[7px] md:text-[8px] font-bold uppercase font-label whitespace-nowrap">Pilot</span>
          </button>
        )}
      </div>
    </div>
  );
};
