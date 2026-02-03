import React, { useState } from 'react';
import { 
  Plus, 
  MapPin, 
  CloudRain, 
  AlertTriangle, 
  Fuel, 
  ChefHat, 
  Stethoscope,
  Ruler,
  X,
  Zap
} from 'lucide-react';

interface FloatingMenuProps {
  onServiceSelect: (service: string) => void;
  onOpenCalculator: () => void;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ onServiceSelect, onOpenCalculator }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [geoActive, setGeoActive] = useState(false);

  React.useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => setGeoActive(true), () => setGeoActive(false));
    }
  }, []);

  const services = [
    { id: 'fuel', icon: <Fuel className="w-5 h-5" />, label: 'Fuel Nearby', color: 'bg-orange-500' },
    { id: 'food', icon: <ChefHat className="w-5 h-5" />, label: 'Food & Rest', color: 'bg-emerald-500' },
    { id: 'hospital', icon: <Stethoscope className="w-5 h-5" />, label: 'Medical', color: 'bg-red-500' },
    { id: 'monsoon', icon: <CloudRain className="w-5 h-5" />, label: 'Weather/Rain', color: 'bg-blue-500' },
    { id: 'roads', icon: <AlertTriangle className="w-5 h-5" />, label: 'Official Roads', color: 'bg-amber-500' },
    { id: 'calc', icon: <Ruler className="w-5 h-5" />, label: 'Measure Dist', color: 'bg-indigo-500', isCalc: true },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-[2000] flex flex-col items-end gap-4">
      
      {/* Menu Items (Expansion) */}
      <div className={`flex flex-col gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        {services.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 group">
            <span className="bg-slate-900/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {s.label}
            </span>
            <button
              onClick={() => {
                if (s.isCalc) onOpenCalculator();
                else onServiceSelect(s.id);
                setIsOpen(false);
              }}
              className={`${s.color} text-white p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all ring-4 ring-white/10`}
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              {s.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Primary Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group p-6 rounded-[28px] bg-indigo-600 text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] hover:bg-indigo-700 transition-all active:scale-90"
      >
        {/* Pulsing Wave Effect (Only if Geo is active per requirements) */}
        {geoActive && (
          <>
            <div className="absolute inset-0 rounded-[28px] bg-indigo-500 animate-ping opacity-30 pointer-events-none" />
            <div className="absolute inset-0 rounded-[28px] border-4 border-indigo-400/30 scale-110 group-hover:scale-125 transition-transform duration-500" />
          </>
        )}
        
        {isOpen ? <X className="w-8 h-8 relative z-10" /> : <Plus className="w-8 h-8 relative z-10" />}
      </button>

      {/* Floating Status Badge */}
      {!isOpen && (
        <div className="absolute -top-12 right-0 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-right-4 duration-1000">
           {geoActive ? (
             <>
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               Location Sync: Active
             </>
           ) : (
             <>
               <Zap className="w-3 h-3 text-amber-500" />
               Services Ready
             </>
           )}
        </div>
      )}

    </div>
  );
};
