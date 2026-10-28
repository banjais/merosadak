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
} from 'lucide-react';
import { fetchJson } from '../utils/apiConfig';
import { ReminderItem, ReminderCategory } from '../types';

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
    origin?: { name: string; id: string };
    destination?: { name: string; id: string };
    totalDistanceKm?: number;
    id?: string;
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
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);

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
    } catch (e: any) {
      setError('Failed to dismiss reminder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const activeReminders = reminders.filter((r) => r.active && !r.dismissed);
  const dismissedReminders = reminders.filter((r) => r.dismissed);

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

      {/* Active reminders list */}
      {activeReminders.length > 0 || dismissedReminders.length > 0 ? (
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
    </section>
  );
};
