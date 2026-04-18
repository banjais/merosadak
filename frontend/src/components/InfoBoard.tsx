import React, { useState, useMemo } from 'react';
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
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlarmClock,
  Sparkles,
  Bell,
  Navigation
} from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { motion } from 'framer-motion';

interface InfoBoardProps {
  onClose: () => void;
  activeTab: string;
  context?: 'travel' | 'road' | 'service' | 'alert' | null;
  selectedObject?: any;
  data: any[];
}

export const InfoBoard: React.FC<InfoBoardProps> = ({ onClose, activeTab, context, selectedObject, data = [] }) => {
  const [filter, setFilter] = useState('all');
  const [reminderTask, setReminderTask] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]); // This would be fetched from TravelPlanService

  // POI Grouping logic as requested
  const groupedData = useMemo(() => {
    if (activeTab !== 'pois') return data;
    return data.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [activeTab, data]);

  // Specialized view for AI Reminders
  if (activeTab === 'reminders') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500 rounded-2xl text-white">
              <AlarmClock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">Proactive AI Reminders</h3>
              <p className="text-[10px] font-bold text-violet-500/60 uppercase">Anticipatory Safety Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Section */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-4 tracking-widest">Create New Alert</h4>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="What should I remind you about?"
                value={reminderTask}
                onChange={(e) => setReminderTask(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-violet-500/20 transition-all"
              />

              {/* Plan Linking Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-slate-400 px-1">Link to Travel Plan (For Proactive Alerts)</label>
                <select
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3 text-[10px] font-bold outline-none"
                >
                  <option value="">No Plan (General Alert)</option>
                  {/* Example Plan mapping */}
                  <option value="plan_123">Trip to Pokhara (Prithvi Highway)</option>
                  <option value="plan_456">Trip to Mustang (Beni-Jomsom)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none"
                />
                <button className="px-6 py-4 bg-violet-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all">
                  Set Alert
                </button>
              </div>
            </div>
          </div>

          {/* Active Reminders with AI Suggestions */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase text-slate-400 px-1 tracking-widest">Scheduled Insights</h4>

            {/* Mocking an active reminder with a proactive suggestion */}
            <div className="group p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <span className="text-[9px] font-black bg-violet-500 text-white px-2 py-1 rounded-full">AI ACTIVE</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="text-violet-500">
                  <AlarmClock size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight">Departure: Kathmandu to Pokhara</h4>
                  <p className="text-[10px] font-bold opacity-40">Today at 07:00 AM</p>
                </div>
              </div>

              {/* The "Proactive Action" Clue */}
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 p-4 rounded-2xl flex gap-3 items-start">
                <div className="shrink-0 text-violet-500 mt-1">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tighter">AI Proactive Suggestion</p>
                  <p className="text-xs font-medium leading-relaxed opacity-80">
                    Expect fog near Naubise. I suggest checking your fog lights now and leaving at 06:40 AM to avoid the morning construction window.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest">Snooze</button>
                <button className="flex-1 py-3 rounded-xl bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest">I'm Ready</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assemble tabs based on context
  const contextTabs = useMemo(() => {
    if (context === 'travel') return [{ id: 'route', label: 'Plan', icon: <Navigation size={14} /> }, { id: 'weather', label: 'Weather', icon: <CloudRain size={14} /> }, { id: 'pois', label: 'Services', icon: <Fuel size={14} /> }];
    if (context === 'road') return [{ id: 'status', label: 'Status', icon: <AlertTriangle size={14} /> }, { id: 'incidents', label: 'Live Alerts', icon: <Bell size={14} /> }, { id: 'pois', label: 'Nearby', icon: <Navigation size={14} /> }];
    if (context === 'service') return [{ id: 'detail', label: 'Details', icon: <Info size={14} /> }, { id: 'ai', label: 'AI Advice', icon: <Sparkles size={14} /> }];
    return [{ id: 'all', label: 'Summary', icon: <Info size={14} /> }, { id: 'near', label: 'Nearest', icon: <Navigation size={14} /> }];
  }, [context]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans">
      {/* 1. Tab Bar - Top to Down effect anchor */}
      <div className="flex items-center gap-2 px-6 py-4 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 shrink-0">
        {contextTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filter === tab.id
              ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
              : 'bg-white dark:bg-slate-800 text-on-surface-variant'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <X size={20} className="text-on-surface-variant" />
        </button>
      </div>

      {/* 2. Scrollable Detail Surface */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 italic">
            <HelpCircle size={48} className="mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">No active reports found</p>
            <p className="text-xs">Adjust your region or service filter</p>
          </div>
        ) : (
          groupedData.map((item, idx) => (
            <div
              key={item.id || idx}
              className="group p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-2xl bg-primary/5 text-primary`}>
                    {activeTab === 'fuel' ? <Fuel size={18} /> : activeTab === 'medical' ? <Stethoscope size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-on-surface leading-none group-hover:text-primary transition-colors">{item.title || item.name}</h4>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-1">{item.incidentDistrict || item.city || 'Nepal'}</p>
                  </div>
                </div>
                <SourceBadge source={item.source} />
              </div>

              <p className="text-xs leading-relaxed text-on-surface-variant/80 font-medium mb-4 line-clamp-3">
                {item.description || item.remarks || 'Standard verified operational data for current road infrastructure and services.'}
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-on-surface-variant/40 tracking-widest">ETA/Distance</span>
                  <span className="text-xs font-black tabular-nums">{item.distance ? `${item.distance.toFixed(1)} km` : '---'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-on-surface-variant/40 tracking-widest">Status</span>
                  <span className={`text-xs font-black uppercase ${item.status === 'Blocked' ? 'text-red-500' : 'text-emerald-500'}`}>{item.status || 'Active'}</span>
                </div>
                <div className="flex-1" />
                <button className="px-5 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all active:scale-95">
                  Navigate
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center shrink-0">
        <span className="text-[9px] font-black italic opacity-40 uppercase tracking-[0.3em] text-on-surface">SAFE TRAVELS • NEPAL 🇳🇵</span>
      </div>
    </div>
  );
};
