import React, { useMemo } from 'react';
import { X, Battery, Zap, CloudOff, EyeOff, ShieldCheck, LineChart } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface BatterySaverModalProps {
    isOpen: boolean;
    onClose: () => void;
    batteryLevel: number | null;
    history?: { t: number; v: number }[];
    config: {
        autoStealth: boolean;
        reduceSync: boolean;
        darkenMap: boolean;
    };
    onUpdateConfig: (config: any) => void;
}

export const BatterySaverModal: React.FC<BatterySaverModalProps> = ({
    isOpen,
    onClose,
    batteryLevel,
    history = [],
    config,
    onUpdateConfig
}) => {
    useEscapeKey(onClose, isOpen);

    // Generate simple SVG path for the consumption history
    const chartPath = useMemo(() => {
        if (history.length < 2) return "";
        const width = 300;
        const height = 60;

        const line = history.map((point, i) => {
            const x = (i / (history.length - 1)) * width;
            const y = height - (point.v / 100) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        // Close the path at the bottom to create the area fill
        return {
            stroke: line,
            fill: `${line} L 300 ${height} L 0 ${height} Z`
        };
    }, [history]);

    if (!isOpen) return null;

    const toggles = [
        {
            id: 'autoStealth',
            icon: <EyeOff size={18} />,
            label: 'Auto-Stealth Mode',
            desc: 'Force 2D view at 15% battery',
            active: config.autoStealth
        },
        {
            id: 'reduceSync',
            icon: <CloudOff size={18} />,
            label: 'Low Frequency Sync',
            desc: 'Sync cloud data every 10 mins',
            active: config.reduceSync
        },
        {
            id: 'darkenMap',
            icon: <Zap size={18} />,
            label: 'Dynamic Map Dimming',
            desc: 'Reduce map brightness on low power',
            active: config.darkenMap
        },
    ];

    return (
        <div className="fixed inset-0 z-[4000] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-outline/10 flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                            <Battery size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-on-surface font-headline leading-tight">Battery Manager</h2>
                            <p className="text-xs text-on-surface-variant/60 font-medium">Extend your device range</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-3xl bg-surface-container-low border border-outline/5">
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Current Charge</span>
                        <span className={`text-2xl font-black font-headline ${batteryLevel !== null && batteryLevel <= 20 ? 'text-error' : 'text-primary'}`}>
                            {batteryLevel}%
                        </span>
                    </div>

                    {/* 📈 Consumption Trend Chart */}
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950/30 border border-outline/5">
                        <div className="flex items-center gap-2 mb-4">
                            <LineChart size={12} className="text-on-surface-variant/40" />
                            <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Power Consumption Trend</span>
                        </div>
                        {history.length >= 2 ? (
                            <svg viewBox="0 0 300 60" className="w-full h-12 overflow-visible">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d={chartPath.fill} fill="url(#chartGradient)" />
                                <path d={chartPath.stroke} fill="none" stroke="var(--color-primary, #3b82f6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_8px_rgba(59,130,246,0.3)]" />
                            </svg>
                        ) : (
                            <div className="h-12 flex items-center justify-center text-[8px] font-black text-on-surface-variant/20 uppercase tracking-widest italic">Calibrating Sensors...</div>
                        )}
                        <p className="text-[7px] text-center text-on-surface-variant/30 uppercase mt-2 font-black tracking-tighter">{history.length >= 2 ? 'Real-time Discharge Profile' : 'Awaiting baseline data'}</p>
                    </div>

                    <div className="space-y-2">
                        {toggles.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => onUpdateConfig({ ...config, [t.id]: !t.active })}
                                className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left ${t.active ? 'border-primary bg-primary/5' : 'border-outline/5 hover:border-primary/20'}`}
                            >
                                <div className={t.active ? 'text-primary' : 'text-on-surface-variant/40'}>{t.icon}</div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-on-surface">{t.label}</div>
                                    <div className="text-[10px] text-on-surface-variant/60 uppercase font-black tracking-tight">{t.desc}</div>
                                </div>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${t.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${t.active ? 'left-4' : 'left-0.5'}`} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl">Apply Settings</button>
                </div>
            </div>
        </div>
    );
};