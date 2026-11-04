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
  Car,
  Plus,
  Briefcase,
  Plane,
} from 'lucide-react';
import { fetchJsonWithFirebaseAuth } from '../utils/apiConfig';
import { ReminderItem, ReminderCategory, ReminderSector } from '../types';
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

const REMINDER_SECTORS: Array<{ id: ReminderSector; label: string; description: string; icon: any; example: string }> = [
  { id: 'vehicle', label: 'Vehicle', description: 'Care, servicing, documents & parking', icon: Car, example: 'Remind me to renew my vehicle insurance next week' },
  { id: 'belongings', label: 'Belongings', description: 'Things to carry, pack or check', icon: Briefcase, example: 'Remind me to take my laptop and charger' },
  { id: 'travel', label: 'Travel', description: 'Trips, routes, stops & departure', icon: Plane, example: 'Remind me to leave for Pokhara at 5 AM' },
  { id: 'other', label: 'Other', description: 'Appointments, bills, work & anything else', icon: Sparkles, example: 'Remind me about my appointment tomorrow' },
];

const getReminderSector = (reminder: ReminderItem): ReminderSector => {
  if (reminder.sector) return reminder.sector;
  return ['departure_time', 'rest_stop', 'fuel_stop', 'event', 'weather', 'toll_plaza', 'border_check'].includes(reminder.category)
    ? 'travel'
    : 'other';
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
  vehicle?: string;
  preference?: string;
}

export const ReminderServicePanel: React.FC<ReminderServicePanelProps> = ({
  onBack,
  routePlan,
  vehicle = 'car',
  preference = 'fastest',
}) => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [input, setInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedSector, setSelectedSector] = useState<ReminderSector>(routePlan ? 'travel' : 'vehicle');
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
  const [parkedVehicle, setParkedVehicle] = useState<{ lat: number; lng: number; savedAt: string; note?: string } | null>(null);
  const [belongings, setBelongings] = useState<Array<{ id: string; label: string; checked: boolean }>>([
    { id: 'phone', label: 'Phone', checked: false },
    { id: 'wallet', label: 'Wallet', checked: false },
    { id: 'keys', label: 'Keys', checked: false },
    { id: 'documents', label: 'ID & documents', checked: false },
    { id: 'luggage', label: 'Luggage', checked: false },
  ]);
  const [newBelonging, setNewBelonging] = useState('');
  const [parkingNote, setParkingNote] = useState('');
  const [tripDataSaving, setTripDataSaving] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const watchRef = useRef<number | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());

  // Load reminders on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJsonWithFirebaseAuth<{ reminders: ReminderItem[]; count: number }>(
          '/api/reminders'
        );
        if (data.reminders) setReminders(data.reminders);
      } catch (e: any) {
        setError('Failed to load reminders.');
      }
    };
    load();
  }, []);

  // Load private parking and belongings data from the authenticated Worker profile.
  useEffect(() => {
    let cancelled = false;
    fetchJsonWithFirebaseAuth<{
      parkedVehicle: { lat: number; lng: number; savedAt: string; note?: string } | null;
      belongings: Array<{ id: string; label: string; checked: boolean }>;
      updatedAt: string | null;
    }>('/api/trip-data')
      .then((data) => {
        if (cancelled) return;
        setParkedVehicle(data.parkedVehicle || null);
        setParkingNote(data.parkedVehicle?.note || '');
        if (data.updatedAt) setBelongings(Array.isArray(data.belongings) ? data.belongings : []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Could not load your saved trip data.');
      });
    return () => { cancelled = true; };
  }, []);

  const persistTripData = async (
    nextParkedVehicle: { lat: number; lng: number; savedAt: string; note?: string } | null,
    nextBelongings: Array<{ id: string; label: string; checked: boolean }>
  ) => {
    setTripDataSaving(true);
    try {
      await fetchJsonWithFirebaseAuth('/api/trip-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parkedVehicle: nextParkedVehicle, belongings: nextBelongings }),
      });
      return true;
    } catch (e: any) {
      setError(e?.message || 'Could not save your trip data.');
      return false;
    } finally {
      setTripDataSaving(false);
    }
  };

  const saveParkingLocation = async () => {
    if (!navigator.geolocation) {
      setError('Location access is not supported by this browser.');
      return;
    }
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000,
        });
      });
      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        savedAt: new Date().toISOString(),
        ...(parkingNote.trim() ? { note: parkingNote.trim().slice(0, 160) } : {}),
      };
      if (await persistTripData(next, belongings)) {
        setParkedVehicle(next);
        setGpsFix({ lat: next.lat, lng: next.lng, timestamp: Date.now() });
        speak('Your parking location has been saved.');
      }
    } catch (e: any) {
      setError(e?.code === 1
        ? 'Location permission was not granted. Allow location access and try again.'
        : 'Could not get your current location. Please try again.');
    }
  };

  const clearParkingLocation = async () => {
    if (await persistTripData(null, belongings)) setParkedVehicle(null);
  };

  const toggleBelonging = async (id: string) => {
    const next = belongings.map((item) => item.id === id ? { ...item, checked: !item.checked } : item);
    if (await persistTripData(parkedVehicle, next)) setBelongings(next);
  };

  const addBelonging = async () => {
    const label = newBelonging.trim();
    if (!label || belongings.length >= 40) return;
    const next = [...belongings, { id: `custom-${Date.now()}`, label, checked: false }];
    if (await persistTripData(parkedVehicle, next)) setBelongings(next);
    setNewBelonging('');
  };

  const removeBelonging = async (id: string) => {
    const next = belongings.filter((item) => item.id !== id);
    if (await persistTripData(parkedVehicle, next)) setBelongings(next);
  };

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
    if (scheduledAt && (!Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.now())) {
      setError('Please choose a future date and time.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebaseAuth<any>('/api/ai-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          sector: selectedSector,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
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
      setScheduledAt('');
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
      await fetchJsonWithFirebaseAuth('/api/reminders/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: id }),
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
    setSaving(true);
    setError(null);
    try {
      await fetchJsonWithFirebaseAuth('/api/reminders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: id }),
      });
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setTriggeredReminders((prev) => prev.filter((r) => r.id !== id));
      announcedRef.current.delete(id);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete reminder.');
    } finally {
      setSaving(false);
    }
  };

  const clearTriggered = (id: string) => {
    announcedRef.current.delete(id);
    setTriggeredReminders((prev) => prev.filter((r) => r.id !== id));
    if (triggeredReminders.length === 1) setShowTriggeredPanel(false);
  };

  const sectorReminders = reminders.filter((r) => getReminderSector(r) === selectedSector);
  const activeReminders = sectorReminders.filter((r) => r.active && !r.dismissed && !r.triggered);
  const dismissedReminders = sectorReminders.filter((r) => r.dismissed);
  const locationBasedReminders = sectorReminders.filter(
    (r) => r.triggerAtKm != null || r.preArrivalKm != null || r.triggerOnArrival
  );
  const selectedSectorMeta = REMINDER_SECTORS.find((sector) => sector.id === selectedSector)!;

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

      {/* Sector navigation */}
      <div className="px-3 sm:px-5 pt-4">
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-1.5" role="tablist" aria-label="Reminder sectors">
          {REMINDER_SECTORS.map((sector) => {
            const Icon = sector.icon;
            const count = reminders.filter((reminder) => getReminderSector(reminder) === sector.id && !reminder.dismissed).length;
            const selected = selectedSector === sector.id;
            return (
              <button
                key={sector.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => { setSelectedSector(sector.id); setInput(''); setError(null); }}
                className={`min-w-0 rounded-xl px-1.5 py-2.5 sm:px-3 transition flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 ${selected ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 shadow-lg shadow-cyan-950/20' : 'text-slate-400 border border-transparent hover:bg-slate-800/70 hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold leading-tight">{sector.label}</span>
                <span className={`text-[9px] tabular-nums rounded-full px-1.5 py-0.5 ${selected ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-800 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">{selectedSectorMeta.description}</p>
      </div>

      {/* Context tools are shown only in the relevant sector */}
      {selectedSector === 'vehicle' && (
        <div className="px-3 sm:px-5 pt-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Car className="w-4 h-4" /></div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white">Parked vehicle</h4>
                <p className="text-[10px] text-slate-500">Save where you parked for later</p>
              </div>
            </div>
            {parkedVehicle ? (
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 space-y-1">
                <p className="text-[10px] text-emerald-300 font-semibold">Parking location saved</p>
                <p className="text-[10px] text-slate-400">{new Date(parkedVehicle.savedAt).toLocaleString()}</p>
                {parkedVehicle.note && <p className="text-[10px] text-slate-300">Note: {parkedVehicle.note}</p>}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a href={`https://www.google.com/maps?q=${parkedVehicle.lat},${parkedVehicle.lng}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-300 underline underline-offset-2">Open saved location</a>
                  <button type="button" onClick={clearParkingLocation} disabled={tripDataSaving} className="text-[10px] text-slate-400 hover:text-rose-300 disabled:opacity-50">Clear</button>
                </div>
              </div>
            ) : <p className="text-[10px] text-slate-400">No parking location saved yet.</p>}
            <input value={parkingNote} onChange={(event) => setParkingNote(event.target.value)} maxLength={160} placeholder="Optional note (e.g. Level B2, bay 18)" aria-label="Optional parking note" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500" />
            <button type="button" onClick={saveParkingLocation} disabled={tripDataSaving} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50">
              {tripDataSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Locate className="w-3.5 h-3.5" />} Save current location
            </button>
            <p className="text-[9px] leading-relaxed text-slate-500">Saves one parking spot only; it does not track a moving vehicle.</p>
          </div>
        </div>
      )}

      {selectedSector === 'belongings' && (
        <div className="px-3 sm:px-5 pt-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>
              <div><h4 className="text-xs font-bold text-white">Your checklist</h4><p className="text-[10px] text-slate-500">Tick items as you pack or check them</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {belongings.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleBelonging(item.id)} disabled={tripDataSaving} className="accent-emerald-500 w-4 h-4" aria-label={`Mark ${item.label} as ${item.checked ? 'not packed' : 'packed'}`} />
                  <span className={`flex-1 min-w-0 text-xs ${item.checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{item.label}</span>
                  <button type="button" onClick={() => removeBelonging(item.id)} disabled={tripDataSaving} className="p-1 text-slate-600 hover:text-rose-300 disabled:opacity-40" aria-label={`Remove ${item.label}`}><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newBelonging} onChange={(e) => setNewBelonging(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBelonging()} maxLength={80} placeholder="Add something to your checklist" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" />
              <button type="button" onClick={addBelonging} disabled={tripDataSaving || !newBelonging.trim() || belongings.length >= 40} className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 text-cyan-300 disabled:opacity-40" aria-label="Add belongings item"><Plus className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-slate-500">{belongings.filter((item) => item.checked).length} of {belongings.length} checked · Saved to your account</p>
          </div>
        </div>
      )}

      {selectedSector === 'travel' && routePlan && (
        <div className="px-3 sm:px-5 pt-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3 flex flex-wrap items-center gap-2 text-[10px]">
            <Plane className="w-4 h-4 text-cyan-300" />
            <span className="text-slate-300 font-semibold">{routePlan.origin?.name || 'Your route'}</span>
            <span className="text-slate-600">→</span>
            <span className="text-slate-300 font-semibold">{routePlan.destination?.name || 'Destination'}</span>
            {routePlan.totalDistanceKm != null && <span className="ml-auto text-slate-500">{Math.round(routePlan.totalDistanceKm)} km</span>}
          </div>
        </div>
      )}

      {/* Quick AI input */}
      <div className="px-3 sm:px-5 pt-4 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white">What should I remind you about?</h4>
            <p className="text-[10px] text-slate-500">Type naturally or use your voice. AI will organize it for you.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative w-full min-w-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1200}
              placeholder={selectedSectorMeta.example}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-12 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button type="button" onClick={startVoice} disabled={voiceActive || loading} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition ${voiceActive ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`} title="Speak your reminder" aria-label="Speak your reminder">
              {voiceActive ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 min-w-0">
              <span className="mb-1 block text-[10px] font-semibold text-slate-400">Choose date & time <span className="font-normal text-slate-500">(optional — AI can suggest if left blank)</span></span>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                aria-label="Optional reminder date and time"
              />
            </label>
            <button type="submit" disabled={loading || !input.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 sm:mt-5 sm:min-w-[142px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {loading ? 'Creating…' : 'Create reminder'}
            </button>
          </div>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {selectedSector === 'vehicle' && ['Service my vehicle next month', 'Renew my insurance', 'Check tyre pressure before a trip'].map((example) => (
            <button key={example} type="button" onClick={() => setInput(example)} className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[9px] text-slate-400 hover:text-cyan-200 hover:border-cyan-500/40">{example}</button>
          ))}
          {selectedSector === 'belongings' && ['Remind me to pack my charger', 'Check my documents before leaving', 'Do not forget my luggage'].map((example) => (
            <button key={example} type="button" onClick={() => setInput(example)} className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[9px] text-slate-400 hover:text-cyan-200 hover:border-cyan-500/40">{example}</button>
          ))}
          {selectedSector === 'travel' && ['Leave at 5 AM', 'Stop for fuel before Pokhara', 'Remind me before reaching my destination'].map((example) => (
            <button key={example} type="button" onClick={() => setInput(example)} className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[9px] text-slate-400 hover:text-cyan-200 hover:border-cyan-500/40">{example}</button>
          ))}
          {selectedSector === 'other' && ['Pay my bill on Friday', 'Appointment tomorrow at 10 AM', 'Submit my report next week'].map((example) => (
            <button key={example} type="button" onClick={() => setInput(example)} className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[9px] text-slate-400 hover:text-cyan-200 hover:border-cyan-500/40">{example}</button>
          ))}
        </div>
        {showVoiceHint && <p className="text-[10px] text-slate-500 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Voice input is optional — typing works too.</p>}
        {error && <div className="flex items-start gap-2 p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl"><AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /><span className="text-[11px] text-rose-300">{error}</span></div>}
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
            Choose a sector, enter a simple request, and Mero Sadak AI will create a reminder for it.
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