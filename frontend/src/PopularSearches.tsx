import React from 'react';
import { Zap, ShieldAlert, Coffee, Fuel, HeartPulse, Sparkles } from 'lucide-react';
import { useSettings } from './SettingsContext';

interface PopularSearchesProps {
    onSelect: (query: string) => void;
}

export const PopularSearches: React.FC<PopularSearchesProps> = ({ onSelect }) => {
    const { isDarkMode } = useSettings();
    const trending = [
        { id: 'ev', label: 'EV Charging', icon: <Zap size={14} />, color: 'text-emerald-500', query: 'EV Charging Stations' },
        { id: 'emergency', label: 'Emergency', icon: <ShieldAlert size={14} />, color: 'text-error', query: 'Emergency Services' },
        { id: 'hospital', label: 'Hospitals', icon: <HeartPulse size={14} />, color: 'text-rose-500', query: 'Hospitals' },
        { id: 'fuel', label: 'Fuel', icon: <Fuel size={14} />, color: 'text-amber-500', query: 'Fuel Stations' },
        { id: 'food', label: 'Rest Stops', icon: <Coffee size={14} />, color: 'text-indigo-500', query: 'Restaurants' },
    ];

    return (
        <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className="p-1 rounded-lg bg-primary/10 text-primary">
                    <Sparkles size={12} />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 font-label">
                    Popular Near You
                </h4>
            </div>

            <div className="flex flex-wrap gap-2">
                {trending.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item.query)}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded-xl border transition-all
              ${isDarkMode
                                ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-700 hover:border-primary/50'
                                : 'bg-white border-outline/10 hover:bg-primary/5 hover:border-primary/30 shadow-sm'
                            }
              group active:scale-95
            `}
                    >
                        <div className={`${item.color} group-hover:scale-110 transition-transform`}>
                            {item.icon}
                        </div>
                        <span className="text-[11px] font-bold text-on-surface group-hover:text-primary transition-colors">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};