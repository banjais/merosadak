import React, { useState, useEffect, useMemo } from 'react';
import { RoutePlanResult, VehicleType, RoutePreference, TripAssistantPlan, TripAssistantStop, TripStopCategory } from '../types';
import {
  Sparkles,
  Coffee,
  Mountain,
  Camera,
  Utensils,
  Zap,
  MapPin,
  Clock,
  Star,
  Compass,
  ArrowRight,
  Info,
  CheckCircle2,
  RefreshCw,
  Send,
  Loader2,
  MessageSquare,
  HelpCircle,
  Car,
  Fuel,
  ThumbsUp,
  Bookmark,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Landmark,
  ShieldCheck,
} from 'lucide-react';

interface TripAssistantPanelProps {
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
  preference: RoutePreference;
  onHighlightPOI?: (lat: number, lng: number, name: string) => void;
}

const CATEGORY_META: Record<
  TripStopCategory,
  { label: string; icon: any; color: string; badgeBg: string; border: string }
> = {
  scenic_viewpoint: {
    label: 'Scenic Viewpoint',
    icon: Mountain,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-950/60 text-purple-300',
    border: 'border-purple-800/40',
  },
  cafe_dining: {
    label: 'Cafe & Dining',
    icon: Coffee,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-950/60 text-amber-300',
    border: 'border-amber-800/40',
  },
  rest_stop: {
    label: 'Rest & Service Area',
    icon: Fuel,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-950/60 text-cyan-300',
    border: 'border-cyan-800/40',
  },
  cultural_heritage: {
    label: 'Cultural & Historic',
    icon: Landmark,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/60 text-emerald-300',
    border: 'border-emerald-800/40',
  },
  ev_charging: {
    label: 'EV Fast Charging',
    icon: Zap,
    color: 'text-teal-400',
    badgeBg: 'bg-teal-950/60 text-teal-300',
    border: 'border-teal-800/40',
  },
};

export const TripAssistantPanel: React.FC<TripAssistantPanelProps> = ({
  routePlan,
  vehicle,
  preference,
  onHighlightPOI,
}) => {
  const [tripPlan, setTripPlan] = useState<TripAssistantPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | TripStopCategory>('all');
  const [userQuery, setUserQuery] = useState<string>('');
  const [queryLoading, setQueryLoading] = useState<boolean>(false);
  const [savedStopIds, setSavedStopIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Suggested prompt chips for instant assistance
  const quickQuestions = [
    '☕ Best artisanal coffee & clean restrooms?',
    '📸 Top scenic photography spot for mountain views?',
    '🍱 Where to stop for authentic local Thakali lunch?',
    '🔌 EV Fast charger with pleasant dining nearby?',
    '🚗 Safe spot to let vehicle brakes cool down on switchbacks?',
  ];

  // Fetch AI recommendations when route changes
  const fetchTripPlan = async (customQuestion?: string) => {
    if (customQuestion) {
      setQueryLoading(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('/api/ai-trip-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: routePlan.origin.name,
          destination: routePlan.destination.name,
          originDistrict: routePlan.origin.district,
          destinationDistrict: routePlan.destination.district,
          vehicle,
          preference,
          distanceKm: routePlan.totalDistanceKm,
          timeHours: (routePlan.estimatedTimeMinutes / 60).toFixed(1),
          elevationGainM: routePlan.elevationGainM,
          highwaysTraversed: routePlan.steps
            .map((s) => s.highwayCode)
            .filter((code, idx, arr) => code && arr.indexOf(code) === idx),
          focusFilter: activeCategoryFilter,
          customQuestion: customQuestion || undefined,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.tripPlan) {
          setTripPlan((prev) => {
            if (!prev || !customQuestion) return data.tripPlan;
            return {
              ...prev,
              customAnswer: data.tripPlan.customAnswer || prev.customAnswer,
              suggestedStops: data.tripPlan.suggestedStops?.length ? data.tripPlan.suggestedStops : prev.suggestedStops,
            };
          });
        }
      } else {
        console.warn('AI Trip Assistant returned non-JSON or error status:', response.status);
      }
    } catch (err) {
      console.warn('AI Trip Assistant network/parse notice:', err);
    } finally {
      setLoading(false);
      setQueryLoading(false);
    }
  };

  // Auto-fetch initial recommendations on route load
  useEffect(() => {
    fetchTripPlan();
  }, [routePlan.origin.id, routePlan.destination.id, vehicle, preference]);

  // Filtered stops
  const displayedStops = useMemo(() => {
    if (!tripPlan?.suggestedStops) return [];
    if (activeCategoryFilter === 'all') return tripPlan.suggestedStops;
    return tripPlan.suggestedStops.filter((s) => s.category === activeCategoryFilter);
  }, [tripPlan, activeCategoryFilter]);

  const handleToggleSave = (stopId: string) => {
    setSavedStopIds((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  };

  const handleCopyStop = (stop: TripAssistantStop) => {
    const text = `📍 ${stop.name}\n📌 Location: ${stop.locationName}\n📏 Milestone: ~${stop.approxKmFromOrigin} km from ${routePlan.origin.name} (${stop.approxTravelTime})\n✨ Highlights: ${stop.highlights}\n💡 Pro-Tip: ${stop.proTip}`;
    navigator.clipboard.writeText(text);
    setCopiedId(stop.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAskQuickQuestion = (q: string) => {
    setUserQuery(q);
    fetchTripPlan(q);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    fetchTripPlan(userQuery);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-5 p-5 md:p-6" id="ai-trip-assistant-panel">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-bold text-white font-display">
                AI Trip Assistant & Highway Concierge
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                <span>Gemini 3.7 Flash</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Curated stops, riverfront cafes, scenic ridge viewpoints & local food stops along your route to{' '}
              <strong className="text-cyan-300">{routePlan.destination.name}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchTripPlan()}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center justify-center space-x-1.5 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Curating Stops...' : 'Regenerate Suggestions'}</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && !tripPlan && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs font-semibold text-slate-300">
            Analyzing highway terrain, scenic viewpoints & local food stops...
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm">
            Scanning {routePlan.origin.name} ➔ {routePlan.destination.name} corridor ({routePlan.totalDistanceKm} km)
          </p>
        </div>
      )}

      {tripPlan && (
        <div className="space-y-6">
          {/* Destination Briefing Card */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-inner">
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
              <MapPin className="w-4 h-4" />
              <span>Destination Arrival Intelligence • {routePlan.destination.name}</span>
            </div>

            <p className="text-sm font-semibold text-slate-200 mb-4 leading-relaxed">
              "{tripPlan.destinationOverview?.tagline}"
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
              {/* Must Do */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Must-Do On Arrival</span>
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {tripPlan.destinationOverview?.mustDoUponArrival}
                </p>
              </div>

              {/* Local Specialty */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center space-x-1">
                  <Utensils className="w-3 h-3" />
                  <span>Must-Try Local Food</span>
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {tripPlan.destinationOverview?.localSpecialty}
                </p>
              </div>

              {/* Parking Guidance */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center space-x-1">
                  <Car className="w-3 h-3" />
                  <span>Parking & City Access</span>
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {tripPlan.destinationOverview?.parkingTip}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Category Filter Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Recommended Stops Along Highway ({displayedStops.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {savedStopIds.size} saved to itinerary
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeCategoryFilter === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span>🌟 All Recommendations</span>
              </button>

              <button
                onClick={() => setActiveCategoryFilter('scenic_viewpoint')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeCategoryFilter === 'scenic_viewpoint'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Mountain className="w-3.5 h-3.5 text-purple-400" />
                <span>Scenic Viewpoints</span>
              </button>

              <button
                onClick={() => setActiveCategoryFilter('cafe_dining')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeCategoryFilter === 'cafe_dining'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Cafes & Dhabas</span>
              </button>

              <button
                onClick={() => setActiveCategoryFilter('rest_stop')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeCategoryFilter === 'rest_stop'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Fuel className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rest & Service Areas</span>
              </button>

              <button
                onClick={() => setActiveCategoryFilter('cultural_heritage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeCategoryFilter === 'cultural_heritage'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                <span>Culture & Heritage</span>
              </button>
            </div>
          </div>

          {/* List of Recommended Stops */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedStops.map((stop, idx) => {
              const meta = CATEGORY_META[stop.category] || CATEGORY_META.scenic_viewpoint;
              const Icon = meta.icon;
              const isSaved = savedStopIds.has(stop.id);
              const isCopied = copiedId === stop.id;

              return (
                <div
                  key={stop.id || idx}
                  className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition space-y-3.5 relative overflow-hidden group shadow-md"
                >
                  {/* Category Pill & Distance Marker */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${meta.badgeBg} ${meta.border}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{meta.label}</span>
                    </span>

                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                      <span className="bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300 font-bold">
                        📍 ~{stop.approxKmFromOrigin} km
                      </span>
                      <span className="text-slate-500">•</span>
                      <span>⏱️ {stop.approxTravelTime}</span>
                    </div>
                  </div>

                  {/* Stop Name & Location */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-white font-display group-hover:text-emerald-400 transition">
                        {stop.name}
                      </h4>
                      <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{stop.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{stop.locationName}</span>
                    </div>
                  </div>

                  {/* Highlights Description */}
                  <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                    {stop.highlights}
                  </div>

                  {/* Pro Tip Box */}
                  <div className="text-[11px] text-amber-300/90 bg-amber-950/20 border border-amber-800/30 p-2.5 rounded-xl flex items-start space-x-2">
                    <span className="font-bold text-amber-400 shrink-0">💡 Pro-Tip:</span>
                    <span>{stop.proTip}</span>
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Best For: <strong className="text-slate-200">{stop.bestFor}</strong>
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleCopyStop(stop)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                        title="Copy stop details"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleToggleSave(stop.id)}
                        className={`p-1.5 rounded-lg border transition ${
                          isSaved
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
                        }`}
                        title={isSaved ? 'Remove from saved' : 'Save to trip itinerary'}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          const q = `Tell me more details about stopping at ${stop.name} (${stop.locationName}) on my trip to ${routePlan.destination.name}`;
                          setUserQuery(q);
                          fetchTripPlan(q);
                        }}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 text-[11px] font-bold rounded-lg border border-slate-800 transition flex items-center space-x-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Ask AI</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ask AI Trip Concierge Interactive Box */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-display">Ask the AI Highway Concierge</h4>
                <p className="text-[11px] text-slate-400">
                  Ask any question about stops, cafes, restrooms, food specialties, or road conditions
                </p>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuickQuestion(q)}
                  disabled={queryLoading}
                  className="px-2.5 py-1 text-[11px] bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* User Input Form */}
            <form onSubmit={handleCustomSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={`Ask anything about stopping along the ${routePlan.origin.name} ➔ ${routePlan.destination.name} highway...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={queryLoading || !userQuery.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 shadow-md shadow-emerald-500/20"
              >
                {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{queryLoading ? 'Thinking...' : 'Ask Assistant'}</span>
              </button>
            </form>

            {/* Custom Answer Display Box */}
            {tripPlan.customAnswer && (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Concierge Response:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Live Guidance</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {tripPlan.customAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Corridor Traveler Tips */}
          {tripPlan.travelerTips && tripPlan.travelerTips.length > 0 && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Highway Route Essentials & Practical Advice:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                {tripPlan.travelerTips.map((tip, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
