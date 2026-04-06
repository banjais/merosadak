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
import { TravelIncident } from '../types';

interface FloatingMenuProps {
  onServiceSelect: (service: string) => void;
  onOpenCalculator: () => void;
  onOpenReport?: () => void;
  activeService: string | null;
  incidents?: TravelIncident[];
}

const services = [
  { id: 'fuel', icon: <Fuel size={20} />, label: 'Fuel', color: 'bg-primary', count: serviceStats.fuel },
  { id: 'food', icon: <ChefHat size={20} />, label: 'Food', color: 'bg-secondary', count: 0 },
  { id: 'hospital', icon: <Stethoscope size={20} />, label: 'Medical', color: 'bg-error', count: serviceStats.medical },
  { id: 'traffic', icon: <TrafficIcon size={20} />, label: 'Traffic', color: 'bg-primary', count: serviceStats.traffic },
  { id: 'monsoon', icon: <CloudRain size={20} />, label: 'Weather', color: 'bg-tertiary', count: serviceStats.weather },
  { id: 'roads', icon: <AlertTriangle size={20} />, label: 'Roads', color: 'bg-amber-500', count: serviceStats.roads.blocked },
];

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ 
  onServiceSelect, 
  onOpenCalculator, 
  onOpenReport,
  activeService, 
  incidents = [] 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const serviceStats = useMemo(() => {
    const roadIncidents = (incidents || []).filter(i => {
      const s = (i.status || i.type || '').toLowerCase();
      return s.includes('block') || s.includes('one') || s.includes('resum');
    });

    const fuelStations = (incidents || []).filter(i => i.type?.toLowerCase().includes('fuel') || i.title?.toLowerCase().includes('fuel')).length;
    const medicalFacilities = (incidents || []).filter(i => i.type?.toLowerCase().includes('medical') || i.title?.toLowerCase().includes('hospital')).length;
    const trafficIncidents = (incidents || []).filter(i => i.type?.toLowerCase().includes('traffic') || i.title?.toLowerCase().includes('traffic')).length;
    const weatherAlerts = (incidents || []).filter(i => i.type?.toLowerCase().includes('weather') || i.type?.toLowerCase().includes('monsoon')).length;

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

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleServiceClick = (serviceId: string) => {
    onServiceSelect(activeService === serviceId ? null : serviceId);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-10 md:right-40 z-[2000] flex flex-row-reverse items-center gap-2 pointer-events-none">
      
      {/* Main FAB Button */}
      <div className="pointer-events-auto">
        <button
          onClick={handleToggle}
          className={`w-14 h-14 rounded-full bg-gradient-to-br from-primary to-tertiary text-white shadow-[0_8px_25px_rgba(0,98,162,0.35)] flex items-center justify-center active:scale-90 transition-all duration-300 ${isOpen ? 'rotate-45' : ''}`}
        >
          {isOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      {/* Expanded Services — right to left at the bottom */}
      <div className={`pointer-events-auto flex flex-row-reverse items-center gap-2 transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
        {services.map((s, i) => {
          const isActive = activeService === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleServiceClick(s.id)}
              className={`relative flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all ${
                isActive
                  ? `${s.color} text-white shadow-lg scale-110`
                  : 'bg-white/80 backdrop-blur-xl border border-white/40 text-on-surface-variant hover:bg-primary/10 hover:text-primary'
              }`}
              title={s.label}
              style={{ transitionDelay: isOpen ? `${i * 30}ms` : '0ms' }}
            >
              {s.icon}
              <span className="text-[8px] font-bold uppercase font-label">{s.label}</span>
              {/* Service count badge */}
              {s.count > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 ${s.id === 'roads' ? 'bg-error' : 'bg-primary'} text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-md ${s.id === 'roads' ? 'animate-pulse' : ''}`}>
                  {s.count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => { onOpenReport?.(); setIsOpen(false); }}
          className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg"
          title="Report Incident"
        >
          <Megaphone size={20} />
          <span className="text-[8px] font-bold uppercase font-label">Report</span>
        </button>

        <div className="w-px h-8 bg-outline/15 mx-0.5" />

        <button
          onClick={() => { onOpenCalculator(); setIsOpen(false); }}
          className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all bg-white/80 backdrop-blur-xl border border-white/40 text-on-surface-variant hover:bg-primary/10 hover:text-primary"
          title="Measure Distance"
        >
          <Ruler size={20} />
          <span className="text-[8px] font-bold uppercase font-label">Measure</span>
        </button>
      </div>
    </div>
  );
};
