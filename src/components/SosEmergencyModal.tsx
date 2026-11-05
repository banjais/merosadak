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
 const [manualLocationConfirmed, setManualLocationConfirmed] = useState<boolean>(false);

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
 const [isStrobeActive, setIsStrobeActive] = useState<boolean>(false);
 const [strobeState, setStrobeState] = useState<boolean>(false);

 // Small optional device compass. Heading is shown only when the device provides it.
 const [compassHeading, setCompassHeading] = useState<number | null>(null);
 const [compassEnabled, setCompassEnabled] = useState(false);

 const handleEnableCompass = async () => {
  try {
   const orientationApi = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
   };
   if (typeof orientationApi.requestPermission === 'function') {
    const permission = await orientationApi.requestPermission();
    if (permission !== 'granted') return;
   }
   setCompassEnabled(true);
  } catch (error) {
   console.warn('[MeroSadak SOS] Compass permission unavailable:', error);
  }
 };

 useEffect(() => {
  if (!isOpen || !compassEnabled) return;
  const handleOrientation = (event: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
   let heading: number | null = null;
   if (typeof event.webkitCompassHeading === 'number') {
    heading = event.webkitCompassHeading;
   } else if (event.absolute && typeof event.alpha === 'number') {
    heading = (360 - event.alpha + 360) % 360;
   }
   if (heading !== null && Number.isFinite(heading)) {
    setCompassHeading(heading);
   }
  };
  window.addEventListener('deviceorientation', handleOrientation);
  window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
  return () => {
   window.removeEventListener('deviceorientation', handleOrientation);
   window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
  };
 }, [isOpen, compassEnabled]);

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
 setManualLocationConfirmed(false);
 },
 (err) => {
 setIsLocating(false);
 setLat(null);
 setLng(null);
 setAccuracy(null);
 setAltitude(null);
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

 // Never silently substitute a route origin or fixed coordinates for GPS.
 // Require the user to choose a fallback place before sharing an SOS message.
 setManualLocationConfirmed(false);
 },
 {
 enableHighAccuracy: true,
 timeout: 12000,
 maximumAge: 0,
 }
 );
 }, [activeRoute]);

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
 setManualLocationConfirmed(true);
 }
 };

 // Current active coordinates to use
 const selectedFallbackCity = CITIES_AND_JUNCTIONS.find((city) => city.id === manualCityId);
 const currentLat = lat ?? selectedFallbackCity?.lat ?? 27.8617;
 const currentLng = lng ?? selectedFallbackCity?.lng ?? 84.5542;
 const locationReady = (lat !== null && lng !== null) || (useManualLocation && manualLocationConfirmed);

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

 // Master SOS Alert Activation / Deactivation
 const handleActivateAlert = () => {
 if (!isAudioPlaying) {
 setAlarmMode('high_frequency');
 sosAudioAlert.start('high_frequency');
 setIsAudioPlaying(true);
 }
 };

 const handleDeactivateAlert = () => {
 sosAudioAlert.stop();
 setIsAudioPlaying(false);
 setIsStrobeActive(false);
 };

 if (!isOpen) return null;

 return (
  <div
   id="emergency-sos-modal"
   className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-sm sm:p-4"
   role="dialog"
   aria-modal="true"
   aria-labelledby="sos-title"
  >
   <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
    <header className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3">
     <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white">
       <AlertOctagon className="h-5 w-5" />
      </span>
      <div>
       <h2 id="sos-title" className="text-base font-bold text-white">Emergency SOS</h2>
       <p className="text-xs text-slate-400">Share your location and contact help</p>
      </div>
     </div>
     <div className="flex items-center gap-2">
      <button
       type="button"
       onClick={() => toggleAudioSiren(alarmMode)}
       className={`rounded-lg px-3 py-2 text-xs font-semibold ${isAudioPlaying ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
       aria-pressed={isAudioPlaying}
      >
       {isAudioPlaying ? 'Stop sound' : 'Sound alert'}
      </button>
      <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close SOS">
       <X className="h-5 w-5" />
      </button>
     </div>
    </header>

    <main className="space-y-4 overflow-y-auto p-3 text-slate-200 sm:p-4">
     <section aria-labelledby="sos-contacts-title" className="rounded-xl border border-red-900/70 bg-red-950/25 p-3">
      <div className="mb-2 flex items-center justify-between">
       <h3 id="sos-contacts-title" className="flex items-center gap-2 text-sm font-bold text-white">
        <PhoneCall className="h-4 w-4 text-red-400" /> Emergency numbers
       </h3>
       <span className="text-[10px] text-slate-400">Nepal</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
       {NEPAL_EMERGENCY_HOTLINES.map((hotline) => (
        <a
         key={hotline.number}
         href={hotline.tel}
         className="flex min-h-[58px] items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 hover:border-red-500/70 hover:bg-slate-900"
         aria-label={`Call ${hotline.name}, ${hotline.number}`}
        >
         <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-slate-300">{hotline.name}</span>
          <span className="block text-[10px] text-slate-500">Tap to call</span>
         </span>
         <strong className="shrink-0 text-base font-bold text-red-300">{hotline.number}</strong>
        </a>
       ))}
      </div>
     </section>

     <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
         <span className={`h-2 w-2 rounded-full ${isLocating ? 'animate-pulse bg-amber-400' : geoError ? 'bg-amber-400' : 'bg-emerald-400'}`} />
         <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {isLocating ? 'Getting your location…' : useManualLocation ? 'Approximate location' : 'Your location'}
         </h3>
        </div>
        {locationReady ? (
         <p className="break-all font-mono text-sm font-bold text-emerald-300">
          {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
         </p>
        ) : (
         <p className="text-xs font-semibold text-amber-300">Location not confirmed — choose a nearby place below</p>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
         {accuracy ? `GPS accuracy ±${Math.round(accuracy)} m` : 'GPS accuracy unavailable'}
         {nearestLandmark?.city?.name ? ` · Near ${nearestLandmark.city.name}` : ''}
        </p>
       </div>

       <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-slate-700 bg-slate-900" title={compassHeading === null ? 'Compass unavailable' : `Heading ${Math.round(compassHeading)} degrees`}>
         <Compass className="h-6 w-6 text-emerald-300" style={{ transform: `rotate(${compassHeading ?? 0}deg)` }} />
         <span className="text-[9px] font-semibold text-slate-400">{compassHeading === null ? '—' : `${Math.round(compassHeading)}°`}</span>
        </div>
        <div className="flex flex-col gap-1">
         <button type="button" onClick={handleEnableCompass} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800">
          {compassHeading === null ? 'Enable compass' : 'Compass on'}
         </button>
         <button type="button" onClick={acquireLocation} disabled={isLocating} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">
          {isLocating ? 'Updating…' : 'Refresh GPS'}
         </button>
        </div>
       </div>
      </div>
      {geoError && <p className="mt-2 rounded-lg bg-amber-950/40 p-2 text-[11px] text-amber-300">{geoError}</p>}
      {useManualLocation && (
       <div className="mt-3 border-t border-slate-800 pt-3">
        <label htmlFor="sos-manual-location" className="mb-1 block text-[11px] text-slate-400">Choose nearest known place</label>
        <select id="sos-manual-location" value={manualCityId} onChange={(e) => handleManualCityChange(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
         {CITIES_AND_JUNCTIONS.map((city) => <option key={city.id} value={city.id}>{city.name} — {city.district}</option>)}
        </select>
       </div>
      )}
      {onFocusCoordinatesOnMap && locationReady && (
       <button type="button" onClick={() => { onFocusCoordinatesOnMap(currentLat, currentLng, 'My location'); onClose(); }} className="mt-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200">
        View location on map →
       </button>
      )}
     </section>

     <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">What happened?</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
       {(Object.keys(DISTRESS_TYPE_CONFIG) as EmergencyDistressType[]).map((type) => {
        const item = DISTRESS_TYPE_CONFIG[type];
        const selected = distressType === type;
        return (
         <button key={type} type="button" onClick={() => setDistressType(type)} aria-pressed={selected} className={`rounded-lg border p-2 text-left transition ${selected ? 'border-red-500 bg-red-950/60 text-white' : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'}`}>
          <span className="block text-lg">{item.iconEmoji}</span>
          <span className="mt-1 block text-xs font-semibold">{item.label}</span>
          <span className="block text-[10px] text-slate-400">{item.nepaliLabel}</span>
         </button>
        );
       })}
      </div>
     </section>

     <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="text-[11px] text-slate-400">
       Vehicle (optional)
       <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
        <option value="car">Car</option>
        <option value="suv_4wd">SUV / 4WD</option>
        <option value="motorbike">Motorcycle</option>
        <option value="bus_truck">Bus / Truck</option>
        <option value="electric_vehicle">Electric vehicle</option>
       </select>
      </label>
      <label className="text-[11px] text-slate-400">
       People with you
       <select value={passengerCount} onChange={(e) => setPassengerCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
       </select>
      </label>
      <label className="sm:col-span-2 text-[11px] text-slate-400">
       Extra details (optional)
       <input value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} maxLength={180} placeholder="Briefly describe what help you need" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
      </label>
     </section>

     <section className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
       <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Share your location</h3>
       <button type="button" onClick={handleCopy} disabled={!locationReady} className="text-[11px] font-semibold text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
        {copiedText ? 'Copied' : 'Copy message'}
       </button>
      </div>
      <label className="mb-2 block text-[11px] text-slate-400">
       Recipient phone (optional)
       <input type="tel" value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="+977 98XXXXXXXX" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
      </label>
      <div className="grid grid-cols-2 gap-2">
       <button type="button" onClick={handleSendWhatsApp} disabled={!locationReady} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
        <MessageSquare className="h-4 w-4" /> WhatsApp
       </button>
       <button type="button" onClick={handleSendSms} disabled={!locationReady} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
        <Send className="h-4 w-4" /> SMS
       </button>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">{locationReady ? 'Your message includes confirmed coordinates and emergency details. Sending requires your confirmation in the messaging app.' : 'Allow GPS or choose your nearest known place before sharing. An unconfirmed default location will never be sent.'}</p>
     </section>
    </main>
   </div>
  </div>
 );
};
