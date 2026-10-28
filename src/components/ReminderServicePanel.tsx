import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Clock,
  MapPin,
  Fuel,
  Mountain,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  ChevronDown,
  RefreshCw,
  Trash2,
  Target,
  Radio,
  Locate,
} from 'lucide-react';
import { fetchJson } from '../utils/apiConfig';
import { ReminderItem, ReminderCategory } from '../types';
import { readFreshCachedGps, writeCachedGps } from '../utils/gpsLocation';
import { getDistanceAlongPathToPoint, getDistanceKm } from '../utils/geoUtils';

const CATEGORY_META: Record<ReminderCategory, { label: string; icon: any; color: string; badgeBg: string }> = {
  departure_time: { label: 'Departure Time', icon: Clock, color: 'text-cyan-400', badgeBg: 'bg-cyan-950/30' },
  rest_stop: { label: 'Rest Stop', icon: Mountain, color: 'text-emerald-400', badgeBg: 'bg-emerald-950/30' },
  fuel_stop: { label: 'Fuel Stop', icon: Fuel, color: 'text-amber-400', badgeBg: 'bg-amber-950/30' },
  event: { label: 'Event / Festival', icon: AlertTriangle, color: 'text-purple-400', badgeBg: 'bg-purple-950/30' },
  weather: { label: 'Weather Alert', icon: AlertTriangle, color: 'text-blue-400', badgeBg: 'bg-blue-950/30' },
  toll_plaza: { label: 'Toll Plaza', icon: MapPin, color: 'text-rose-400', badgeBg: 'bg-rose-950/30' },
  border_check: { label: 'Border Check', icon: MapPin, color: 'text-indigo-400', badgeBg: 'bg-indigo-950/30' },
  custom: { label: 'Custom', icon: Sparkles, color: 'text-slate-400', badgeBg: 'bg-slate-950/30' },
};

interface ReminderServicePanelProps {
  onBack?: () => void;
  routePlan?: {
    origin?: { name: string; id: string; lat?: number; lng?: number };
    destination?: { name: string; id: string; lat?: number; lng?: number };
    totalDistanceKm?: number;
    id?: string;
    pathCoordinates?: [number, number][];
  };
  userId?: string;
  vehicle?: string;
  preference?: string;
}

export const ReminderServicePanel: React.FC<ReminderServicePanelProps> = ({
  onBack,
  routePlan,
  userId = 'default-user',
  vehicle = 'car',
  preference = 'fastest',
}) => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);
  const [gpsFix, setGpsFix] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [routeProgressKm, setRouteProgressKm] = useState<number | null>(null);
  const [distanceToDestinationKm, setDistanceToDestinationKm] = useState<number | null>(null);
  const [triggeredReminders, setTriggeredReminders] = useState<ReminderItem[]>([]);
  const [showTriggeredPanel, setShowTriggeredPanel] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const watchRef = useRef<number | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());

  // Load reminders on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJson<{ reminders: ReminderItem[]; count: number }>(
          `/api/reminders?userId=${encodeURIComponent(userId)}`
        );
        if (data.reminders) setReminders(data.reminders);
      } catch (e: any) {
        setError('Failed to load reminders.');
      }
    };
    load();
  }, [userId]);

  // Seed GPS from cache on mount
  useEffect(() => {
    const cached = readFreshCachedGps();
    if (cached) setGpsFix(cached);
  }, []);

  // Setup Web Speech API recognition (voice input)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setShowVoiceHint(false);
    };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);
    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Geolocation watch for location-based tracking
  useEffect(() => {
    if (!locationTracking || typeof window === 'undefined' || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const fix = { lat: latitude, lng: longitude, timestamp: Date.now() };
        setGpsFix(fix);
        writeCachedGps(latitude, longitude);
      },
      (err) => {
        console.warn('[ReminderService] Geolocation watch error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
    watchRef.current = id;

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [locationTracking]);

  // Compute route progress and distance to destination whenever GPS or route changes
  useEffect(() => {
    if (!gpsFix || !routePlan?.pathCoordinates || routePlan.pathCoordinates.length < 2) {
      setRouteProgressKm(null);
      setDistanceToDestinationKm(null);
      return;
    }

    const along = getDistanceAlongPathToPoint(gpsFix.lat, gpsFix.lng, routePlan.pathCoordinates);
    if (along) {
      setRouteProgressKm(along.distanceKm);
      const dest = routePlan.pathCoordinates[routePlan.pathCoordinates.length - 1];
      const d = getDistanceKm(gpsFix.lat, gpsFix.lng, dest[0], dest[1]);
      setDistanceToDestinationKm(Math.round(d * 10) / 10);
    }
  }, [gpsFix, routePlan]);

  // Check reminders against current route progress and trigger location-based prompts
  useEffect(() => {
    if (!routePlan || routeProgressKm === null) return;

    const now = new Date().toISOString();
    const totalKm = routePlan.totalDistanceKm || 0;
    const destName = routePlan.destination?.name || 'destination';
    const newlyTriggered: ReminderItem[] = [];
    const updated: ReminderItem[] = [];

    for (const r of reminders) {
      if (!r.active || r.dismissed || r.triggered) continue;
      let shouldTrigger = false;
      let triggerKind: 'distance' | 'pre-arrival' | 'arrival' = 'distance';

      if (r.triggerOnArrival && distanceToDestinationKm != null && distanceToDestinationKm <= 2) {
        shouldTrigger = true;
        triggerKind = 'arrival';
      } else if (r.preArrivalKm != null && distanceToDestinationKm != null && distanceToDestinationKm <= r.preArrivalKm) {
        shouldTrigger = true;
        triggerKind = 'pre-arrival';
      } else if (r.triggerAtKm != null && routeProgressKm >= r.triggerAtKm) {
        shouldTrigger = true;
        triggerKind = 'distance';
      }

      if (shouldTrigger && !announcedRef.current.has(r.id)) {
        announcedRef.current.add(r.id);
        newlyTriggered.push({
          ...r,
          triggered: true,
          triggeredAt: now,
        });
        updated.push({
          ...r,
          triggered: true,
          triggeredAt: now,
        });
      }
    }

    if (newlyTriggered.length > 0) {
      setReminders((prev) =>
        prev.map((r) => {
          const u = updated.find((u) => u.id === r.id);
          return u || r;
        })
      );
      setTriggeredReminders((prev) => [...newlyTriggered, ...prev]);
      setShowTriggeredPanel(true);
      const titles = newlyTriggered.map((r) => r.title).join(', ');
      const kindLabel = newlyTriggered[0]?.triggerOnArrival ? 'Arrival' : newlyTriggered[0]?.preArrivalKm != null ? 'Pre-arrival' : 'Location';
      speak(`${kindLabel} reminder${newlyTriggered.length > 1 ? 's' : ''}: ${titles}`);
    }
  }, [routeProgressKm, distanceToDestinationKm, routePlan, reminders]);

  const startVoice = () => {
    if (!recognitionRef.current) {
      setError('Voice input not supported in this browser.');
      return;
    }
    try {
      recognitionRef.current.start();
      setVoiceActive(true);
      setError(null);
    } catch {
      setVoiceActive(false);
      setError('Could not start voice input.');
    }
  };

  const stopVoice = () => {
    try { recognitionRef.current?.abort(); } catch {}
    setVoiceActive(false);
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 1;
    synthRef.current.speak(utt);
  };

  const toggleLocationTracking = () => {
    setLocationTracking((prev) => {
      const next = !prev;
      if (!next && watchRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<any>('/api/ai-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          input: input.trim(),
          routeContext: routePlan
            ? {
                origin: routePlan.origin?.name,
                destination: routePlan.destination?.name,
                distanceKm: routePlan.totalDistanceKm,
                routeId: routePlan.id,
                vehicle,
                preference,
              }
            : {},
        }),
      });
      setReminders((prev) => [...data.suggestions, ...prev]);
      setInput('');
      setShowVoiceHint(false);
      if (data.suggestions.length) {
        speak(`I found ${data.suggestions.length} reminder suggestions for your trip.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Reminder generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setSaving(true);
    try {
      await fetchJson('/api/reminders/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reminderId: id }),
      });
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r)));
      setTriggeredReminders((prev) => prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r)));
    } catch (e: any) {
      setError('Failed to dismiss reminder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setTriggeredReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const clearTriggered = (id: string) => {
    announcedRef.current.delete(id);
    setTriggeredReminders((prev) => prev.filter((r) => r.id !== id));
    if (triggeredReminders.length === 1) setShowTriggeredPanel(false);
  };

  const activeReminders = reminders.filter((r) => r.active && !r.dismissed && !r.triggered);
  const dismissedReminders = reminders.filter((r) => r.dismissed);
  const locationBasedReminders = reminders.filter(
    (r) => r.triggerAtKm != null || r.preArrivalKm != null || r.triggerOnArrival
  );

  const distanceToDestText = distanceToDestinationKm != null
    ? `~${distanceToDestinationKm.toFixed(1)} km to ${routePlan?.destination?.name || 'destination'}`
    : 'tracking stopped';

  return (
    <section className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in-smooth">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display">AI Reminder Service</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Get smart reminders for departure, stops, fuel, weather & events on your route
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onBack ? (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Close reminder service"
            >
              <span className="sr-only">Close</span>
              <span className="text-[10px]">✕</span>
            </button>
          ) : null}
          <button
            onClick={() => speak('AI Reminder Service is active. Tell me what you need to remember on your trip.')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="Hear intro"
          >
            <span className="sr-only">Speak intro</span>
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
          <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>Tell Mero Sadak AI what to remind you about</span>
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(e as any)}
            rows={2}
            placeholder="e.g. Remind me to refuel before Pokhara, or wake up at 5am for departure..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
          />
          <div className="absolute right-3 top-3 flex items-center gap-1">
            <button
              onClick={startVoice}
              disabled={voiceActive || loading}
              className={`p-1.5 rounded-lg transition ${voiceActive ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title="Voice input"
            >
              {voiceActive ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="ml-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>{loading ? 'Thinking...' : 'Get Reminders'}</span>
            </button>
          </div>
        </div>

        {showVoiceHint && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50 text-[10px] text-slate-400">
            <Mic className="w-3 h-3" />
            <span>Click the mic to speak your reminder instead of typing.</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-rose-300">{error}</span>
          </div>
        )}
      </div>

      {/* Location tracking bar (shown when a route is active) */}
      {routePlan && (
        <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLocationTracking}
                className={`flex items-center gap-1.5 p-1.5 rounded-lg transition ${locationTracking ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700/50'}`}
                title="Location tracking"
              >
                {locationTracking ? <Target className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                <span className="text-[10px] font-medium">{locationTracking ? 'Tracking' : 'Track location'}</span>
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
              {locationTracking && routeProgressKm != null ? (
                <>
                  <span>~{routeProgressKm.toFixed(1)} km along route</span>
                  <span className="text-slate-500">|</span>
                  <span>{distanceToDestText}</span>
                </>
              ) : (
                <span className="text-slate-500">Location tracking off</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active reminders list */}
      {activeReminders.length > 0 || dismissedReminders.length > 0 || triggeredReminders.length > 0 ? (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <span>Active Reminders ({activeReminders.length})</span>
            <button
              onClick={() => speak(`You have ${activeReminders.length} active reminders.`)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Read reminders aloud"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
          </div>

          {locationBasedReminders.length > 0 && (
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Locate className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  Location-based reminders ({locationBasedReminders.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {locationBasedReminders.map((r) => {
                  const meta = CATEGORY_META[r.category];
                  const isTriggered = r.triggered;
                  return (
                    <div
                      key={r.id}
                      className={`bg-slate-900/80 border rounded-xl p-2.5 flex items-center justify-between gap-2 ${
                        isTriggered ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800/90'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border flex items-center space-x-1 ${meta.badgeBg} ${meta.color}`}
                        >
                          <meta.icon className="w-3 h-3" />
                          <span>{meta.label}</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          {r.triggerAtKm != null && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>at ~{r.triggerAtKm} km</span>
                            </span>
                          )}
                          {r.preArrivalKm != null && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{r.preArrivalKm} km before arrival</span>
                            </span>
                          )}
                          {r.triggerOnArrival && (
                            <span className="flex items-center gap-0.5">
                              <Target className="w-3 h-3 shrink-0 text-emerald-400" />
                              <span className="text-emerald-400">on arrival</span>
                            </span>
                          )}
                          {isTriggered && (
                            <span className="flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-emerald-400 text-[9px] font-bold">triggered</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-200 font-medium line-clamp-1">
                          {r.title}
                        </p>
                        {isTriggered ? (
                          <button
                            onClick={() => clearTriggered(r.id)}
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5 transition"
                            title="Dismiss triggered"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => speak(`${r.title}. ${r.description}`)}
                            className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 transition"
                            title="Hear reminder"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {activeReminders.map((r) => {
              const meta = CATEGORY_META[r.category];
              return (
                <div
                  key={r.id}
                  className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 group hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border flex items-center space-x-1 ${meta.badgeBg} ${meta.color}`}
                    >
                      <meta.icon className="w-3 h-3" />
                      <span>{meta.label}</span>
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      {r.suggestedPlace && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{r.suggestedPlace}</span>
                        </span>
                      )}
                      {r.suggestedTime && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{r.suggestedTime}</span>
                        </span>
                      )}
                      {r.approxKmFromOrigin != null && (
                        <span className="flex items-center gap-0.5">
                          <span>~{r.approxKmFromOrigin} km</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <p className="text-xs text-slate-200 font-medium leading-tight line-clamp-1 sm:max-w-[200px]">
                      {r.title}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-1 sm:max-w-[240px]">
                      {r.description}
                    </p>
                    <div className="flex items-center gap-1 sm:ml-auto mt-2 sm:mt-0">
                      <button
                        onClick={() => speak(`${r.title}. ${r.description}`)}
                        className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 transition"
                        title="Hear reminder"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDismiss(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                        title="Dismiss"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {dismissedReminders.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/50">
              <button
                onClick={() => setReminders((prev) => prev.filter((r) => !r.dismissed))}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Restore dismissed reminders</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 pb-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-xs text-slate-400">No reminders yet.</p>
          <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs mx-auto">
            Type or speak what you need to remember, and Mero Sadak AI will suggest places, times & events along your route.
          </p>
        </div>
      )}

      {/* Triggered prompts panel */}
      {showTriggeredPanel && triggeredReminders.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-[4px] flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-6 w-full sm:w-[420px] max-h-[70vh] overflow-y-auto animate-fade-in-smooth">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-emerald-400" />
                Triggered Reminder{triggeredReminders.length > 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setShowTriggeredPanel(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {triggeredReminders.map((r) => {
                const meta = CATEGORY_META[r.category];
                return (
                  <div
                    key={r.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border flex items-center space-x-1 ${meta.badgeBg} ${meta.color}`}
                      >
                        <meta.icon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>
                      {r.triggerOnArrival && (
                        <span className="ml-auto text-[10px] font-bold text-emerald-400">ARRIVAL</span>
                      )}
                      {r.preArrivalKm != null && (
                        <span className="ml-auto text-[10px] font-bold text-cyan-400">PRE-ARRIVAL</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{r.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.description}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-2">
                      {r.suggestedPlace && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{r.suggestedPlace}</span>
                        </span>
                      )}
                      {r.triggeredAt && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(r.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => speak(`${r.title}. ${r.description}`)}
                        className="flex-1 py-2 px-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 hover:text-cyan-300 transition text-xs font-medium"
                        title="Hear again"
                      >
                        <MessageSquare className="w-3 h-3 mr-1.5" />
                        Hear again
                      </button>
                      <button
                        onClick={() => clearTriggered(r.id)}
                        className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs"
                        title="Dismiss"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/50">
              <button
                onClick={() => {
                  setShowTriggeredPanel(false);
                  setTriggeredReminders([]);
                  announcedRef.current.clear();
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Dismiss all triggered</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};