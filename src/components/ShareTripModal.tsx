import React, { useState, useMemo } from 'react';
import { RoutePlanResult, VehicleType, RoutePreference } from '../types';
import {
  X,
  Share2,
  Copy,
  Check,
  MapPin,
  ArrowRight,
  Clock,
  Compass,
  Mountain,
  Fuel,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Car,
  Bike,
  Truck,
  ExternalLink,
  MessageSquare,
  Send,
  Mail,
  QrCode,
  Sparkles,
  DollarSign,
  Receipt,
  Ticket,
} from 'lucide-react';

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
  preference: RoutePreference;
  customTripCost?: number;
}

const VEHICLE_LABELS: Record<VehicleType, { label: string; icon: any }> = {
  car: { label: 'Car / Sedan', icon: Car },
  suv_4wd: { label: 'SUV / 4WD Jeep', icon: Mountain },
  motorbike: { label: 'Motorcycle / Scooter', icon: Bike },
  bus_truck: { label: 'Bus / Heavy Truck', icon: Truck },
  electric_vehicle: { label: 'Electric Vehicle (EV)', icon: Zap },
};

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  isOpen,
  onClose,
  routePlan,
  vehicle,
  preference,
  customTripCost,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Generate shareable URL
  const shareableUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const params = new URLSearchParams();
    params.set('origin', routePlan.origin.id);
    params.set('dest', routePlan.destination.id);
    params.set('vehicle', vehicle);
    params.set('pref', preference);
    params.set('tab', 'route');
    return `${origin}${pathname}?${params.toString()}`;
  }, [routePlan, vehicle, preference]);

  // Total estimated trip cost (fuel + tolls + emergency assistance baseline)
  const estimatedTotalCost = useMemo(() => {
    if (customTripCost && customTripCost > 0) return customTripCost;
    const fuelCost = routePlan.fuelEstimate?.costNpr || 0;
    const tollCost = routePlan.totalTollCostNpr || 60;
    const emergencyAssist = 350; // default recovery standby
    return fuelCost + tollCost + emergencyAssist;
  }, [customTripCost, routePlan]);

  const durationFormatted = useMemo(() => {
    const hours = Math.floor(routePlan.estimatedTimeMinutes / 60);
    const mins = routePlan.estimatedTimeMinutes % 60;
    return `${hours}h ${mins}m`;
  }, [routePlan.estimatedTimeMinutes]);

  const VehicleIcon = VEHICLE_LABELS[vehicle]?.icon || Car;
  const vehicleName = VEHICLE_LABELS[vehicle]?.label || 'Vehicle';

  // Formatted share text for messaging apps
  const shareableText = useMemo(() => {
    const avgGrade = Math.min(15, Math.max(0.5, Math.round((routePlan.elevationGainM / Math.max(1, routePlan.totalDistanceKm * 1000)) * 100 * 2.2 * 10) / 10));
    return `🛣️ NEPAL HIGHWAY TRIP PLAN: ${routePlan.origin.name} ➔ ${routePlan.destination.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 From: ${routePlan.origin.name} (${routePlan.origin.district} - ${routePlan.origin.elevationM}m)
🏁 To: ${routePlan.destination.name} (${routePlan.destination.district} - ${routePlan.destination.elevationM}m)
📏 Distance: ${routePlan.totalDistanceKm} km
⏱️ Duration: ${durationFormatted} (including caution buffers)
🚗 Vehicle: ${vehicleName}
💰 Total Est. Trip Cost: Rs. ${estimatedTotalCost.toLocaleString()} (Fuel, Tolls & Roadside Assistance)
🛡️ Road Safety Score: ${routePlan.roadConditionScore}/100
🏔️ Climb: +${routePlan.elevationGainM}m (~${avgGrade}% grade, Peak: ${routePlan.maxElevationM}m ASL)
⚠️ Active Advisories: ${routePlan.incidentsOnRoute.length} incident(s) reported
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Live Map & Navigation: ${shareableUrl}
🇳🇵 Generated via Mero Sadak Nepal Highway GIS`;
  }, [routePlan, vehicleName, durationFormatted, estimatedTotalCost, shareableUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(shareableText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip Plan: ${routePlan.origin.name} to ${routePlan.destination.name}`,
          text: shareableText,
          url: shareableUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  // Share links
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareableText)}`;
  const viberUrl = `viber://forward?text=${encodeURIComponent(shareableText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareableUrl)}&text=${encodeURIComponent(`Route Plan: ${routePlan.origin.name} to ${routePlan.destination.name} (${routePlan.totalDistanceKm} km, ~Rs. ${estimatedTotalCost.toLocaleString()})`)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`Nepal Highway Trip: ${routePlan.origin.name} to ${routePlan.destination.name}`)}&body=${encodeURIComponent(shareableText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        id="share-trip-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Share Highway Trip Plan</h3>
              <p className="text-xs text-slate-400">
                Shareable link, travel summary card & itinerary for passengers and drivers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Visual Trip Summary Card / Digital Itinerary Ticket */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 shadow-inner relative overflow-hidden space-y-4">
            {/* Background glowing watermarks */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Ticket Header & Status Pill */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  Mero Sadak Itinerary
                </span>
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <VehicleIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{vehicleName}</span>
                </span>
              </div>

              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold bg-slate-900/90 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Safety {routePlan.roadConditionScore}/100</span>
              </div>
            </div>

            {/* Origin to Destination Route Display */}
            <div className="flex items-center justify-between gap-3 py-1">
              {/* Origin */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Origin</span>
                <div className="text-xl font-black text-white font-display">{routePlan.origin.name}</div>
                <div className="text-[11px] text-slate-400">
                  {routePlan.origin.district} • {routePlan.origin.elevationM}m alt
                </div>
              </div>

              {/* Arrow Connector with Highway & Distance Badge */}
              <div className="flex flex-col items-center px-2">
                <span className="text-[10px] font-mono text-slate-400 font-bold mb-1">
                  {routePlan.totalDistanceKm} KM
                </span>
                <div className="flex items-center space-x-1 w-24 sm:w-32">
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
                  <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                </div>
                <span className="text-[9px] text-slate-500 mt-1 capitalize">{preference.replace('_', ' ')} Route</span>
              </div>

              {/* Destination */}
              <div className="text-right space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">Destination</span>
                <div className="text-xl font-black text-white font-display">{routePlan.destination.name}</div>
                <div className="text-[11px] text-slate-400">
                  {routePlan.destination.district} • {routePlan.destination.elevationM}m alt
                </div>
              </div>
            </div>

            {/* Bento Key Highlight Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
              {/* Duration */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-medium">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Duration</span>
                </span>
                <div className="text-base font-bold text-cyan-300 font-display mt-0.5">
                  {durationFormatted}
                </div>
              </div>

              {/* Estimated Total Trip Cost */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/30">
                <span className="text-[10px] text-amber-400 flex items-center space-x-1 font-bold">
                  <DollarSign className="w-3 h-3" />
                  <span>Est. Trip Cost</span>
                </span>
                <div className="text-base font-black text-amber-300 font-display mt-0.5">
                  Rs. {estimatedTotalCost.toLocaleString()}
                </div>
              </div>

              {/* Elevation Gain & Climb Grade */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-medium">
                  <Mountain className="w-3 h-3 text-purple-400" />
                  <span>Climb & Grade</span>
                </span>
                <div className="text-base font-bold text-purple-300 font-display mt-0.5 flex items-baseline space-x-1">
                  <span>+{routePlan.elevationGainM}m</span>
                  <span className="text-[11px] font-semibold text-amber-400">
                    (~{Math.min(15, Math.max(0.5, Math.round((routePlan.elevationGainM / Math.max(1, routePlan.totalDistanceKm * 1000)) * 100 * 2.2 * 10) / 10))}%)
                  </span>
                </div>
              </div>

              {/* Active Road Hazards */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Advisories</span>
                </span>
                <div className={`text-base font-bold font-display mt-0.5 ${routePlan.incidentsOnRoute.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {routePlan.incidentsOnRoute.length > 0 ? `${routePlan.incidentsOnRoute.length} caution(s)` : 'Clear Route'}
                </div>
              </div>
            </div>
          </div>

          {/* Shareable Link Input with Copy Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Direct Shareable Link (Auto-loads route & map):</span>
              <span className="text-[10px] text-slate-500">Persistent Query Link</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500 select-all"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 shadow-md ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Instant Messaging & Social Channels */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Share via Instant Channels:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </a>

              {/* Viber */}
              <a
                href={viberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Send className="w-4 h-4 text-purple-400" />
                <span>Viber</span>
              </a>

              {/* Telegram */}
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/40 text-sky-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>Telegram</span>
              </a>

              {/* Email */}
              <a
                href={mailUrl}
                className="p-2.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Mail className="w-4 h-4 text-slate-300" />
                <span>Email Itinerary</span>
              </a>
            </div>
          </div>

          {/* Quick Copy Formatted Itinerary Text */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>Formatted Carpool & Travel Text Summary</span>
              </span>
              <button
                onClick={handleCopyText}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 transition"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Summary Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36">
              {shareableText}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Mero Sadak Nepal Highway GIS • Real-time traffic, tolls & road updates
          </span>
          <div className="flex items-center space-x-2">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Share</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
