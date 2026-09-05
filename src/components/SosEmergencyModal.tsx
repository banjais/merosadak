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
  ChevronRight,
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
  sosAudioBeacon,
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
  const [isStrobeActive, setIsStrobeActive] = useState<boolean>(false);
  const [strobeState, setStrobeState] = useState<boolean>(false);

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
      sosAudioBeacon.stop();
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

  // Toggle Audio Siren / Acoustic Alarm
  const toggleAudioSiren = (modeToPlay: SosAlarmMode = alarmMode) => {
    if (isAudioPlaying && alarmMode === modeToPlay) {
      sosAudioBeacon.stop();
      setIsAudioPlaying(false);
    } else {
      setAlarmMode(modeToPlay);
      sosAudioBeacon.start(modeToPlay);
      setIsAudioPlaying(true);
    }
  };

  // Toggle Optical Strobe Beacon
  const toggleStrobe = () => {
    setIsStrobeActive((prev) => !prev);
  };

  // Whether SOS Beacon is actively transmitting (either acoustic alarm, visual strobe, or both)
  const isBeaconActive = isAudioPlaying || isStrobeActive;

  // Master SOS Beacon Activation / Deactivation
  const handleActivateBeacon = () => {
    if (!isAudioPlaying) {
      setAlarmMode('high_frequency');
      sosAudioBeacon.start('high_frequency');
      setIsAudioPlaying(true);
    }
  };

  const handleDeactivateBeacon = () => {
    sosAudioBeacon.stop();
    setIsAudioPlaying(false);
    setIsStrobeActive(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      id="emergency-sos-modal"
    >
      {/* Fullscreen Strobe Visual Beacon (if active) */}
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
              Exit Beacon Mode
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border-2 border-red-600/70 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Urgent Emergency Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950 via-red-900/80 to-slate-950 border-b border-red-800/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-400 border-2 border-slate-900 rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/30 border border-red-400/50 text-red-300">
                  Search & Rescue Dispatch
                </span>
                <span className="text-xs text-red-200/80 font-medium">Mero Sadak Nepal SOS</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center space-x-1.5">
                <span>Emergency Highway Rescue Assistant</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Master Beacon Quick Action Toggle */}
            <button
              onClick={isBeaconActive ? handleDeactivateBeacon : handleActivateBeacon}
              id="sos-beacon-master-btn"
              title={isBeaconActive ? 'Deactivate SOS Emergency Beacon' : 'Activate High-Frequency SOS Emergency Beacon'}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md active:scale-95 ${
                isBeaconActive
                  ? 'bg-red-500 text-white animate-pulse border border-red-200 shadow-red-500/60'
                  : 'bg-red-600 hover:bg-red-500 text-white border border-red-400'
              }`}
            >
              {isBeaconActive ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Deactivate Beacon</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>Activate SOS Beacon</span>
                </>
              )}
            </button>

            {/* High-Frequency Acoustic Alarm Toggle */}
            <button
              onClick={() => toggleAudioSiren('high_frequency')}
              id="sos-audio-siren-btn"
              title="Toggle High-Frequency Acoustic Distress Alarm (2.8 kHz – 3.6 kHz)"
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                isAudioPlaying && alarmMode === 'high_frequency'
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50 border border-red-300'
                  : isAudioPlaying
                  ? 'bg-amber-600 text-white border border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-red-300 hover:text-red-200 border border-red-900/60'
              }`}
            >
              {isAudioPlaying ? (
                <Volume2 className="w-4 h-4 animate-bounce text-yellow-300" />
              ) : (
                <VolumeX className="w-4 h-4 text-red-400" />
              )}
              <span>{isAudioPlaying ? 'Alarm Active' : 'Acoustic Alarm'}</span>
            </button>

            {/* Visual Strobe Beacon Toggle */}
            <button
              onClick={toggleStrobe}
              id="sos-visual-strobe-btn"
              title="Fullscreen Flashing Visual Beacon"
              className="p-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Visual Beacon</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close SOS Dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FLASHING 'EMERGENCY ACTIVE' BANNER (When SOS Beacon is Activated) */}
        {isBeaconActive && (
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
                    <span>EMERGENCY ACTIVE</span>
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
                          : 'Morse Code SOS'}
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
                onClick={handleDeactivateBeacon}
                id="btn-deactivate-emergency-banner"
                className="px-3.5 py-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center space-x-1.5 border border-red-200"
              >
                <Square className="w-3.5 h-3.5 fill-red-700" />
                <span>Deactivate Beacon</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-200">
          {/* Top Row: GPS Coordinates & Proximity Landmark Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* GPS Status Card */}
            <div className="md:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isLocating ? 'bg-amber-400 animate-ping' : geoError ? 'bg-amber-500' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {isLocating ? 'Acquiring High-Precision GPS...' : useManualLocation ? 'Manual / Offline Landmark' : 'GPS Fix Locked'}
                  </span>
                </div>
                <button
                  onClick={acquireLocation}
                  disabled={isLocating}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>Refresh GPS</span>
                </button>
              </div>

              <div className="my-1.5 space-y-1">
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs text-slate-400 font-mono">LAT / LNG:</span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-400 tracking-tight">
                    {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span>Accuracy: ±{accuracy ? Math.round(accuracy) : 15}m</span>
                  <span>•</span>
                  <span>Alt: {altitude ? `${Math.round(altitude)}m ASL` : `${nearestLandmark.city.elevationM}m ASL`}</span>
                  {batteryPercent != null && (
                    <>
                      <span>•</span>
                      <span className="text-slate-300">🔋 {batteryPercent}%</span>
                    </>
                  )}
                </div>
              </div>

              {geoError && (
                <div className="mt-2 text-[11px] text-amber-400/90 bg-amber-950/40 border border-amber-800/40 rounded-lg p-2">
                  {geoError}
                </div>
              )}

              {/* Manual Selection Fallback */}
              {useManualLocation && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Select Nearest Known Nepal Hub / Junction:
                  </label>
                  <select
                    value={manualCityId}
                    onChange={(e) => handleManualCityChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    {CITIES_AND_JUNCTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.nepaliName}) - {c.district}, {c.province}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Nearest Nepal Landmark & Route Context Card */}
            <div className="md:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  <Mountain className="w-3.5 h-3.5 text-red-400" />
                  <span>Highway Landmark & Proximity</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    ~{nearestLandmark.distanceKm} km {nearestLandmark.direction} of {nearestLandmark.city.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    District: <strong className="text-slate-200">{nearestLandmark.city.district}</strong> • Province:{' '}
                    <strong className="text-slate-200">{nearestLandmark.city.province}</strong>
                  </p>
                  {nearestLandmark.nearestHighway && (
                    <p className="text-xs text-amber-300 font-medium mt-1">
                      Corridor: {nearestLandmark.nearestHighway}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {activeRoute
                    ? `Active Route: ${activeRoute.origin.name} ➔ ${activeRoute.destination.name}`
                    : 'Independent Highway Travel'}
                </span>
                {onFocusCoordinatesOnMap && (
                  <button
                    onClick={() => {
                      onFocusCoordinatesOnMap(currentLat, currentLng, 'SOS Emergency Pinpoint');
                      onClose();
                    }}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center space-x-1"
                  >
                    <span>Pin on Map</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* High-Frequency Acoustic Alarm & Optical Distress Signaling Card */}
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
                      High-Frequency Acoustic Alarm
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
                    Piercing 2.8 kHz – 3.6 kHz acoustic beacon engineered to cut through heavy mountain rain, river gorges, & engine noise.
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

            {/* Alarm Mode Selectors & Frequency Waveform */}
            <div className="pt-3 border-t border-red-900/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAlarmMode('high_frequency');
                  if (isAudioPlaying) sosAudioBeacon.start('high_frequency');
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
                  if (isAudioPlaying) sosAudioBeacon.start('two_tone_siren');
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
                  if (isAudioPlaying) sosAudioBeacon.start('morse_sos');
                }}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  alarmMode === 'morse_sos'
                    ? 'bg-red-900/60 border-red-400 text-white ring-1 ring-red-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-emerald-300">📻 Morse Code SOS</span>
                  <span className="text-[10px] font-mono text-emerald-300">... --- ...</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  International standard distress audio pattern (1.2 kHz tone)
                </div>
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

          {/* Emergency Distress Nature Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Select Emergency Nature / Distress Category:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(DISTRESS_TYPE_CONFIG) as EmergencyDistressType[]).map((type) => {
                const item = DISTRESS_TYPE_CONFIG[type];
                const isSelected = distressType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDistressType(type)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-red-950/60 border-red-500 text-white shadow-md shadow-red-950/50 ring-1 ring-red-500'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{item.iconEmoji}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                          item.priority === 'Critical'
                            ? 'bg-red-500/20 text-red-300'
                            : item.priority === 'Urgent'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <span className="text-xs font-bold leading-tight block">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.nepaliLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vehicle, Passengers, and Rescuer Details Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vehicle Type:</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="car">Car / Sedan / Hatchback</option>
                <option value="suv_4wd">SUV / 4WD Mountain Jeep</option>
                <option value="motorbike">Motorcycle / Scooter</option>
                <option value="bus_truck">Bus / Heavy Commercial Truck</option>
                <option value="electric_vehicle">Electric Vehicle (EV)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Vehicle Plate / Reg No (Optional):
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="e.g. BA 02 PA 4821"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Persons Onboard:</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPassengerCount((c) => Math.max(1, c - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                >
                  -
                </button>
                <span className="flex-1 text-center font-bold text-sm bg-slate-900 border border-slate-700 py-1 rounded-lg">
                  {passengerCount} {passengerCount === 1 ? 'Person' : 'People'}
                </span>
                <button
                  type="button"
                  onClick={() => setPassengerCount((c) => Math.min(50, c + 1))}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Distress Situation & Immediate Needs (Optional Note):
              </label>
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g., Stranded after rockfall 2km past Kurintar, child onboard, 4WD axle damaged, need crane and medical check"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Generated Rescue Text Dispatch Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Generated Search & Rescue (SAR) Dispatch Message
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setMessageFormat('full')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    messageFormat === 'full'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Full SAR (WhatsApp/Telegram)
                </button>
                <button
                  onClick={() => setMessageFormat('compact')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    messageFormat === 'compact'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compact 2G SMS
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {activeMessageText}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center space-x-1.5 shadow-lg transition-all"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied to Clipboard!' : 'Copy SAR Text'}</span>
              </button>
            </div>
          </div>

          {/* Quick External Transmission Channels */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Send Emergency SOS Via External Channels:
            </label>

            {/* Optional Custom Phone Number Input */}
            <div className="mb-3 flex items-center space-x-2">
              <input
                type="tel"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="Optional: Enter specific recipient phone (e.g. +977 98XXXXXXXX or family contact)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* WhatsApp Button */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                id="sos-send-whatsapp-btn"
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-98"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send via WhatsApp</span>
              </button>

              {/* Direct SMS Button */}
              <button
                type="button"
                onClick={handleSendSms}
                id="sos-send-sms-btn"
                className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-950/50 transition-all active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Send via Direct SMS</span>
              </button>

              {/* Telegram Button */}
              <button
                type="button"
                onClick={handleSendTelegram}
                id="sos-send-telegram-btn"
                className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-950/50 transition-all active:scale-98"
              >
                <Radio className="w-4 h-4" />
                <span>Send via Telegram</span>
              </button>
            </div>
          </div>

          {/* Nepal Emergency Hotlines Speed-Dial Grid */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-red-400" />
                <span>Nepal Official Emergency Speed-Dial Hotlines:</span>
              </span>
              <span className="text-[11px] text-slate-400">Toll-free 24/7 National Emergency</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {NEPAL_EMERGENCY_HOTLINES.map((hotline) => (
                <a
                  key={hotline.number}
                  href={hotline.tel}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/60 hover:bg-slate-800/80 transition-all text-center flex flex-col items-center justify-center group"
                >
                  <span className="text-sm font-black text-red-400 group-hover:text-red-300">
                    {hotline.badge}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-300 block truncate max-w-full">
                    {hotline.name}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Dial {hotline.number}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Mero Sadak SAR Assistant • Offline Coordinates Cached</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close Emergency Panel
          </button>
        </div>
      </div>
    </div>
  );
};
