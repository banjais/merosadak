import React, { useMemo, useState, useEffect } from 'react';
import {
  X, Trash2, Ruler, RotateCcw, Loader2, Download, Share2, Magnet, MapPin, Stethoscope, Hospital, ShieldAlert, Thermometer, Gauge, Fuel, Leaf, Banknote, Mountain, Clock, Activity, AlertTriangle, Sprout, Battery, Zap, Navigation
} from 'lucide-react';
import { L } from '../lib/leaflet';
import { haversineDistance } from '../services/geoUtils';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface RouteIntelligenceProps {
  isOpen: boolean;
  points: L.LatLng[];
  elevationData: number[];
  nearestIntersectionDist?: number | null;
  nearestHospitalDist?: number | null;
  roadQuality?: string | null;
  vehicleType?: string | null;
  customTankCapacity?: number | null;
  comparisonData?: any[];
  pathAnalytics?: { duration: number; delay: number; landslides: number; hazards?: any[] } | null;
  landslideSeverity: string;
  onSeverityChange: (val: string) => void;
  trafficIntensity: number;
  onTrafficChange: (val: number) => void;
  fuelPrice: number;
  isGreenRoute: boolean;
  onToggleGreenRoute: () => void;
  userElevation?: number;
  batteryLevel?: number | null;
  isNightVision?: boolean;
  isHighContrast?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onClear: () => void;
  onUndo: () => void;
  onShare: () => void;
  isSnapping: boolean;
  onToggleSnap: () => void;
  isEmergencyMode: boolean;
  onToggleEmergency: () => void;
  onAvoidLandslides?: () => void;
}

export const RouteIntelligence: React.FC<RouteIntelligenceProps> = ({
  isOpen,
  points,
  elevationData,
  nearestIntersectionDist,
  nearestHospitalDist,
  roadQuality,
  vehicleType,
  customTankCapacity,
  comparisonData,
  landslideSeverity,
  onSeverityChange,
  trafficIntensity,
  onTrafficChange,
  fuelPrice,
  isGreenRoute,
  onToggleGreenRoute,
  pathAnalytics,
  userElevation,
  batteryLevel,
  isNightVision,
  isHighContrast,
  isLoading,
  onClose,
  onClear,
  onUndo,
  onShare,
  isSnapping,
  onToggleSnap,
  isEmergencyMode,
  onToggleEmergency,
  onAvoidLandslides
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEscapeKey(onClose);

  if (!shouldRender) return null;

  const totalDistance = useMemo(() => {
    return points.reduce((total, point, index) => {
      if (index === 0) return 0;
      const prev = points[index - 1];
      return total + haversineDistance(prev.lat, prev.lng, point.lat, point.lng);
    }, 0);
  }, [points]);

  // ⏱️ Travel Time Logic: Based on 40 km/h avg speed for Nepal's terrain
  const travelTime = useMemo(() => {
    if (totalDistance === 0) return null;
    const totalMinutes = (totalDistance / 40) * 60;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} mins`;
  }, [totalDistance]);

  // 🏥 Hospital Travel Time: Adjusted for road quality (Base 50 km/h)
  const hospitalTravelTime = useMemo(() => {
    if (!nearestHospitalDist) return null;

    // Dynamically adjust speed based on road quality grade (A-F)
    // Grade A: National Highway Standard, Grade F: High-risk/Unpaved
    let adjustedSpeed = 50;
    if (roadQuality) {
      const grade = roadQuality.toUpperCase();
      if (grade === 'A') adjustedSpeed = 65;      // Smooth transit
      else if (grade === 'B') adjustedSpeed = 50; // Standard speed
      else if (grade === 'C') adjustedSpeed = 35; // Moderate delays/potholes
      else if (grade === 'D') adjustedSpeed = 20; // Poor condition
      else if (grade === 'F') adjustedSpeed = 10; // Critical condition/Bypasses
    }

    const totalMinutes = (nearestHospitalDist / adjustedSpeed) * 60;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} mins`;
  }, [nearestHospitalDist, roadQuality]);

  // 🔋 Predicted Battery Drain Logic: 0.15% per minute for high-intensity navigation
  const batteryDrain = useMemo(() => {
    const duration = pathAnalytics?.duration || (totalDistance / 40) * 60;
    if (duration <= 0) return 0;
    return Math.round(duration * 0.15);
  }, [pathAnalytics, totalDistance]);

  // � Total Descent (Cumulative Elevation Loss) Logic
  const totalDescent = useMemo(() => {
    if (elevationData.length < 2) return 0;
    return elevationData.reduce((acc, curr, i, arr) => {
      if (i === 0) return 0;
      const diff = curr - arr[i - 1];
      return diff < 0 ? acc + Math.abs(diff) : acc;
    }, 0);
  }, [elevationData]);

  // 🏔️ Total Climb (Cumulative Elevation Gain) Logic
  const totalClimb = useMemo(() => {
    if (elevationData.length < 2) return 0;
    return elevationData.reduce((acc, curr, i, arr) => {
      if (i === 0) return 0;
      const diff = curr - arr[i - 1];
      return diff > 0 ? acc + diff : acc;
    }, 0);
  }, [elevationData]);

  // ⚡ Fuel Recovery Percentage Logic
  const recoveryPercentage = useMemo(() => {
    if (totalDescent <= 0) return 0;
    // Mirror the fuelEstimate logic: 5% per 100m descent, capped at 30%
    const recovery = Math.min(0.3, (totalDescent / 100) * 0.05);
    return Math.round(recovery * 100);
  }, [totalDescent]);

  // 🔋 Energy Optimization Logic: Finds the shortest duration route if drain is critical
  const energyRecommendation = useMemo(() => {
    const currentDrain = batteryDrain;
    if (currentDrain <= 50 || !comparisonData || comparisonData.length === 0) return null;

    // Find the alternative with the lowest duration (lowest drain)
    const mostEfficient = [...comparisonData].sort((a, b) => a.duration - b.duration)[0];

    // Calculate drain for this alternative
    const altDrain = Math.round(mostEfficient.duration * 0.15);

    if (altDrain < currentDrain) {
      return { name: mostEfficient.name, savings: currentDrain - altDrain };
    }
    return null;
  }, [batteryDrain, comparisonData]);

  // ⛽ Fuel Efficiency Estimate: Distance + Elevation Grade + Traffic
  const fuelEstimate = useMemo(() => {
    if (totalDistance === 0) return 0;

    // Base rates in L/km based on vehicle class
    const fuelRates: Record<string, number> = {
      motorcycle: 0.025, // 2.5L/100km
      car: 0.08,        // 8L/100km
      suv: 0.12,        // 12L/100km
      bus: 0.25,        // 25L/100km
      truck: 0.30       // 30L/100km
    };

    const baseRate = fuelRates[vehicleType || 'car'] || 0.08;

    // Terrain Penalty: +15% consumption for every 100m of cumulative elevation gain
    let terrainPenalty = 1;
    if (totalClimb > 0) {
      terrainPenalty = 1 + (totalClimb / 100) * 0.15;
    }

    // Fuel Recovery: -5% consumption for every 100m of cumulative elevation loss (Descent)
    // Simulates deceleration fuel cut-off or energy recovery for Hybrids/EVs
    let descentRecovery = 1;
    if (totalDescent > 0) {
      descentRecovery = 1 - (totalDescent / 100) * 0.05;
      // Ensure recovery doesn't exceed 30% total reduction to stay realistic (Auxiliary loads remain)
      descentRecovery = Math.max(0.7, descentRecovery);
    }

    return totalDistance * baseRate * trafficIntensity * terrainPenalty * descentRecovery;
  }, [totalDistance, totalClimb, totalDescent, trafficIntensity, vehicleType]);

  // 📊 Efficiency Calculator: L/100km including terrain and traffic factors
  const efficiencyRate = useMemo(() => {
    if (totalDistance <= 0) return 0;
    return (fuelEstimate / totalDistance) * 100;
  }, [fuelEstimate, totalDistance]);

  const efficiencyGrade = useMemo(() => {
    if (efficiencyRate === 0) return { label: 'N/A', color: 'text-slate-400' };
    if (efficiencyRate < 6) return { label: 'Eco', color: 'text-emerald-500' };
    if (efficiencyRate < 12) return { label: 'Standard', color: 'text-amber-500' };
    return { label: 'High Consumption', color: 'text-rose-500' };
  }, [efficiencyRate]);

  // ⚠️ Range Anxiety Logic: Triggers if fuel needed exceeds typical tank size
  const rangeAnxiety = useMemo(() => {
    if (totalDistance === 0) return false;
    const tankCapacities: Record<string, number> = {
      motorcycle: 12,
      car: 45,
      suv: 70,
      bus: 200,
      truck: 300
    };
    // Prioritize user-defined capacity from profile, fallback to vehicle defaults
    const capacity = customTankCapacity || tankCapacities[vehicleType || 'car'] || 45;
    return fuelEstimate > capacity;
  }, [fuelEstimate, vehicleType, totalDistance, customTankCapacity]);

  // 🌿 Carbon Footprint Estimate: ~2.31kg of CO2 per Liter of gasoline
  const co2Estimate = useMemo(() => {
    return fuelEstimate * 2.31;
  }, [fuelEstimate]);

  // 🌱 Carbon Offset Logic: A mature tree absorbs ~22kg of CO2 per year
  const offsetTrees = useMemo(() => {
    if (co2Estimate <= 0) return 0;
    return co2Estimate / 22;
  }, [co2Estimate]);

  // 💰 Financial Estimate: Fuel Consumption * Current Market Price
  const costEstimate = useMemo(() => {
    return fuelEstimate * fuelPrice;
  }, [fuelEstimate, fuelPrice]);

  const handleDownloadGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          name: "MeroSadak Measured Path",
          distanceKm: totalDistance.toFixed(2),
          timestamp: new Date().toISOString()
        },
        geometry: {
          type: "LineString",
          coordinates: points.map(p => [p.lng, p.lat])
        }
      }]
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `merosadak_path_${Date.now()}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const profileView = useMemo(() => {
    if (elevationData.length < 2) return null;

    const minElev = Math.min(...elevationData);
    const maxElev = Math.max(...elevationData);
    const range = Math.max(100, maxElev - minElev);

    const polylinePoints = elevationData.map((elev, i) => {
      const x = (i / (elevationData.length - 1)) * 100;
      const y = 90 - ((elev - minElev) / range) * 70;
      return `${x},${y}`;
    }).join(' ');

    const fillPoints = `0,100 ${polylinePoints} 100,100`;

    // 🚩 Steepness Alert Logic: Find segments where grade > 10%
    const steepSegments = [];
    for (let i = 1; i < elevationData.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const distMeters = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1000;
      const riseMeters = Math.abs(elevationData[i] - elevationData[i - 1]);

      if (distMeters > 0 && (riseMeters / distMeters) * 100 > 10) {
        steepSegments.push({
          x1: ((i - 1) / (elevationData.length - 1)) * 100,
          y1: 90 - ((elevationData[i - 1] - minElev) / range) * 70,
          x2: (i / (elevationData.length - 1)) * 100,
          y2: 90 - ((elevationData[i] - minElev) / range) * 70,
        });
      }
    }

    // User Elevation Indicator Y position
    let userY = null;
    if (userElevation !== undefined) {
      userY = 90 - ((userElevation - minElev) / range) * 70;
      userY = Math.max(10, Math.min(95, userY)); // Clamping for visibility
    }

    // Dynamic Colors based on Night Vision and High Contrast
    const primaryColor = isHighContrast
      ? (isNightVision ? '#ff0000' : '#000000')
      : (isNightVision ? '#ef4444' : 'var(--color-primary, #3b82f6)');

    const gradientStop1 = isHighContrast
      ? (isNightVision ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)')
      : (isNightVision ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-primary, #3b82f6)');

    const chartBg = isHighContrast
      ? (isNightVision ? 'bg-black border-red-600' : 'bg-white border-black')
      : (isNightVision ? 'bg-red-950/20 border-red-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-black/5 dark:border-white/5');

    return (
      <div className={`mt-4 h-24 w-full rounded-2xl overflow-hidden relative border transition-colors duration-500 ${chartBg}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="elevGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={gradientStop1} stopOpacity={isHighContrast ? 0.6 : 0.3} />
              <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <polygon points={fillPoints} fill="url(#elevGradient)" />
          <polyline fill="none" stroke={primaryColor} strokeWidth="2" points={polylinePoints} />

          {/* Highlight Steep Segments */}
          {steepSegments.map((seg, idx) => (
            <line
              key={idx}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke="#f43f5e"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}

          {userY !== null && (
            <g className="animate-in fade-in duration-1000">
              <line x1="0" y1={userY} x2="100" y2={userY} stroke={primaryColor} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
              <circle cx="2" cy={userY} r="2.5" fill={primaryColor} className="animate-pulse" />
            </g>
          )}
        </svg>

        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 size={16} className="text-primary animate-spin" />
          </div>
        )}

        <div className="absolute top-1 left-2 right-2 text-[7px] font-black uppercase tracking-widest flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant/40">{minElev}m - {maxElev}m Profile</span>
            {steepSegments.length > 0 && (
              <span className="text-rose-500 animate-pulse flex items-center gap-1">
                <AlertTriangle size={8} /> Steep Grade Detected
              </span>
            )}
          </div>
          {userElevation && <span className={isNightVision ? 'text-red-500' : 'text-primary'}>• You: {Math.round(userElevation)}m</span>}
        </div>
      </div>
    );
  }, [elevationData, isLoading, userElevation, points, isNightVision, isHighContrast]);

  return (
    <div className={`fixed top-24 right-4 md:right-8 w-[calc(100vw-2rem)] md:w-72 z-[1500] duration-300 ${isOpen ? 'animate-in slide-in-from-right-4' : 'animate-out slide-out-to-right-4'}`}>
      <div className={`rounded-[2rem] border shadow-2xl overflow-hidden transition-colors duration-300 ${isHighContrast
        ? (isNightVision ? 'bg-black border-red-600' : 'bg-white border-black')
        : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/20 dark:border-slate-800'
        }`}>
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2 text-primary">
            <Ruler size={18} />
            <span className="font-black text-xs uppercase tracking-widest">Route Intelligence</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter mb-1">Total Distance</div>
          <div className="text-4xl font-black text-primary font-headline">
            {totalDistance.toFixed(2)}<span className="text-sm ml-1 text-on-surface-variant">KM</span>
          </div>

          {/* Landslide Severity Selector */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest">
              <Thermometer size={10} /> Simulated Risk Level
            </div>
            <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-full max-w-[200px]">
              {['low', 'medium', 'high'].map((s) => (
                <button
                  key={s}
                  onClick={() => onSeverityChange(s)}
                  className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${landslideSeverity === s
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-on-surface-variant/50 hover:text-on-surface-variant'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Traffic Intensity Slider */}
          <div className="mt-4 flex flex-col items-center gap-2 w-full px-4">
            <div className="flex items-center gap-1.5 text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest">
              <Gauge size={10} /> Traffic Intensity: {trafficIntensity.toFixed(1)}x
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={trafficIntensity}
              onChange={(e) => onTrafficChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between w-full text-[7px] font-bold text-on-surface-variant/30 uppercase">
              <span>Clear</span>
              <span>Heavy</span>
            </div>
          </div>

          {totalDistance > 0 && (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-2xl text-emerald-600 animate-in fade-in zoom-in-95">
                <Fuel size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  Est. Fuel: <span className="text-emerald-500">{fuelEstimate.toFixed(1)}L</span>
                </span>
                <div className={`text-[7px] font-black uppercase tracking-widest mt-1 ${efficiencyGrade.color}`}>
                  {efficiencyGrade.label} • {efficiencyRate.toFixed(1)} L/100KM
                </div>
              </div>
              {recoveryPercentage > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/5 rounded-full text-[7px] font-black text-emerald-500 uppercase tracking-tighter animate-pulse border border-emerald-500/10">
                  <Zap size={8} fill="currentColor" /> Recovery Active: -{recoveryPercentage}%
                </div>
              )}
              {rangeAnxiety && (
                <div className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 rounded-full text-rose-600 animate-bounce border border-rose-500/20">
                  <AlertTriangle size={10} />
                  <span className="text-[8px] font-black uppercase tracking-tighter">
                    Range Warning: Refuel needed mid-trip
                  </span>
                </div>
              )}
            </div>
          )}

          {totalDistance > 0 && batteryLevel !== null && (
            <div className="mt-2 flex flex-col items-center gap-1.5 w-full">
              <div className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-2xl animate-in fade-in zoom-in-95 transition-colors ${batteryDrain > 50 ? 'bg-error/10 text-error border border-error/20' : 'bg-orange-500/10 text-orange-600'}`}>
                {batteryDrain > 50 ? <ShieldAlert size={12} className="animate-pulse" /> : <Battery size={12} />}
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {batteryDrain > 50 ? 'Critical Drain: ' : 'Est. Drain: '}
                  <span className={batteryDrain > 50 ? 'text-error' : 'text-orange-500'}>-{batteryDrain}%</span>
                  <span className="ml-1 opacity-60">({Math.max(0, batteryLevel - batteryDrain)}% Left)</span>
                </span>
              </div>

              {batteryDrain > 50 && (
                <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-[1.5rem] bg-error/5 border border-error/10 w-full animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-error text-[8px] font-black uppercase tracking-tighter">
                    <Zap size={10} fill="currentColor" /> Low Power Routing Advised
                  </div>
                  <p className="text-[9px] text-on-surface-variant/60 font-medium text-center">
                    Current path will consume more than 50% of remaining charge.
                  </p>
                  {energyRecommendation && (
                    <div className="mt-2 flex items-center gap-2 text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg text-[8px] font-black uppercase">
                      <Navigation size={8} /> Switch to {energyRecommendation.name} (Saves {energyRecommendation.savings}% Battery)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {totalDistance > 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-2xl text-blue-600 animate-in fade-in zoom-in-95">
              <Banknote size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">
                Est. Cost: <span className="text-blue-500">Rs. {costEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </span>
            </div>
          )}

          {totalDistance > 0 && (
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-teal-500/10 rounded-2xl text-teal-600 animate-in fade-in zoom-in-95 w-full max-w-[220px]">
                <Leaf size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  CO2 Impact: <span className="text-teal-500">{co2Estimate.toFixed(1)} KG</span>
                </span>
              </div>

              {offsetTrees > 0.05 && (
                <div className="flex items-center gap-1.5 text-[7px] font-black text-teal-600/60 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
                  <Sprout size={10} />
                  <span>Offset Goal: Plant {offsetTrees.toFixed(1)} trees to neutralize this trip</span>
                </div>
              )}
            </div>
          )}

          {travelTime && (
            <div className="mt-1 flex items-center justify-center gap-1.5 text-on-surface-variant/60 font-bold animate-in fade-in slide-in-from-bottom-1">
              <Clock size={12} />
              <span className={`text-[10px] uppercase tracking-widest ${pathAnalytics?.delay ? 'text-amber-500' : ''}`}>
                Est. Time: {travelTime}
                {pathAnalytics?.delay ? ` (+${pathAnalytics.delay}m delay)` : ''}
              </span>
            </div>
          )}

          {pathAnalytics?.landslides ? (
            <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full text-amber-600 animate-pulse">
              <AlertTriangle size={10} />
              <span className="text-[8px] font-black uppercase tracking-tighter">
                {pathAnalytics.landslides} Landslide(s) detected on path
              </span>
            </div>
          ) : null}

          {pathAnalytics?.hazards && pathAnalytics.hazards.length > 0 && (
            <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <AlertTriangle size={14} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Route Hazard Alert</span>
              </div>
              <p className="text-[9px] text-on-surface-variant/70 font-medium text-left">
                Detected {pathAnalytics.hazards.length} infrastructure restriction(s). Hazard markers have been added to your map for visual verification.
              </p>
            </div>
          )}

          {profileView}
        </div>

        {(totalClimb > 0 || totalDescent > 0) && (
          <div className="px-6 pb-2 space-y-1">
            {totalClimb > 0 && (
              <div className="flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                <Mountain size={12} className="text-amber-600/60" />
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                  Total Climb: <span className="text-amber-600">{Math.round(totalClimb)} METERS</span>
                </span>
              </div>
            )}
            {totalDescent > 0 && (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <Mountain size={12} className="text-rose-600/60 rotate-180" />
                  <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                    Total Descent: <span className="text-rose-600">{Math.round(totalDescent)} METERS</span>
                  </span>
                </div>
                {totalDescent > 500 && (
                  <span className="text-[7px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">⚠️ Brake Fade Risk: Use Low Gear</span>
                )}
              </div>
            )}
          </div>
        )}

        {isEmergencyMode && nearestHospitalDist !== null && (
          <div className="px-6 pb-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
            <Hospital size={12} className="text-error" />
            <span className="text-[9px] font-black text-error uppercase tracking-widest">
              Nearest Hospital:
              <span className="ml-1">{nearestHospitalDist.toFixed(2)} KM</span>
              <span className="ml-2 opacity-60">({hospitalTravelTime})</span>
            </span>
          </div>
        )}

        {nearestIntersectionDist !== null && (
          <div className="px-6 pb-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
            <MapPin size={12} className="text-primary/60" />
            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
              Nearest Junction:
              <span className="ml-1 text-primary">{nearestIntersectionDist?.toFixed(2)} KM</span>
            </span>
          </div>
        )}

        <div className="p-3 bg-gray-50 dark:bg-slate-800/50 grid grid-cols-8 gap-1 border-t border-outline/5">
          <button onClick={onUndo} disabled={points.length === 0} className="py-2 rounded-xl flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-on-surface text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 disabled:opacity-50 transition-colors">
            <RotateCcw size={14} className={points.length === 0 ? 'opacity-20' : ''} />
          </button>
          <button onClick={onClear} disabled={points.length === 0} className="py-2 rounded-xl flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-error text-[10px] font-black uppercase tracking-widest hover:bg-error/5 disabled:opacity-50 transition-colors">
            <Trash2 size={14} className={points.length === 0 ? 'opacity-20' : ''} />
          </button>
          <button onClick={onToggleGreenRoute} title={isGreenRoute ? "Green Route: ON" : "Green Route: OFF"} className={`relative py-2 rounded-xl flex items-center justify-center gap-2 border transition-all duration-300 ${isGreenRoute ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-emerald-600/60'}`}>
            <Leaf size={14} className={isGreenRoute ? 'animate-pulse' : ''} />
          </button>
          <button onClick={onToggleEmergency} title={isEmergencyMode ? "Emergency Snap: ON" : "Emergency Snap: OFF"} className={`py-2 rounded-xl flex items-center justify-center gap-2 border transition-all duration-300 ${isEmergencyMode ? 'bg-error text-white border-error shadow-lg shadow-error/20 scale-105' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-error/60'}`}>
            <Stethoscope size={14} className={isEmergencyMode ? 'animate-pulse' : ''} />
          </button>
          <button onClick={onAvoidLandslides} title="Avoid Landslides" disabled={!pathAnalytics?.landslides} className={`py-2 rounded-xl flex items-center justify-center gap-2 border transition-all ${pathAnalytics?.landslides ? 'bg-amber-100 border-amber-500 text-amber-600 hover:bg-amber-200' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 opacity-20 cursor-not-allowed'}`}>
            <ShieldAlert size={14} />
          </button>
          <button onClick={onToggleSnap} title={isSnapping ? "Snap to Road: ON" : "Snap to Road: OFF"} className={`py-2 rounded-xl flex items-center justify-center gap-2 border transition-all duration-300 ${isSnapping ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-on-surface-variant'}`}>
            <Magnet size={14} className={isSnapping ? 'animate-pulse' : ''} />
          </button>
          <button onClick={onShare} disabled={points.length === 0} className="py-2 rounded-xl flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-on-surface text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 disabled:opacity-50 transition-colors">
            <Share2 size={14} className={points.length === 0 ? 'opacity-20' : ''} />
          </button>
          <button onClick={handleDownloadGeoJSON} disabled={points.length < 2} className="py-2 rounded-xl flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 disabled:opacity-50 transition-colors">
            <Download size={14} className={points.length < 2 ? 'opacity-20' : ''} />
          </button>
        </div>
      </div>
    </div >
  );
};

export const DistanceCalculator = RouteIntelligence;