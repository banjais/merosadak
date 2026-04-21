import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Info,
  X,
  ChevronRight,
  Fuel,
  ChefHat,
  Stethoscope,
  TrafficCone as TrafficIcon,
  CloudRain,
  Cloud,
  AlertTriangle,
  Globe,
  Mountain,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlarmClock,
  Clock,
  Sparkles,
  Bell,
  Navigation,
  MapPin,
  Hash,
  Repeat,
  CheckCircle2,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { HighwayTechnicalSkeleton } from '../services/HighwayTechnicalSkeleton';
import { notificationStateService } from '../services/notificationStateService';
import { reminderService, Reminder } from '../reminderService';
import { toast } from './Toast';

interface DataItem {
  id?: string;
  title?: string;
  name?: string;
  incidentDistrict?: string;
  city?: string;
  source?: string;
  description?: string;
  remarks?: string;
  distance?: number;
  status?: string;
  road_refno?: string;
}

interface Reminder {
  id: string;
  task: string;
  time: string;
  planId?: string | null;
  timestamp: number;
  isCritical?: boolean;
  repeat?: 'none' | 'daily' | 'weekly';
}

const REMINDERS_STORAGE_KEY = 'merosadak_reminders';

interface InfoBoardProps {
  onClose: () => void;
  activeTab: string;
  context?: 'travel' | 'road' | 'service' | 'alert' | null;
  selectedObject?: any;
  data: DataItem[];
  trafficHistory?: { timestamp: number; intensity: number }[];
  trafficPrediction?: { hour: string; intensity: number; precipitation: number }[];
  isProcessing?: boolean;
  onCriticalTrigger?: (message: string) => void;
  descentBriefing?: string | null;
  isDoNotDisturb?: boolean;
}

export const InfoBoard: React.FC<InfoBoardProps> = ({ onClose, activeTab, context, selectedObject, data = [], trafficPrediction = [], isProcessing }) => {
  const [filter, setFilter] = useState(activeTab || 'all');
  const [reminderTask, setReminderTask] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState(false);
  const [reminderRepeat, setReminderRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [snoozeDuration, setSnoozeDuration] = useState(10);
  const [reminders, setReminders] = useState<Reminder[]>(reminderService.getReminders());

  const [plans] = useState<any[]>([
    { id: 'plan_123', name: 'Trip to Pokhara (Prithvi Highway)' },
    { id: 'plan_456', name: 'Trip to Mustang (Beni-Jomsom)' }
  ]);

  useEffect(() => {
    const unsubscribe = reminderService.subscribe(() => {
      setReminders(reminderService.getReminders());
    });
    return () => unsubscribe();
  }, []);


  // POI Grouping logic as requested
  const groupedData = useMemo(() => {
    if (activeTab !== 'pois') return data;
    return data.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [activeTab, data]);

  // 🕒 Best Departure Recommender: Analyzes forecast to suggest the optimal travel window
  const renderBestDepartureTime = () => {
    if (trafficPrediction.length === 0) return null;

    // Find the entry with the minimum intensity
    const bestWindow = [...trafficPrediction].sort((a, b) => a.intensity - b.intensity)[0];
    const isHeavyCongestion = trafficPrediction.every(p => p.intensity > 2.0);
    const isHighRainRisk = bestWindow?.precipitation > 0.6;

    return (
      <div className={`mb-4 p-5 rounded-[2rem] flex gap-4 animate-in slide-in-from-right-4 transition-colors ${isHeavyCongestion ? 'bg-red-500/10 border border-red-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
        <div className={`p-3 rounded-2xl text-white shrink-0 h-max shadow-lg transition-colors ${isHeavyCongestion ? 'bg-red-600 shadow-red-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
          {isHighRainRisk && !isHeavyCongestion ? <CloudRain size={20} /> : <Clock size={20} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`text-[10px] font-black uppercase tracking-widest ${isHeavyCongestion ? 'text-red-600' : 'text-indigo-600'}`}>
              {isHeavyCongestion ? 'Congestion Alert' : 'Optimal Departure'}
            </h4>
            <div className={`px-2 py-0.5 rounded-full text-white text-[8px] font-black uppercase ${isHeavyCongestion ? 'bg-red-600' : 'bg-indigo-600'}`}>
              {isHeavyCongestion ? 'Critical' : 'Suggested'}
            </div>
          </div>
          <p className="text-xs font-bold leading-relaxed text-on-surface">
            {isHeavyCongestion
              ? "Heavy congestion predicted across all upcoming time slots. Expect significant delays."
              : <>The clearest window is predicted at <span className="text-indigo-600 underline underline-offset-4">{bestWindow.hour}</span>. Intensity is expected to drop to <span className="text-indigo-600">{bestWindow.intensity.toFixed(1)}x</span>.</>
            }
          </p>
          {isHighRainRisk && !isHeavyCongestion && (
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-amber-600 uppercase tracking-tighter bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 animate-pulse">
              <AlertTriangle size={10} /> Weather Alert: High precipitation forecast for this window.
            </div>
          )}
        </div>
      </div>
    );
  };

  // 📈 Forecast Visualizer: Renders predicted congestion for the next 6 hours
  const renderTrafficPredictionChart = () => {
    if (trafficPrediction.length === 0) return null;

    return (
      <div className="mb-6 p-4 rounded-3xl bg-amber-500/5 border border-amber-500/10">
        <div className="flex items-center gap-2 mb-4 px-1">
          <TrendingUp size={14} className="text-amber-500" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">Congestion Forecast</h4>
        </div>
        <div className="flex items-end justify-between gap-2 h-20">
          {trafficPrediction.map((p, i) => {
            // Height calculation based on intensity (0.5 to 3.0 range)
            const height = ((p.intensity - 0.5) / 2.5) * 100;

            // Determine weather icon based on precipitation probability
            const WeatherIcon = p.precipitation > 0.6 ? CloudRain : p.precipitation > 0.3 ? Cloud : Sun;
            const iconColor = p.precipitation > 0.6 ? 'text-blue-400' : p.precipitation > 0.3 ? 'text-slate-400' : 'text-amber-400';

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative w-full group">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(10, height)}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className={`w-full rounded-t-lg transition-colors ${p.intensity > 2.2 ? 'bg-red-500/40' : p.intensity > 1.5 ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    {p.intensity.toFixed(1)}x
                  </div>
                </div>
                <WeatherIcon size={10} className={`${iconColor} mb-0.5`} />
                <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tabular-nums">
                  {p.hour}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleAddReminder = () => {
    if (!reminderTask || !reminderTime) return;
    const newReminder: Reminder = {
      id: Math.random().toString(36).substring(7),
      task: reminderTask,
      time: reminderTime,
      planId: selectedPlanId,
      timestamp: Date.now(),
      isCritical,
      repeat: reminderRepeat
    };
    reminderService.addReminder(newReminder);
    setReminders(reminderService.getReminders());
    setReminderTask('');
    setReminderTime('');
    setIsCritical(false);
    setReminderRepeat('none');
  };

  const handleDeleteReminder = (id: string) => {
    reminderService.deleteReminder(id);
    setReminders(reminderService.getReminders());
  };

  const handleDismissAllReminders = () => {
    reminderService.clearAllReminders();
    setReminders([]);
  };

  const handleSnoozeReminder = (id: string) => {
    reminderService.snoozeReminder(id, snoozeDuration);
    toast.info(`Reminder snoozed for ${snoozeDuration} minutes`);
  };

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
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Critical Alert Toggle */}
              <div className="flex items-center gap-3 px-1">
                <button
                  onClick={() => setIsCritical(!isCritical)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isCritical ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isCritical ? 'left-6' : 'left-1'}`} />
                </button>
                <span className="text-[10px] font-black uppercase text-slate-400">Critical Priority (Bypass Mute)</span>
              </div>

              {/* Repeat Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-slate-400 px-1">Repeat Frequency</label>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => setReminderRepeat(option)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${reminderRepeat === option ? 'bg-violet-500 text-white border-violet-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none"
                />
                <button
                  onClick={async () => {
                    // Request permission on first interaction if default
                    if (Notification.permission === 'default') {
                      await notificationStateService.requestPermission();
                    }
                    handleAddReminder();
                  }}
                  className="px-6 py-4 bg-violet-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Set Alert
                </button>
              </div>
            </div>
          </div>

          {/* Active Reminders with AI Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Scheduled Insights</h4>
              {reminders.length > 0 && (
                <button
                  onClick={handleDismissAllReminders}
                  className="text-[9px] font-black uppercase text-red-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={10} /> Dismiss All
                </button>
              )}
            </div>

            {reminders.length === 0 ? (
              <div className="py-10 text-center opacity-30 italic text-xs text-on-surface">No active reminders. Start by setting one above.</div>
            ) : (
              reminders.map(reminder => (
                <div key={reminder.id} className={`group p-5 rounded-[2rem] bg-white dark:bg-slate-900 border shadow-sm relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300 ${reminder.isCritical ? 'border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="absolute top-0 right-0 p-4">
                    <button onClick={() => handleDeleteReminder(reminder.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 rounded-full transition-colors">
                      <X size={14} />
                    </button>
                  </div>

                  {reminder.isCritical && (
                    <div className="absolute top-0 left-0 px-3 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-br-xl">
                      Critical
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-2xl ${reminder.isCritical ? 'bg-red-500/10 text-red-500' : 'bg-violet-500/10 text-violet-500'}`}>
                      <AlarmClock size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-tight text-on-surface">{reminder.task}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">At {reminder.time}</p>
                        {reminder.planId && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                            <p className="text-[10px] font-bold text-violet-500 uppercase">Plan Linked</p>
                          </>
                        )}
                        {reminder.repeat && reminder.repeat !== 'none' && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                              <Repeat size={10} /> {reminder.repeat}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic AI Insight */}
                  <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 p-4 rounded-2xl flex gap-3 items-start">
                    <div className="shrink-0 text-violet-500 mt-1">
                      <Sparkles size={16} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tighter">AI Insight</p>
                      <p className="text-xs font-medium leading-relaxed text-on-surface-variant/80">
                        {reminder.planId
                          ? "Linked travel plan detected. I will check for landslide alerts along the NH network 30 minutes prior."
                          : "General reminder set. I'll monitor system broadcasts for any alerts during this window."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 border border-transparent focus-within:border-violet-500/30 transition-all">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      <select
                        value={snoozeDuration}
                        onChange={(e) => setSnoozeDuration(Number(e.target.value))}
                        className="w-full bg-transparent border-none text-[10px] font-black uppercase py-3 outline-none cursor-pointer"
                      >
                        <option value={5}>5m</option>
                        <option value={10}>10m</option>
                        <option value={30}>30m</option>
                        <option value={60}>1h</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleSnoozeReminder(reminder.id)}
                      className="flex-[2] py-3 rounded-xl bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/10"
                    >
                      Snooze
                    </button>
                  </div>
                </div>
              ))
            )}
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

  // Render technical skeleton when loading highway details
  if (context === 'road' && isProcessing) {
    return <HighwayTechnicalSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans">
      <AnimatePresence mode="wait">
        {context === 'road' && isProcessing ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex-1 overflow-hidden"
          >
            <HighwayTechnicalSkeleton />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Tab Bar */}
            <div className="flex items-center gap-2 px-6 py-4 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
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
              {/* AI Descent Briefing Warning */}
              {context === 'road' && descentBriefing && (
                <div className="p-5 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 mb-4 flex gap-4 animate-in slide-in-from-left-4">
                  <div className="p-3 bg-amber-500 rounded-2xl text-white shrink-0 h-max">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-amber-600 mb-1 tracking-widest">Descent Briefing</h4>
                    <p className="text-xs font-bold leading-relaxed text-on-surface">
                      {descentBriefing}
                    </p>
                  </div>
                </div>
              )}

              {/* Elevation Profile Visualization (Road Technical Context) */}
              {context === 'road' && filter === 'status' && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Mountain size={14} className="text-primary" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 font-label">
                      Elevation Profile (ASL)
                    </h4>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-5 shadow-sm relative overflow-hidden group">
                    <div className="flex items-end justify-between gap-1 h-24 mb-2">
                      {[40, 45, 60, 85, 95, 75, 55, 45, 40, 35, 30, 25, 30, 50, 70, 90, 80, 60, 50, 45].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`flex-1 rounded-t-sm transition-all duration-700 ${h > 80 ? 'bg-error/40' : 'bg-primary/20'} group-hover:bg-primary/40`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-on-surface-variant/30 uppercase tracking-widest px-1">
                      <span>Origin</span>
                      <span>High Pass</span>
                      <span>Destination</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Traffic Intelligence Overlay */}
              {activeTab === 'traffic' && context === 'service' && (
                <>
                  {renderBestDepartureTime()}
                  {renderTrafficPredictionChart()}
                </>
              )}


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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center shrink-0">
        <span className="text-[9px] font-black italic opacity-40 uppercase tracking-[0.3em] text-on-surface">SAFE TRAVELS • NEPAL 🇳🇵</span>
      </div>
    </div>
  );
};
