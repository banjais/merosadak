import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
 X,
 AlertOctagon,
 MapPin,
 Compass,
 PhoneCall,
 Share2,
 Copy,
 Check,
 Send,
 MessageSquare,
 Volume2,
 VolumeX,
 Zap,
 Car,
 Mountain,
 Bike,
 Truck,
 Flame,
 ShieldAlert,
 Radio,
 RefreshCw,
 ExternalLink,
 Users,
 HelpCircle,
 FileText,
 AlertTriangle,
 LocateFixed,
 Eye,
 Info,
 Activity,
 Play,
 Square,
 Sparkles,
} from 'lucide-react';
import { RoutePlanResult, VehicleType, EmergencyDistressType } from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import {
 NEPAL_EMERGENCY_HOTLINES,
 DISTRESS_TYPE_CONFIG,
 findNearestLandmark,
 formatCoordinates,
 generateFullSosMessage,
 generateCompactSms,
 sosAudioAlert,
 SosAlarmMode,
} from '../utils/sosEmergencyHelper';

interface SosEmergencyModalProps {
 isOpen: boolean;
 onClose: () => void;
 activeRoute: RoutePlanResult | null;
 defaultVehicle?: VehicleType;
 onFocusCoordinatesOnMap?: (lat: number, lng: number, title: string) => void;
}

export const SosEmergencyModal: React.FC<SosEmergencyModalProps> = ({
 isOpen,
 onClose,
 activeRoute,
 defaultVehicle = 'car',
 onFocusCoordinatesOnMap,
}) => {
 // Geolocation state
 const [lat, setLat] = useState<number | null>(null);
 const [lng, setLng] = useState<number | null>(null);
 const [accuracy, setAccuracy] = useState<number | null>(null);
 const [altitude, setAltitude] = useState<number | null>(null);
 const [isLocating, setIsLocating] = useState<boolean>(false);
 const [geoError, setGeoError] = useState<string | null>(null);
 const [locationTimestamp, setLocationTimestamp] = useState<Date | null>(null);

 // Manual fallback selection if GPS is denied or unavailable
 const [manualCityId, setManualCityId] = useState<string>('mgl');
 const [useManualLocation, setUseManualLocation] = useState<boolean>(false);

 // Emergency Form State
 const [distressType, setDistressType] = useState<EmergencyDistressType>('accident');
 const [customNotes, setCustomNotes] = useState<string>('');
 const [vehicleType, setVehicleType] = useState<VehicleType>(defaultVehicle);
 const [vehiclePlate, setVehiclePlate] = useState<string>('');
 const [passengerCount, setPassengerCount] = useState<number>(2);
 const [customPhone, setCustomPhone] = useState<string>('');

 // UI state
 const [copiedText, setCopiedText] = useState<boolean>(false);
 const [messageFormat, setMessageFormat] = useState<'full' | 'compact'>('full');
 const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
 const [alarmMode, setAlarmMode] = useState<SosAlarmMode>('high_frequency');
 const [alertSignalMode, setAlertSignalMode] = useState<'sound' | 'visual'>('sound');
 const [isStrobeActive, setIsStrobeActive] = useState<boolean>(false);
 const [strobeState, setStrobeState] = useState<boolean>(false);
 const [activeTab, setActiveTab] = useState<'alert' | 'messages' | 'help'>('alert');

 // Battery API status
 const [batteryPercent, setBatteryPercent] = useState<number | null>(null);

 // Update vehicle type when defaultVehicle changes
 useEffect(() => {
 if (defaultVehicle) {
 setVehicleType(defaultVehicle);
 }
 }, [defaultVehicle]);

 // Request browser geolocation
 const acquireLocation = useCallback(() => {
 if (typeof window === 'undefined' || !navigator.geolocation) {
 setGeoError('Geolocation is not supported by your browser.');
 setUseManualLocation(true);
 return;
 }

 setIsLocating(true);
 setGeoError(null);

 navigator.geolocation.getCurrentPosition(
 (pos) => {
 setLat(pos.coords.latitude);
 setLng(pos.coords.longitude);
 setAccuracy(pos.coords.accuracy);
 setAltitude(pos.coords.altitude);
 setLocationTimestamp(new Date(pos.timestamp));
 setIsLocating(false);
 setUseManualLocation(false);
 },
 (err) => {
 setIsLocating(false);
 let msg = 'Unable to retrieve your location.';
 if (err.code === err.PERMISSION_DENIED) {
 msg = 'Location permission was denied. You can select your approximate Nepal location below.';
 } else if (err.code === err.POSITION_UNAVAILABLE) {
 msg = 'GPS satellite fix unavailable. You can choose your nearest checkpoint.';
 } else if (err.code === err.TIMEOUT) {
 msg = 'GPS request timed out. Please retry or pick a known highway checkpoint.';
 }
 setGeoError(msg);
 setUseManualLocation(true);

 // Fallback default coordinates if not already set (e.g. Mugling or Route midpoint)
 if (lat === null || lng === null) {
 if (activeRoute && activeRoute.origin) {
 setLat(activeRoute.origin.lat);
 setLng(activeRoute.origin.lng);
 } else {
 setLat(27.8617); // Mugling
 setLng(84.5542);
 }
 }
 },
 {
 enableHighAccuracy: true,
 timeout: 12000,
 maximumAge: 0,
 }
 );
 }, [activeRoute, lat, lng]);

 // Check battery status if available
 useEffect(() => {
 if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
 (navigator as unknown as { getBattery: () => Promise<{ level: number }> })
 .getBattery()
 .then((battery) => {
 setBatteryPercent(Math.round(battery.level * 100));
 })
 .catch(() => {});
 }
 }, []);

 // Acquire location when opened
 useEffect(() => {
 if (isOpen) {
 acquireLocation();
 } else {
 // Stop audio & strobe when closed
 sosAudioAlert.stop();
 setIsAudioPlaying(false);
 setIsStrobeActive(false);
 }
 }, [isOpen, acquireLocation]);

 // Strobe effect timer
 useEffect(() => {
 if (!isStrobeActive) return;
 const interval = setInterval(() => {
 setStrobeState((prev) => !prev);
 }, 250);
 return () => clearInterval(interval);
 }, [isStrobeActive]);

 // Handle manual city selection
 const handleManualCityChange = (cityId: string) => {
 setManualCityId(cityId);
 const city = CITIES_AND_JUNCTIONS.find((c) => c.id === cityId);
 if (city) {
 setLat(city.lat);
 setLng(city.lng);
 setAccuracy(50);
 setAltitude(city.elevationM);
 setLocationTimestamp(new Date());
 }
 };

 // Current active coordinates to use
 const currentLat = lat ?? 27.8617;
 const currentLng = lng ?? 84.5542;

 // Nearest landmark calculation
 const nearestLandmark = useMemo(() => {
 return findNearestLandmark(currentLat, currentLng);
 }, [currentLat, currentLng]);

 // Generated SOS text
 const fullSosMessage = useMemo(() => {
 return generateFullSosMessage({
 lat: currentLat,
 lng: currentLng,
 accuracyM: accuracy ?? undefined,
 altitudeM: altitude ?? nearestLandmark.city.elevationM,
 distressType,
 customNotes: customNotes.trim() || undefined,
 vehicleType,
 vehiclePlateNumber: vehiclePlate.trim() || undefined,
 passengerCount,
 activeRoute,
 batteryPercent,
 });
 }, [
 currentLat,
 currentLng,
 accuracy,
 altitude,
 nearestLandmark,
 distressType,
 customNotes,
 vehicleType,
 vehiclePlate,
 passengerCount,
 activeRoute,
 batteryPercent,
 ]);

 const compactSosMessage = useMemo(() => {
 return generateCompactSms({
 lat: currentLat,
 lng: currentLng,
 distressType,
 customNotes: customNotes.trim() || undefined,
 vehicleType,
 passengerCount,
 });
 }, [currentLat, currentLng, distressType, customNotes, vehicleType, passengerCount]);

 const activeMessageText = messageFormat === 'full' ? fullSosMessage : compactSosMessage;

 // Copy to clipboard
 const handleCopy = () => {
 navigator.clipboard.writeText(activeMessageText);
 setCopiedText(true);
 setTimeout(() => setCopiedText(false), 2500);
 };

 // WhatsApp Dispatch
 const handleSendWhatsApp = () => {
 let url = `https://wa.me/?text=${encodeURIComponent(activeMessageText)}`;
 if (customPhone.trim()) {
 const sanitized = customPhone.replace(/\D/g, '');
 url = `https://wa.me/${sanitized}?text=${encodeURIComponent(activeMessageText)}`;
 }
 window.open(url, '_blank', 'noopener,noreferrer');
 };

 // SMS Dispatch
 const handleSendSms = () => {
 const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
 const separator = isIOS ? '&' : '?';
 const targetRecipient = customPhone.trim() ? customPhone.replace(/\D/g, '') : '';
 const smsUrl = `sms:${targetRecipient}${separator}body=${encodeURIComponent(activeMessageText)}`;
 window.location.href = smsUrl;
 };

 // Telegram Dispatch
 const handleSendTelegram = () => {
 const url = `https://t.me/share/url?url=${encodeURIComponent(`https://maps.google.com/?q=${currentLat.toFixed(5)},${currentLng.toFixed(5)}`)}&text=${encodeURIComponent(activeMessageText)}`;
 window.open(url, '_blank', 'noopener,noreferrer');
 };


 // Messenger cannot accept a prefilled message from a standard web share URL.
 const handleSendMessenger = () => {
  window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
  void navigator.clipboard?.writeText(activeMessageText).then(() => setCopiedText(true)).catch(() => {});
 };

 // Toggle Audio Siren / Sound
 const toggleAudioSiren = (modeToPlay: SosAlarmMode = alarmMode) => {
 if (isAudioPlaying && alarmMode === modeToPlay) {
 sosAudioAlert.stop();
 setIsAudioPlaying(false);
 } else {
 setAlarmMode(modeToPlay);
 sosAudioAlert.start(modeToPlay);
 setIsAudioPlaying(true);
 }
 };

 // Toggle Optical Strobe Alert
 const toggleStrobe = () => {
 setIsStrobeActive((prev) => !prev);
 };

 // Whether SOS Alert is actively on (either sound, flash, or both)
 const isAlertActive = isAudioPlaying || isStrobeActive;


 const handleDeactivateAlert = () => {
 sosAudioAlert.stop();
 setIsAudioPlaying(false);
 setIsStrobeActive(false);
 };

 if (!isOpen) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto scrollbar-paddle animate-fadeIn"
 id="emergency-sos-modal"
 >
 {/* Fullscreen Strobe Visual Alert (if active) */}
 {isStrobeActive && (
 <div
 onClick={() => setIsStrobeActive(false)}
 className={`fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer transition-colors duration-100 ${
 strobeState ? 'bg-red-600 text-white' : 'bg-white text-red-600'
 }`}
 >
 <div className="text-center p-6 rounded-3xl backdrop-blur-sm bg-black/40 text-white max-w-md">
 <AlertOctagon className="w-20 h-20 mx-auto mb-4 animate-bounce text-red-400" />
 <h2 className="text-3xl font-black tracking-wider uppercase mb-2">🚨 RESCUE BEACON 🚨</h2>
 <p className="text-sm font-semibold opacity-90 mb-4">
 Flashing maximum contrast signal for helicopters, rescue teams, and highway traffic.
 </p>
 <button
 onClick={(e) => {
 e.stopPropagation();
 setIsStrobeActive(false);
 }}
 className="px-6 py-2.5 rounded-full bg-white text-red-700 font-bold text-sm shadow-xl hover:bg-slate-100"
 >
 Stop alert
 </button>
 </div>
 </div>
 )}

 <div className="bg-slate-900 border-2 border-red-600/70 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto h-[94dvh] max-h-[860px]">

 {/* SOS identity + live location header */}
 <div className="shrink-0 border-b border-red-800/60 bg-gradient-to-br from-red-950 via-slate-950 to-slate-900 px-4 py-3 sm:px-6 sm:py-4">
  <div className="flex items-center justify-between gap-3">
   <div className="flex min-w-0 items-center gap-3">
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-950/50">
     <AlertOctagon className="h-6 w-6" />
     <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-red-300 animate-pulse" />
    </div>
    <div className="min-w-0">
     <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">SOS</div>
     <h2 className="truncate text-lg font-black tracking-tight text-white sm:text-xl">SOS Emergency Assist</h2>
    </div>
   </div>
   <button onClick={onClose} className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close SOS Dialog">
    <X className="h-5 w-5" />
   </button>
  </div>

  <div className="mt-3 rounded-xl border border-emerald-900/60 bg-slate-950/75 p-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2">
     <span className={`h-2.5 w-2.5 rounded-full ${isLocating ? 'animate-ping bg-amber-400' : !useManualLocation && accuracy !== null ? 'bg-emerald-400' : 'bg-amber-400'}`} />
     <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">GPS coordinates</span>
     <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isLocating ? 'bg-amber-950 text-amber-300' : !useManualLocation && accuracy !== null ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>
      {isLocating ? 'Locating' : !useManualLocation && accuracy !== null ? 'GPS fix' : useManualLocation ? 'Approximate' : 'Not fixed'}
     </span>
    </div>
    <button type="button" onClick={acquireLocation} disabled={isLocating} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-900/70 disabled:opacity-50">
     <RefreshCw className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} />Refresh GPS
    </button>
   </div>
   <div className="mt-1.5 break-words font-mono text-base font-black tracking-tight text-emerald-300 sm:text-lg">
    {lat !== null && lng !== null ? `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}` : 'Waiting for GPS fix…'}
   </div>
   <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
    <span>Accuracy: {accuracy !== null && !useManualLocation ? `±${Math.round(accuracy)} m` : useManualLocation ? 'Approximate location — GPS accuracy unavailable' : 'Waiting for GPS fix'}</span>
    {locationTimestamp && <span>Updated: {locationTimestamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
    {batteryPercent !== null && <span>Battery: {batteryPercent}%</span>}
   </div>
   {geoError && <p className="mt-2 rounded-lg border border-amber-800/50 bg-amber-950/40 p-2 text-[10px] leading-relaxed text-amber-300">{geoError}</p>}
  </div>

  <div className="mt-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3">
   <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
    <Mountain className="h-3.5 w-3.5 text-amber-300" />Nearest mapped landmark & highway
   </div>
   <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <div className="text-sm font-black text-white">{lat !== null && lng !== null ? nearestLandmark.city.name : "Waiting for GPS location"}</div>
    {lat !== null && lng !== null && <div className="text-[10px] font-semibold text-amber-300">{nearestLandmark.distanceKm} km {nearestLandmark.direction}</div>}
   </div>
   {lat !== null && lng !== null ? <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
    <span>{nearestLandmark.city.district} District</span><span>{nearestLandmark.city.province} Province</span>
    {nearestLandmark.nearestHighway && <span className="font-semibold text-amber-200">{nearestLandmark.nearestHighway}</span>}
   </div> : <p className="mt-1 text-[10px] text-slate-500">Nearest mapped landmark and highway will appear after GPS is fixed or an approximate location is selected.</p>}
   <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
    <span className="text-[9px] leading-snug text-slate-500">Nearest mapped place only; not a verified street address.</span>
    <a href={`https://maps.google.com/?q=${currentLat.toFixed(6)},${currentLng.toFixed(6)}`} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-bold text-sky-300 hover:text-sky-200">View map ↗</a>
   </div>
  </div>
 </div>
 {/* Active alert */}
 {isAlertActive && (
 <div
 id="sos-emergency-active-banner"
 role="alert"
 aria-live="assertive"
 className="animate-emergency-flash border-b-2 border-red-200 text-white px-4 sm:px-6 py-3.5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden shrink-0"
 >
 {/* Ambient dynamic alert glow & warning stripes */}
 <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 opacity-95" />
 <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.15)_10px,rgba(0,0,0,0.15)_20px)] pointer-events-none" />

 <div className="flex items-center space-x-3.5 z-10">
 <div className="relative shrink-0">
 <div className="w-10 h-10 rounded-xl bg-white text-red-700 flex items-center justify-center shadow-lg shadow-black/40 font-black animate-bounce">
 <AlertOctagon className="w-6 h-6 animate-pulse text-red-600" />
 </div>
 <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-90" />
 <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-400 border-2 border-red-800" />
 </span>
 </div>

 <div>
 <div className="flex items-center space-x-2.5 flex-wrap">
 <span className="text-base sm:text-lg font-black tracking-widest uppercase drop-shadow flex items-center space-x-1.5 font-display text-white">
 <span>ALERT ON</span>
 </span>
 <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/40 text-yellow-300 border border-yellow-300/60 animate-pulse">
 BEACON BROADCASTING LIVE
 </span>
 <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/30">
 {DISTRESS_TYPE_CONFIG[distressType].label}
 </span>
 </div>

 <div className="text-xs text-white/95 font-medium mt-0.5 drop-shadow-sm flex items-center space-x-2 flex-wrap">
 {isAudioPlaying && (
 <span className="flex items-center space-x-1 font-semibold text-yellow-200">
 <Volume2 className="w-3.5 h-3.5 animate-bounce" />
 <span>
 Acoustic Siren (
 {alarmMode === 'high_frequency'
 ? '2.8–3.6 kHz Mountain Sweep'
 : alarmMode === 'two_tone_siren'
 ? 'Two-Tone Warble'
 : 'Sound signal'}
 )
 </span>
 </span>
 )}
 {isAudioPlaying && isStrobeActive && <span>•</span>}
 {isStrobeActive && (
 <span className="flex items-center space-x-1 font-semibold text-amber-200">
 <Zap className="w-3.5 h-3.5" />
 <span>Optical Rescue Strobe Active</span>
 </span>
 )}
 <span>•</span>
 <span className="font-mono text-[11px] text-white">
 GPS: {currentLat.toFixed(4)}, {currentLng.toFixed(4)} ({nearestLandmark.distanceKm} km from {nearestLandmark.city.name})
 </span>
 </div>
 </div>
 </div>

 <div className="flex items-center space-x-2 z-10 shrink-0 self-end sm:self-auto">
 {!isStrobeActive && (
 <button
 type="button"
 onClick={() => setIsStrobeActive(true)}
 className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-bold border border-white/40 transition flex items-center space-x-1.5 shadow-sm active:scale-95"
 >
 <Flame className="w-3.5 h-3.5 text-amber-300" />
 <span>Launch Strobe</span>
 </button>
 )}
 <button
 type="button"
 onClick={handleDeactivateAlert}
 id="btn-deactivate-emergency-banner"
 className="px-3.5 py-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center space-x-1.5 border border-red-200"
 >
 <Square className="w-3.5 h-3.5 fill-red-700" />
 <span>Stop</span>
 </button>
 </div>
 </div>
 )}

 {/* Modal Body */}
 <div className="p-3 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 text-slate-200 scrollbar-paddle">
<div className="sticky top-0 z-20 -mx-3 mb-1 border-b border-slate-800 bg-slate-900/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
 <div role="tablist" aria-label="Emergency tools" className="grid grid-cols-3 gap-2 sm:gap-3">
  {([['alert', 'Alert'], ['messages', 'Message'], ['help', 'Call for help']] as const).map(([tab, label]) => (
   <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
    aria-controls={`sos-panel-${tab}`} onClick={() => setActiveTab(tab)}
    className={`min-h-[56px] rounded-xl border px-2 py-3 text-sm font-extrabold tracking-wide transition-all sm:min-h-[64px] sm:text-base ${activeTab === tab ? 'border-red-500 bg-red-600/25 text-white shadow-lg shadow-red-950/30 ring-1 ring-red-500/50' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-white'}`}>
    {label}
   </button>
  ))}
 </div>
</div><div id="sos-panel-alert" role="tabpanel" hidden={activeTab !== 'alert'} className="space-y-5">

 <div id="sos-panel-visual" hidden={activeTab !== 'alert'} className="space-y-5">
  <div className="grid grid-cols-2 gap-2">
   <button type="button" onClick={() => setAlertSignalMode('sound')} aria-pressed={alertSignalMode === 'sound'} className={`rounded-lg border px-2.5 py-2 text-xs font-bold ${alertSignalMode === 'sound' ? 'border-red-500 bg-red-600/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>
    <Volume2 className="inline-block mr-2 h-4 w-4" />Sound
   </button>
   <button type="button" onClick={() => setAlertSignalMode('visual')} aria-pressed={alertSignalMode === 'visual'} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${alertSignalMode === 'visual' ? 'border-red-500 bg-red-600/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>
    <Eye className="inline-block mr-2 h-4 w-4" />Visual
   </button>
  </div>
  <div hidden={alertSignalMode !== 'sound'} className="space-y-4">
{/* Alarm Mode Selectors & Frequency Waveform */}
 <div className="pt-3 border-t border-red-900/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
 <button
 type="button"
 onClick={() => {
 setAlarmMode('high_frequency');
 if (isAudioPlaying) sosAudioAlert.start('high_frequency');
 }}
 className={`p-2.5 rounded-xl text-left border transition-all ${
 alarmMode === 'high_frequency'
 ? 'bg-red-900/60 border-red-400 text-white ring-1 ring-red-400'
 : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold mb-1">
 <span className="text-amber-300">🏔️ Mountain Penetration</span>
 <span className="text-[10px] font-mono text-red-300">2.8–3.6 kHz</span>
 </div>
 <div className="text-[11px] text-slate-400 leading-snug">
 High-frequency sweep for river canyons & blizzard whiteouts
 </div>
 </button>

 <button
 type="button"
 onClick={() => {
 setAlarmMode('two_tone_siren');
 if (isAudioPlaying) sosAudioAlert.start('two_tone_siren');
 }}
 className={`p-2.5 rounded-xl text-left border transition-all ${
 alarmMode === 'two_tone_siren'
 ? 'bg-red-900/60 border-red-400 text-white ring-1 ring-red-400'
 : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold mb-1">
 <span className="text-cyan-300">🚨 Two-Tone Warble</span>
 <span className="text-[10px] font-mono text-cyan-300">2.4 / 3.2 kHz</span>
 </div>
 <div className="text-[11px] text-slate-400 leading-snug">
 High-contrast alternating alarm for ground SAR localization
 </div>
 </button>

 <button
 type="button"
 onClick={() => {
 setAlarmMode('morse_sos');
 if (isAudioPlaying) sosAudioAlert.start('morse_sos');
 }}
 className={`p-2.5 rounded-xl text-left border transition-all ${
 alarmMode === 'morse_sos'
 ? 'bg-red-900/60 border-red-400 text-white ring-1 ring-red-400'
 : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold mb-1">
 <span className="text-emerald-300">📻 Sound signal</span>
 <span className="text-[10px] font-mono text-emerald-300">... --- ...</span>
 </div>
 <div className="text-[11px] text-slate-400 leading-snug">
 International standard distress audio pattern (1.2 kHz tone)
 </div>
 </button>
 </div>


 
 {/* Sound & Optical Distress Signaling Card */}
 <div className="bg-gradient-to-r from-red-950/70 via-slate-900 to-red-950/70 border-2 border-red-500/50 rounded-2xl p-4 shadow-xl">
 <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
 <div className="flex items-center space-x-2.5">
 <div
 className={`w-10 h-10 rounded-xl flex items-center justify-center ${
 isAudioPlaying
 ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/60 ring-2 ring-red-300'
 : 'bg-red-950 text-red-400 border border-red-800'
 }`}
 >
 <Volume2 className={`w-5 h-5 ${isAudioPlaying ? 'animate-bounce' : ''}`} />
 </div>
 <div>
 <div className="flex items-center space-x-2">
 <h4 className="text-sm font-black text-white uppercase tracking-wider">
 Sound
 </h4>
 <span
 className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
 isAudioPlaying
 ? 'bg-red-500/30 text-red-300 border-red-400 animate-pulse'
 : 'bg-slate-800 text-slate-400 border-slate-700'
 }`}
 >
 {isAudioPlaying ? '🚨 SOUNDING LIVE' : 'STANDBY'}
 </span>
 </div>
 <p className="text-xs text-slate-300 mt-0.5">
 Piercing 2.8 kHz – 3.6 kHz acoustic alert engineered to cut through heavy mountain rain, river gorges, & engine noise.
 </p>
 </div>
 </div>

 {/* Main Toggle Switch */}
 <button
 type="button"
 onClick={() => toggleAudioSiren(alarmMode)}
 id="btn-toggle-high-frequency-alarm"
 className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg active:scale-95 ${
 isAudioPlaying
 ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/50 ring-2 ring-white animate-pulse'
 : 'bg-red-900/90 hover:bg-red-800 text-white border border-red-500/80 shadow-red-950/80'
 }`}
 >
 {isAudioPlaying ? (
 <>
 <Square className="w-4 h-4 fill-white" />
 <span>Stop Alarm</span>
 </>
 ) : (
 <>
 <Play className="w-4 h-4 fill-white" />
 <span>Trigger Alarm</span>
 </>
 )}
 </button>
 </div>

 {/* Live Audio Waves Active Visualizer */}
 {isAudioPlaying && (
 <div className="mt-3 p-2.5 rounded-xl bg-black/50 border border-red-500/40 flex items-center justify-between animate-fadeIn">
 <div className="flex items-center space-x-2">
 <div className="flex items-end space-x-1 h-5">
 <span className="w-1 bg-red-400 rounded-full h-3 animate-pulse" />
 <span className="w-1 bg-yellow-400 rounded-full h-5 animate-bounce" />
 <span className="w-1 bg-red-400 rounded-full h-4 animate-pulse" />
 <span className="w-1 bg-amber-400 rounded-full h-5 animate-bounce" />
 <span className="w-1 bg-red-500 rounded-full h-2 animate-pulse" />
 <span className="w-1 bg-yellow-300 rounded-full h-5 animate-bounce" />
 </div>
 <span className="text-xs font-bold text-red-300">
 Acoustic signaling active on device speaker at maximum frequency gain
 </span>
 </div>
 <button
 type="button"
 onClick={() => toggleAudioSiren(alarmMode)}
 className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-black hover:bg-red-500"
 >
 MUTE
 </button>
 </div>
 )}
 </div>

 </div>
 <div hidden={alertSignalMode !== 'visual'} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
  <div className="flex items-center justify-between gap-3">
   <div><h3 className="text-sm font-bold text-white">Visual rescue beacon</h3>
    <p className="text-xs text-slate-400">Use the high-contrast screen signal to help rescuers locate you.</p></div>
   <button type="button" onClick={toggleStrobe} aria-pressed={isStrobeActive}
    className={`rounded-lg px-3 py-2 text-xs font-bold ${isStrobeActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
    {isStrobeActive ? 'Stop visual alert' : 'Start visual alert'}
   </button>
  </div>
 </div>
 </div>
 
 <div id="sos-panel-messages" role="tabpanel" hidden={activeTab !== 'messages'} className="space-y-4">
  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
   <div className="mb-3 flex items-center justify-between gap-2">
    <div><h3 className="text-sm font-black text-white">What happened?</h3><p className="mt-0.5 text-xs text-slate-400">Choose the closest situation to prepare your help message.</p></div>
    <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {(Object.keys(DISTRESS_TYPE_CONFIG) as EmergencyDistressType[]).map((type) => {
     const item = DISTRESS_TYPE_CONFIG[type];
     const selected = distressType === type;
     return <button key={type} type="button" onClick={() => setDistressType(type)} aria-pressed={selected}
      className={`min-h-[76px] rounded-xl border p-2.5 text-left transition-all ${selected ? 'border-red-500 bg-red-950/60 text-white ring-1 ring-red-500/60' : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'}`}>
      <span className="flex items-center justify-between gap-1"><span className="text-lg">{item.iconEmoji}</span><span className="text-[9px] font-bold uppercase text-slate-400">{item.priority}</span></span>
      <span className="mt-1 block text-xs font-bold leading-tight">{item.label}</span>
      <span className="mt-0.5 block text-[10px] text-slate-400">{item.nepaliLabel}</span>
     </button>;
    })}
   </div>
   <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
    <label className="text-[11px] font-semibold text-slate-400">Vehicle
     <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white">
      <option value="car">Car / Sedan</option><option value="suv_4wd">SUV / 4WD</option><option value="motorbike">Motorcycle / Scooter</option><option value="bus_truck">Bus / Truck</option><option value="electric_vehicle">Electric vehicle</option>
     </select>
    </label>
    <label className="text-[11px] font-semibold text-slate-400">Vehicle plate <span className="font-normal">(optional)</span>
     <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="e.g. BA 02 PA 4821" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500" />
    </label>
    <div className="text-[11px] font-semibold text-slate-400">People onboard
     <div className="mt-1 flex items-center gap-2">
      <button type="button" aria-label="Remove one person" onClick={() => setPassengerCount(c => Math.max(1,c-1))} className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900 text-white">−</button>
      <span className="flex-1 rounded-lg border border-slate-700 bg-slate-900 py-2 text-center text-xs font-bold text-white">{passengerCount}</span>
      <button type="button" aria-label="Add one person" onClick={() => setPassengerCount(c => Math.min(50,c+1))} className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900 text-white">+</button>
     </div>
    </div>
   </div>
   <label className="mt-3 block text-[11px] font-semibold text-slate-400">Further information <span className="font-normal">(optional)</span>
    <textarea rows={2} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} placeholder="Describe injuries, immediate needs, nearby signs, or other useful details…" className="mt-1 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500" />
   </label>
  </section>

  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
   <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
    <div><h3 className="text-sm font-black text-white">Prepared emergency message</h3><p className="text-xs text-slate-400">Updates automatically with your selection and location.</p></div>
    <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
     <button type="button" onClick={() => setMessageFormat('full')} aria-pressed={messageFormat === 'full'} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${messageFormat === 'full' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>Full</button>
     <button type="button" onClick={() => setMessageFormat('compact')} aria-pressed={messageFormat === 'compact'} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${messageFormat === 'compact' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>SMS</button>
    </div>
   </div>
   <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">{activeMessageText}</pre>
   <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
    <label className="min-w-[190px] flex-1 text-[10px] font-semibold text-slate-400">Recipient number <span className="font-normal">(optional)</span>
     <input type="tel" value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="+977 98XXXXXXXX" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500" />
    </label>
    <button type="button" onClick={handleCopy} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-700">
     {copiedText ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}{copiedText ? 'Copied' : 'Copy message'}
    </button>
   </div>
  </section>

  <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-3 sm:p-4">
   <div className="mb-3"><h3 className="text-sm font-black text-white">Share for assistance</h3><p className="text-xs text-slate-400">Choose an app. Review the message before sending.</p></div>
   <div className="grid grid-cols-4 gap-2">
    <button type="button" onClick={handleSendWhatsApp} aria-label="Share via WhatsApp" title="WhatsApp" className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"><MessageSquare className="h-5 w-5" /></button>
    <button type="button" onClick={handleSendSms} aria-label="Send SMS" title="SMS" className="flex h-12 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500"><Send className="h-5 w-5" /></button>
    <button type="button" onClick={handleSendTelegram} aria-label="Share via Telegram" title="Telegram" className="flex h-12 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-500"><Radio className="h-5 w-5" /></button>
    <button type="button" onClick={handleSendMessenger} aria-label="Open Messenger (message copied)" title="Messenger — message copied" className="flex h-12 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"><MessageSquare className="h-5 w-5" /></button>
   </div>
   <p className="mt-2 text-[10px] text-slate-500">Messenger opens separately; the message is copied so you can paste it into the conversation.</p>
  </section>
 </div>

<div id="sos-panel-help" role="tabpanel" hidden={activeTab !== 'help'} className="space-y-4">
 <section className="rounded-2xl border border-red-800/60 bg-gradient-to-br from-red-950/70 to-slate-950 p-4">
  <div className="flex items-start gap-3">
   <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><PhoneCall className="h-5 w-5" /></div>
   <div><h3 className="text-base font-black text-white">Emergency contacts — Nepal</h3><p className="mt-1 text-xs leading-relaxed text-slate-300">Choose the service that matches your situation. Tap a contact to open your phone dialer; confirm the number before placing the call.</p></div>
  </div>
  <div className="mt-3 rounded-xl border border-red-500/30 bg-black/20 p-3 text-xs leading-relaxed text-red-100">
   If anyone is in immediate danger or needs urgent medical attention, contact the appropriate emergency service now. Share your GPS coordinates and nearest landmark when connected.
  </div>
 </section>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {NEPAL_EMERGENCY_HOTLINES.map((hotline, index) => (
   <article key={hotline.number} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 sm:p-4 ${index < 3 ? 'border-red-900/60 bg-slate-950/90' : 'border-slate-800 bg-slate-950/60'}`}>
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xl">{hotline.badge.split(' ')[0]}</div>
    <div className="min-w-0 flex-1">
     <h4 className="text-sm font-bold text-white">{hotline.name}</h4>
     <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hotline.role}</p>
     <p className="mt-1 font-mono text-sm font-black text-red-300">{hotline.number}</p>
    </div>
    <a href={hotline.tel} aria-label={`Call ${hotline.name} at ${hotline.number}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-red-950/40 hover:bg-red-500">
     <PhoneCall className="h-3.5 w-3.5" /><span>Call</span>
    </a>
   </article>
  ))}
 </div>
 <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Before you call</h3>
  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
   <li>• State what happened and whether anyone is injured.</li>
   <li>• Give your GPS coordinates and nearest landmark shown above.</li>
   <li>• Mention the road or highway, direction of travel, and number of people needing help.</li>
   <li>• Keep the line available for a callback and follow the operator's instructions.</li>
  </ul>
  <button type="button" onClick={handleCopy} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
   <Copy className="h-3.5 w-3.5" />Copy prepared SOS details
  </button>
 </section>
</div>

 </div>
  </div>
  </div>
  </div>
  );
};