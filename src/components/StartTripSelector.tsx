import React, { useState } from 'react';
import {
  Car,
  Users,
  Navigation,
  Fuel,
  Wrench,
  Zap,
  Shield,
  MapPin,
  ShieldCheck,
  CloudFog,
  AlertTriangle,
  Activity,
  Share2,
  Download,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

type TravelerRole = 'driver' | 'passenger';

interface StartTripSelectorProps {
  onRoleSelect: (role: TravelerRole) => void;
}

const SERVICES = {
  driver: [
    { icon: Navigation, key: 'nav', title: 'Navigation', detail: 'Turn-by-turn voice guidance' },
    { icon: Fuel, key: 'fuel', title: 'Fuel & Tolls', detail: 'Live cost calculator by vehicle' },
    { icon: Wrench, key: 'checklist', title: 'Vehicle Check', detail: 'Tires, fluids, brakes, kit' },
    { icon: Zap, key: 'ev', title: 'EV Charging', detail: 'NEA fast-chargers & range buffer' },
    { icon: Shield, key: 'alerts', title: 'Road Alerts', detail: 'Landslides, rockfall, works' },
    { icon: Download, key: 'offline', title: 'Offline Maps', detail: 'Full corridor, no signal needed' },
  ],
  passenger: [
    { icon: MapPin, key: 'track', title: 'Live Tracking', detail: 'Real-time progress on map' },
    { icon: ShieldCheck, key: 'safety', title: 'Safety Alerts', detail: 'Pass conditions, hazards' },
    { icon: CloudFog, key: 'weather', title: 'Pass Weather', detail: 'Temp, visibility, rain at passes' },
    { icon: AlertTriangle, key: 'incidents', title: 'Incidents', detail: 'DoR & police verified' },
    { icon: Activity, key: 'traffic', title: 'Traffic', detail: 'Bottlenecks & live speeds' },
    { icon: Share2, key: 'share', title: 'Share Trip', detail: 'Send live ETA link' },
  ],
};

export const StartTripSelector: React.FC<StartTripSelectorProps> = ({ onRoleSelect }) => {
  const [role, setRole] = useState<TravelerRole | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pick = (r: TravelerRole) => {
    setRole(r);
    setTimeout(() => onRoleSelect(r), 200);
  };

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#f59e0b" /></svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">MERO SADAK</h1>
          <p className="text-slate-500 text-sm uppercase tracking-wider mt-1">Nepal Highways</p>
        </div>

        <div className="w-full max-w-xl">
          <p className="text-center text-slate-400 text-sm mb-6">How are you traveling?</p>

          <div className="grid md:grid-cols-2 gap-3">
            {(['driver', 'passenger'] as TravelerRole[]).map((r) => {
              const isSel = role === r;
              const color = r === 'driver' ? 'emerald' : 'cyan';
              const Icon = r === 'driver' ? Car : Users;
              const label = r === 'driver' ? 'DRIVER' : 'PASSENGER';
              const subtitle = r === 'driver' ? 'I drive' : 'I ride';
              const services = SERVICES[r];

              return (
                <button
                  key={r}
                  onClick={() => pick(r)}
                  className={`relative p-5 rounded-2xl border-2 transition-all flex flex-col h-full ${
                    isSel
                      ? `border-${color}-500 bg-${color}-500/10 shadow-xl shadow-${color}-500/20`
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  <span className={`absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-${color}-500 text-slate-950 text-[9px] font-black uppercase`}>
                    {label}
                  </span>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 border border-${color}-500/30 flex items-center justify-center`}>
                      <Icon className="w-6 h-6" style={{ color: `var(--${color}-500)` }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">{subtitle}</h3>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-hidden">
                    {services.map((s, i) => {
                      const isOpen = expanded === s.key;
                      const Icon = s.icon;
                      return (
                        <div key={s.key} className="group relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggle(s.key); }}
                            className="w-full flex items-center space-x-3 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/50 hover:border-slate-700 transition text-left"
                          >
                            <div className={`w-7 h-7 rounded-lg bg-${color}-500/15 flex items-center justify-center shrink-0`}>
                              <Icon className="w-3.5 h-3.5" style={{ color: `var(--${color}-500)` }} />
                            </div>
                            <span className="font-medium text-sm text-white flex-1 truncate">{s.title}</span>
                            <span className={`text-[10px] text-${color}-400 transition-transform shrink-0`} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </span>
                          </button>
                          {isOpen && (
                            <div className="mt-1 ml-10 pr-2 border-l border-slate-800/50 pl-2 animate-fadeIn">
                              <p className="text-slate-400 text-[11px] leading-relaxed">{s.detail}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); pick(r); }}
                    className={`mt-4 w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center space-x-2 transition shadow-lg ${
                      r === 'driver'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                    }`}
                  >
                    <span>{r === 'driver' ? 'Drive' : 'Track'}</span>
                    <Navigation className="w-4 h-4" />
                  </button>
                </button>
              );
            })}
          </div>

          <p className="text-center text-slate-600 text-[10px] uppercase tracking-wider mt-8">
            DoR & Traffic Police Live Data
          </p>
        </div>
      </main>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
};