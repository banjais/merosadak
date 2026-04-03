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
} from 'lucide-react';
import { TravelIncident } from '../types';

interface FloatingMenuProps {
  onServiceSelect: (service: string) => void;
  onOpenCalculator: () => void;
  activeService: string | null;
  incidents?: TravelIncident[];
}

const services = [
  { id: 'fuel', icon: <Fuel size={20} />, label: 'Fuel', color: 'bg-primary' },
  { id: 'food', icon: <ChefHat size={20} />, label: 'Food', color: 'bg-secondary' },
  { id: 'hospital', icon: <Stethoscope size={20} />, label: 'Medical', color: 'bg-error' },
  { id: 'traffic', icon: <TrafficIcon size={20} />, label: 'Traffic', color: 'bg-primary' },
  { id: 'monsoon', icon: <CloudRain size={20} />, label: 'Weather', color: 'bg-tertiary' },
  { id: 'roads', icon: <AlertTriangle size={20} />, label: 'Roads', color: 'bg-amber-500' },
];

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ onServiceSelect, onOpenCalculator, activeService, incidents = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  const roadCounts = useMemo(() => {
    const roadIncidents = incidents.filter(i => {
      const s = (i.status || i.type || '').toLowerCase();
      return s.includes('block') || s.includes('one') || s.includes('resum') || i.type === 'Road Block' || i.type === 'One-Lane';
    });
    return {
      blocked: roadIncidents.filter(i => (i.status || i.type || '').toLowerCase().includes('block') || i.type === 'Road Block').length,
      total: roadIncidents.length,
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
    <div className="fixed bottom-10 right-40 z-[2000] flex flex-row-reverse items-center gap-2 pointer-events-none">
      
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
              {/* Road status badge */}
              {s.id === 'roads' && roadCounts.blocked > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {roadCounts.blocked}
                </span>
              )}
            </button>
          );
        })}

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
