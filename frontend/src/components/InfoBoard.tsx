import React, { useState } from 'react';
import {
  Info,
  X,
  ChevronRight,
  Fuel,
  ChefHat,
  Stethoscope,
  TrafficCone as TrafficIcon,
  CloudRain,
  AlertTriangle,
  Globe,
  Settings,
  HelpCircle
} from 'lucide-react';

interface InfoBoardProps {
  onServiceSelect: (service: string | null) => void;
  activeService: string | null;
  isDarkMode: boolean;
}

export const InfoBoard: React.FC<InfoBoardProps> = ({ onServiceSelect, activeService, isDarkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const serviceManifest = [
    {
      id: 'fuel',
      icon: <Fuel className="text-orange-500" size={16} />,
      label: 'Fuel Nearby',
      desc: 'Live status of petrol pumps and gas stations across major highways.',
      color: 'bg-orange-500/10'
    },
    {
      id: 'food',
      icon: <ChefHat className="text-emerald-500" size={16} />,
      label: 'Food & Rest',
      desc: 'Verified highway eateries, dhabas, and overnight resting points.',
      color: 'bg-emerald-500/10'
    },
    {
      id: 'hospital',
      icon: <Stethoscope className="text-red-500" size={16} />,
      label: 'Medical',
      desc: 'Emergency clinics and hospitals near your current route.',
      color: 'bg-red-500/10'
    },
    {
      id: 'traffic',
      icon: <TrafficIcon className="text-indigo-500" size={16} />,
      label: 'Traffic Live',
      desc: 'Real-time congestion and traffic flow data from TomTom and Waze.',
      color: 'bg-indigo-500/10'
    },
    {
      id: 'monsoon',
      icon: <CloudRain className="text-blue-500" size={16} />,
      label: 'Weather/Rain',
      desc: 'Monsoon risk assessment and rainfall monitoring for landslide prevention.',
      color: 'bg-blue-500/10'
    },
    {
      id: 'roads',
      icon: <AlertTriangle className="text-amber-500" size={16} />,
      label: 'Official Roads',
      desc: 'Department of Roads (DOR) official status on blockages and maintenance.',
      color: 'bg-amber-500/10'
    },
  ];

  return (
    <div className={`fixed bottom-24 right-8 z-[2000] flex flex-col items-end pointer-events-none`}>

      {/* 📋 Expandable Info Board */}
      <div className={`pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10'}`}>
        <div className={`w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.3)] border overflow-hidden glass-pilot ${isDarkMode ? 'border-white/10 text-white' : 'border-black/5 text-slate-800'}`}>

          {/* Header */}
          <div className="p-5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                <Globe size={18} />
              </div>
              <div>
                <h3 className="font-black text-xs uppercase tracking-widest">App Directory</h3>
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter italic">v1.1.0-Release</p>
              </div>
            </div>
            <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X size={18} className="opacity-50" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

            {/* About Section */}
            <div className="mb-6 px-1">
              <div className="flex items-center gap-2 mb-2 text-indigo-500">
                <HelpCircle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">About MeroSadak</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-70 italic font-medium">
                A unified driver assistance platform for Nepal, merging real-time data from the Dept. of Roads, weather stations, and community sources to ensure safe travel across the Himalayas.
              </p>
            </div>

            {/* Services List */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
                <Settings size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Integrated Services</span>
              </div>

              {serviceManifest.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onServiceSelect(activeService === s.id ? null : s.id);
                  }}
                  className={`w-full group text-left p-3 rounded-2xl border transition-all ${activeService === s.id ? 'bg-indigo-600 border-indigo-500 text-white scale-[1.02] shadow-xl ring-2 ring-indigo-500/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-xl transition-colors ${activeService === s.id ? 'bg-white/20' : s.color}`}>
                      {s.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs font-black uppercase tracking-wide`}>{s.label}</h4>
                        {activeService === s.id && <ChevronRight size={14} className="animate-pulse" />}
                      </div>
                      <p className={`text-[10px] leading-snug line-clamp-2 ${activeService === s.id ? 'opacity-90' : 'opacity-40 font-medium'}`}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Info */}
          <div className="p-4 bg-white/5 border-t border-white/10 text-center">
            <span className="text-[9px] font-black italic opacity-40 uppercase tracking-[0.3em]">SAFE TRAVELS • NEPAL 🇳🇵</span>
          </div>
        </div>
      </div>

      {/* 🔵 Toggle Toggle Info Circle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`pointer-events-auto mt-4 p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90 flex items-center gap-3 border ${isExpanded ? 'bg-slate-900 border-white/10 text-indigo-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-800 dark:text-white'}`}
      >
        <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-indigo-500/20' : 'bg-indigo-600 shadow-lg shadow-indigo-600/30'}`}>
          <Info size={20} className={isExpanded ? 'text-indigo-400' : 'text-white'} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest pr-2">Learn Services</span>
      </button>

    </div>
  );
};
