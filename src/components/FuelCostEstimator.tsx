import React, { useState, useMemo, useEffect } from 'react';
import { VehicleType, CityNode } from '../types';
import {
  Fuel,
  Zap,
  DollarSign,
  TrendingDown,
  Users,
  Mountain,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  Car,
  Bike,
  Truck,
  Leaf,
  ChevronDown,
  ChevronUp,
  Receipt,
  ShieldCheck,
  Wrench,
  Ambulance,
  PhoneCall,
  CheckCircle2,
  Copy,
  Check,
  Utensils,
  CreditCard,
  Layers,
} from 'lucide-react';

interface FuelCostEstimatorProps {
  distanceKm: number;
  vehicleType: VehicleType;
  elevationGainM?: number;
  origin?: CityNode;
  destination?: CityNode;
  defaultTollCost?: number;
  onVehicleChange?: (vehicle: VehicleType) => void;
  className?: string;
}

interface VehicleBenchmark {
  defaultMileage: number; // km/L or km/kWh
  unit: string;
  defaultFuelType: 'petrol' | 'diesel' | 'electricity';
  defaultRateNpr: number;
  label: string;
  icon: any;
  co2GramsPerKm: number;
  tollMultiplier: number;
}

const VEHICLE_BENCHMARKS: Record<VehicleType, VehicleBenchmark> = {
  car: {
    defaultMileage: 14,
    unit: 'km/L',
    defaultFuelType: 'petrol',
    defaultRateNpr: 172,
    label: 'Car / Sedan / Hatchback',
    icon: Car,
    co2GramsPerKm: 142,
    tollMultiplier: 1.0,
  },
  suv_4wd: {
    defaultMileage: 10,
    unit: 'km/L',
    defaultFuelType: 'diesel',
    defaultRateNpr: 160,
    label: 'SUV / 4WD Jeep',
    icon: Mountain,
    co2GramsPerKm: 198,
    tollMultiplier: 1.4,
  },
  motorbike: {
    defaultMileage: 35,
    unit: 'km/L',
    defaultFuelType: 'petrol',
    defaultRateNpr: 172,
    label: 'Motorcycle / Scooter',
    icon: Bike,
    co2GramsPerKm: 65,
    tollMultiplier: 0.4,
  },
  bus_truck: {
    defaultMileage: 4.5,
    unit: 'km/L',
    defaultFuelType: 'diesel',
    defaultRateNpr: 160,
    label: 'Bus / Heavy Truck',
    icon: Truck,
    co2GramsPerKm: 580,
    tollMultiplier: 2.8,
  },
  electric_vehicle: {
    defaultMileage: 6.5,
    unit: 'km/kWh',
    defaultFuelType: 'electricity',
    defaultRateNpr: 8.5,
    label: 'Electric Vehicle (EV)',
    icon: Zap,
    co2GramsPerKm: 18,
    tollMultiplier: 1.0,
  },
};

interface TollItem {
  id: string;
  name: string;
  location: string;
  baseCostNpr: number;
  enabled: boolean;
  notes: string;
}

interface EmergencyServiceItem {
  id: string;
  name: string;
  description: string;
  costNpr: number;
  icon: any;
  enabled: boolean;
  recommended: boolean;
}

export const FuelCostEstimator: React.FC<FuelCostEstimatorProps> = ({
  distanceKm,
  vehicleType,
  elevationGainM = 0,
  origin,
  destination,
  defaultTollCost = 60,
  onVehicleChange,
  className = '',
}) => {
  const currentBenchmark = VEHICLE_BENCHMARKS[vehicleType] || VEHICLE_BENCHMARKS.car;

  // Custom fuel configuration state
  const [customMileage, setCustomMileage] = useState<number>(currentBenchmark.defaultMileage);
  const [customFuelRate, setCustomFuelRate] = useState<number>(currentBenchmark.defaultRateNpr);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);
  const [passengers, setPassengers] = useState<number>(1);
  const [includeAcAndLoad, setIncludeAcAndLoad] = useState<boolean>(false);
  const [includeMountainGradient, setIncludeMountainGradient] = useState<boolean>(elevationGainM > 400);

  // Toll Fees State
  const [tolls, setTolls] = useState<TollItem[]>([
    {
      id: 'nagdhunga_tunnel',
      name: 'Nagdhunga Tunnel Bypass Toll',
      location: 'Sisne Khola - Nagdhunga (H02)',
      baseCostNpr: 60,
      enabled: true,
      notes: 'Active RFID FASTag & Cash Toll',
    },
    {
      id: 'expressway_cess',
      name: 'Municipal Road Maintenance Cess',
      location: 'Mugling / Narayangadh corridor',
      baseCostNpr: 35,
      enabled: distanceKm > 80,
      notes: 'Local bridge and road upkeep fee',
    },
    {
      id: 'terai_corridor_toll',
      name: 'East-West Highway Entry Toll',
      location: 'H01 Hetauda / Pathlaiya Junction',
      baseCostNpr: 40,
      enabled: distanceKm > 150,
      notes: 'National Highway Road User Fee',
    },
  ]);

  // Emergency Assistance & Protection Services
  const [emergencyServices, setEmergencyServices] = useState<EmergencyServiceItem[]>([
    {
      id: 'dor_towing',
      name: 'DOR Heavy Hydraulic Towing & Recovery Standby',
      description: 'Emergency crane and winch recovery from landslide & gorge breakdown zones',
      costNpr: 350,
      icon: Truck,
      enabled: true,
      recommended: elevationGainM > 300 || distanceKm > 100,
    },
    {
      id: 'puncture_mechanic',
      name: 'Mountain Pass Mechanic & Puncture Contingency',
      description: 'On-demand tire repair, emergency battery boost, radiator coolant support',
      costNpr: 250,
      icon: Wrench,
      enabled: true,
      recommended: true,
    },
    {
      id: 'patrol_dispatch',
      name: '24/7 Traffic Police & Medic Rapid Rescue Fund',
      description: 'Direct priority emergency dispatch and first-aid medical standby hotline (103/1114)',
      costNpr: 100,
      icon: Ambulance,
      enabled: false,
      recommended: false,
    },
  ]);

  // Optional Meal & Dhaba Allowance
  const [includeMeals, setIncludeMeals] = useState<boolean>(false);
  const [mealRatePerPerson, setMealRatePerPerson] = useState<number>(250);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // Sync with vehicle type changes from parent
  useEffect(() => {
    setCustomMileage(currentBenchmark.defaultMileage);
    setCustomFuelRate(currentBenchmark.defaultRateNpr);
  }, [vehicleType]);

  // Sync mountain gradient if elevation changes
  useEffect(() => {
    if (elevationGainM > 400) {
      setIncludeMountainGradient(true);
    }
  }, [elevationGainM]);

  // Toggle toll item
  const handleToggleToll = (id: string) => {
    setTolls((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  // Toggle emergency service
  const handleToggleEmergencyService = (id: string) => {
    setEmergencyServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Reset to Nepal standard defaults
  const handleResetDefaults = () => {
    setCustomMileage(currentBenchmark.defaultMileage);
    setCustomFuelRate(currentBenchmark.defaultRateNpr);
    setIsRoundTrip(false);
    setPassengers(1);
    setIncludeAcAndLoad(false);
    setIncludeMountainGradient(elevationGainM > 400);
    setIncludeMeals(false);
    setMealRatePerPerson(250);
    setTolls((prev) => prev.map((t) => ({ ...t, enabled: true })));
    setEmergencyServices((prev) => [
      { ...prev[0], enabled: true },
      { ...prev[1], enabled: true },
      { ...prev[2], enabled: false },
    ]);
  };

  // Comprehensive Calculations
  const calculation = useMemo(() => {
    const effectiveDistance = isRoundTrip ? distanceKm * 2 : distanceKm;
    const multiplier = isRoundTrip ? 2 : 1;

    // 1. Fuel / Electric Power Calculation
    let terrainFactor = 1.0;
    if (includeMountainGradient) terrainFactor += 0.12; // +12% for steep hill climbing in lower gears
    if (includeAcAndLoad) terrainFactor += 0.08; // +8% for AC and luggage weight

    const effectiveMileage = Math.max(1, customMileage / terrainFactor);
    const totalFuelVolume = effectiveDistance / effectiveMileage;
    const totalFuelCostNpr = Math.round(totalFuelVolume * customFuelRate);

    // 2. Toll Calculation (adjusted by vehicle type tariff multiplier)
    const tollMultiplier = currentBenchmark.tollMultiplier;
    const totalTollsNpr = tolls.reduce((sum, item) => {
      if (!item.enabled) return sum;
      const rateForVehicle = Math.round(item.baseCostNpr * tollMultiplier);
      return sum + rateForVehicle * multiplier;
    }, 0);

    // 3. Emergency Assistance & Contingency
    const totalEmergencyNpr = emergencyServices.reduce((sum, item) => {
      if (!item.enabled) return sum;
      return sum + item.costNpr * (isRoundTrip ? 1.5 : 1);
    }, 0);

    // 4. Meal / Refreshment allowance
    const totalMealsNpr = includeMeals ? mealRatePerPerson * Math.max(1, passengers) * multiplier : 0;

    // 5. Grand Total Trip Cost
    const grandTotalNpr = totalFuelCostNpr + totalTollsNpr + totalEmergencyNpr + totalMealsNpr;
    const costPerKm = effectiveDistance > 0 ? (grandTotalNpr / effectiveDistance).toFixed(2) : '0';
    const costPerPerson = Math.round(grandTotalNpr / Math.max(1, passengers));
    const fuelCostPerPerson = Math.round(totalFuelCostNpr / Math.max(1, passengers));
    const totalCo2Kg = Math.round(((effectiveDistance * currentBenchmark.co2GramsPerKm) / 1000) * 10) / 10;

    // Cost distribution percentages
    const fuelPercent = grandTotalNpr > 0 ? Math.round((totalFuelCostNpr / grandTotalNpr) * 100) : 0;
    const tollPercent = grandTotalNpr > 0 ? Math.round((totalTollsNpr / grandTotalNpr) * 100) : 0;
    const emergencyPercent = grandTotalNpr > 0 ? Math.round((totalEmergencyNpr / grandTotalNpr) * 100) : 0;
    const mealPercent = grandTotalNpr > 0 ? Math.round((totalMealsNpr / grandTotalNpr) * 100) : 0;

    return {
      effectiveDistance,
      effectiveMileage: Math.round(effectiveMileage * 10) / 10,
      totalFuelVolume: Math.round(totalFuelVolume * 10) / 10,
      totalFuelCostNpr,
      totalTollsNpr,
      totalEmergencyNpr,
      totalMealsNpr,
      grandTotalNpr,
      costPerKm,
      costPerPerson,
      fuelCostPerPerson,
      totalCo2Kg,
      fuelPercent,
      tollPercent,
      emergencyPercent,
      mealPercent,
      unit: currentBenchmark.unit,
      rateUnit: vehicleType === 'electric_vehicle' ? 'NPR/kWh' : 'NPR/L',
      volumeUnit: vehicleType === 'electric_vehicle' ? 'kWh' : 'Liters',
    };
  }, [
    distanceKm,
    isRoundTrip,
    customMileage,
    customFuelRate,
    includeMountainGradient,
    includeAcAndLoad,
    passengers,
    tolls,
    emergencyServices,
    includeMeals,
    mealRatePerPerson,
    currentBenchmark,
    vehicleType,
  ]);

  // Comparison across all vehicle types for this exact distance & tolls
  const vehicleComparisons = useMemo(() => {
    const effectiveDist = isRoundTrip ? distanceKm * 2 : distanceKm;
    const multiplier = isRoundTrip ? 2 : 1;

    return (Object.keys(VEHICLE_BENCHMARKS) as VehicleType[]).map((vKey) => {
      const b = VEHICLE_BENCHMARKS[vKey];
      let tFactor = 1.0;
      if (includeMountainGradient) tFactor += 0.12;
      if (includeAcAndLoad) tFactor += 0.08;
      const effMileage = Math.max(1, b.defaultMileage / tFactor);
      const volume = effectiveDist / effMileage;
      const fuelCost = Math.round(volume * b.defaultRateNpr);

      // Vehicle toll multiplier
      const tollCost = tolls.reduce((sum, item) => {
        if (!item.enabled) return sum;
        return sum + Math.round(item.baseCostNpr * b.tollMultiplier) * multiplier;
      }, 0);

      const emergencyCost = emergencyServices.reduce((sum, item) => {
        if (!item.enabled) return sum;
        return sum + item.costNpr * (isRoundTrip ? 1.5 : 1);
      }, 0);

      const totalTripCost = fuelCost + tollCost + emergencyCost + (includeMeals ? calculation.totalMealsNpr : 0);
      const co2 = Math.round(((effectiveDist * b.co2GramsPerKm) / 1000) * 10) / 10;

      return {
        type: vKey,
        label: b.label,
        icon: b.icon,
        fuelCost,
        tollCost,
        totalTripCost,
        volume: Math.round(volume * 10) / 10,
        unit: b.unit,
        volUnit: vKey === 'electric_vehicle' ? 'kWh' : 'L',
        co2,
        isCurrent: vKey === vehicleType,
      };
    });
  }, [
    distanceKm,
    isRoundTrip,
    includeMountainGradient,
    includeAcAndLoad,
    vehicleType,
    tolls,
    emergencyServices,
    includeMeals,
    calculation.totalMealsNpr,
  ]);

  // Copy receipt summary to clipboard
  const handleCopyReceipt = () => {
    const fromName = origin?.name || 'Origin';
    const toName = destination?.name || 'Destination';
    const receiptText = `🚗 MERO SADAK NEPAL - TRIP EXPENSE ESTIMATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Route: ${fromName} ➔ ${toName}
Distance: ${calculation.effectiveDistance} km (${isRoundTrip ? 'Round-Trip' : 'One-Way'})
Vehicle: ${currentBenchmark.label}
Passengers: ${passengers} person(s)

🧾 COST BREAKDOWN:
• Fuel / EV Energy: Rs. ${calculation.totalFuelCostNpr.toLocaleString()} (${calculation.totalFuelVolume} ${calculation.volumeUnit} @ ${calculation.effectiveMileage} ${calculation.unit})
• Highway Toll Plazas: Rs. ${calculation.totalTollsNpr.toLocaleString()}
• Emergency Assistance & Recovery: Rs. ${calculation.totalEmergencyNpr.toLocaleString()}
${includeMeals ? `• Highway Dhaba & Meals: Rs. ${calculation.totalMealsNpr.toLocaleString()}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 GRAND TOTAL: Rs. ${calculation.grandTotalNpr.toLocaleString()}
👤 Cost per Person: Rs. ${calculation.costPerPerson.toLocaleString()} / person
🛣️ Cost per KM: Rs. ${calculation.costPerKm} / km
🌱 Est. CO2: ${calculation.totalCo2Kg} kg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated via Mero Sadak Nepal Highway GIS`;

    navigator.clipboard.writeText(receiptText);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 ${className}`}
      id="fuel-cost-estimator"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            {vehicleType === 'electric_vehicle' ? <Zap className="w-4 h-4 text-cyan-400" /> : <Fuel className="w-4 h-4 text-amber-400" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white font-display">Total Trip Cost & Expense Estimator</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Fuel • Tolls • DOR Recovery
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Estimates total highway journey budget including fuel/energy, tunnel tolls, and emergency roadside protection
            </p>
          </div>
        </div>

        {/* Direction Toggle: One-Way vs Round-Trip */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
          <button
            onClick={() => setIsRoundTrip(false)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              !isRoundTrip
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            One-Way ({distanceKm} km)
          </button>
          <button
            onClick={() => setIsRoundTrip(true)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              isRoundTrip
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Round-Trip ({distanceKm * 2} km)
          </button>
        </div>
      </div>

      {/* Main Grand Total Banner & Highlight Bento */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-4 rounded-xl border border-amber-500/30 relative overflow-hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
              Estimated Total Trip Expense (All Included)
            </span>
            <div className="text-3xl sm:text-4xl font-black text-amber-300 font-display tracking-tight mt-0.5">
              Rs. {calculation.grandTotalNpr.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center space-x-3 text-right">
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-left">
              <span className="text-[10px] text-slate-400 block font-medium">Per Passenger ({passengers} pax)</span>
              <strong className="text-base text-cyan-400 font-bold">
                Rs. {calculation.costPerPerson.toLocaleString()}
              </strong>
            </div>

            <button
              onClick={handleCopyReceipt}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5 shadow-sm"
              title="Copy formatted cost breakdown receipt"
            >
              {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedReceipt ? 'Copied!' : 'Copy Receipt'}</span>
            </button>
          </div>
        </div>

        {/* Visual Cost Distribution Bar */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${calculation.fuelPercent}%` }}
              className="bg-amber-400 h-full transition-all"
              title={`Fuel: ${calculation.fuelPercent}%`}
            />
            <div
              style={{ width: `${calculation.tollPercent}%` }}
              className="bg-cyan-400 h-full transition-all"
              title={`Tolls: ${calculation.tollPercent}%`}
            />
            <div
              style={{ width: `${calculation.emergencyPercent}%` }}
              className="bg-rose-400 h-full transition-all"
              title={`Emergency: ${calculation.emergencyPercent}%`}
            />
            {includeMeals && (
              <div
                style={{ width: `${calculation.mealPercent}%` }}
                className="bg-emerald-400 h-full transition-all"
                title={`Meals: ${calculation.mealPercent}%`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Fuel/EV: Rs. {calculation.totalFuelCostNpr.toLocaleString()} ({calculation.fuelPercent}%)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Tolls: Rs. {calculation.totalTollsNpr.toLocaleString()} ({calculation.tollPercent}%)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Emergency/Safety: Rs. {calculation.totalEmergencyNpr.toLocaleString()} ({calculation.emergencyPercent}%)</span>
            </span>
            {includeMeals && (
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Meals: Rs. {calculation.totalMealsNpr.toLocaleString()} ({calculation.mealPercent}%)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4-Item Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Fuel / Power Card */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
            <span className="flex items-center space-x-1">
              <Fuel className="w-3.5 h-3.5" />
              <span>Fuel / Power</span>
            </span>
          </div>
          <div className="text-xl font-bold text-white font-display">
            Rs. {calculation.totalFuelCostNpr.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {calculation.totalFuelVolume} {calculation.volumeUnit} ({calculation.effectiveMileage} {calculation.unit})
          </span>
        </div>

        {/* Tolls Card */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold">
            <span className="flex items-center space-x-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Highway Tolls</span>
            </span>
          </div>
          <div className="text-xl font-bold text-white font-display">
            Rs. {calculation.totalTollsNpr.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {tolls.filter((t) => t.enabled).length} active toll booths
          </span>
        </div>

        {/* Emergency Assistance Card */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Safety & Recovery</span>
            </span>
          </div>
          <div className="text-xl font-bold text-white font-display">
            Rs. {calculation.totalEmergencyNpr.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {emergencyServices.filter((s) => s.enabled).length} emergency coverages
          </span>
        </div>

        {/* CO2 Footprint */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
            <span className="flex items-center space-x-1">
              <Leaf className="w-3.5 h-3.5" />
              <span>CO₂ Emissions</span>
            </span>
          </div>
          <div className="text-xl font-bold text-white font-display">
            {calculation.totalCo2Kg} <span className="text-xs font-normal text-slate-400">kg</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            {vehicleType === 'electric_vehicle' ? 'Zero direct tailpipe' : 'Standard highway emission'}
          </span>
        </div>
      </div>

      {/* Itemized Modules: Toll Plazas & Emergency Roadside Protection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module A: Highway Toll Plazas & Road Maintenance Fees */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <span>Highway Toll Plazas & Cess</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono font-semibold">
              Total: Rs. {calculation.totalTollsNpr.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            {tolls.map((toll) => {
              const vehicleTollRate = Math.round(toll.baseCostNpr * currentBenchmark.tollMultiplier * (isRoundTrip ? 2 : 1));
              return (
                <div
                  key={toll.id}
                  onClick={() => handleToggleToll(toll.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    toll.enabled
                      ? 'bg-slate-900 border-cyan-500/40 text-slate-200'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="checkbox"
                      checked={toll.enabled}
                      onChange={() => {}} // Handled by parent div
                      className="mt-0.5 w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700 pointer-events-none"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">{toll.name}</div>
                      <div className="text-[10px] text-slate-400">{toll.location} • {toll.notes}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-cyan-400">Rs. {vehicleTollRate}</span>
                    <span className="text-[9px] text-slate-500 block">
                      {isRoundTrip ? 'both ways' : 'one-way'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Module B: Emergency Assistance, Towing & Contingency Fund */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>Emergency Assistance & Recovery Fund</span>
            </div>
            <span className="text-[10px] text-rose-400 font-mono font-semibold">
              Total: Rs. {calculation.totalEmergencyNpr.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            {emergencyServices.map((service) => {
              const Icon = service.icon;
              const effectiveCost = service.costNpr * (isRoundTrip ? 1.5 : 1);
              return (
                <div
                  key={service.id}
                  onClick={() => handleToggleEmergencyService(service.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    service.enabled
                      ? 'bg-slate-900 border-rose-500/40 text-slate-200'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="checkbox"
                      checked={service.enabled}
                      onChange={() => {}} // Handled by parent div
                      className="mt-0.5 w-3.5 h-3.5 rounded text-rose-500 bg-slate-950 border-slate-700 pointer-events-none"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                        <Icon className="w-3.5 h-3.5 text-rose-400 inline shrink-0" />
                        <span>{service.name}</span>
                        {service.recommended && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-normal">
                            Rec.
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{service.description}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-rose-400">Rs. {effectiveCost}</span>
                    <span className="text-[9px] text-slate-500 block">standby fund</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Interactive Sliders & Surcharges Bar */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Passenger Count Stepper */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300 font-semibold flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Riders / Passengers:</span>
              </label>
              <span className="font-bold text-cyan-400">{passengers} {passengers === 1 ? 'pax' : 'pax'}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {[1, 2, 3, 4, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setPassengers(num)}
                  className={`flex-1 py-1 text-xs rounded-lg border font-semibold transition ${
                    passengers === num
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Mountain Gradient Surcharge Checkbox */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1">
                <Mountain className="w-3.5 h-3.5 text-purple-400" />
                <span>Mountain Ghat Climb</span>
              </label>
              <span className="text-[10px] text-slate-400 block">+12% low gear uphill</span>
            </div>
            <input
              type="checkbox"
              checked={includeMountainGradient}
              onChange={(e) => setIncludeMountainGradient(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* AC & Heavy Luggage Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>AC / Heavy Load</span>
              </label>
              <span className="text-[10px] text-slate-400 block">+8% cooling & load</span>
            </div>
            <input
              type="checkbox"
              checked={includeAcAndLoad}
              onChange={(e) => setIncludeAcAndLoad(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Meal / Dhaba Allowance Option */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1">
                <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                <span>Highway Dhaba Food</span>
              </label>
              <span className="text-[10px] text-slate-400 block">Rs. {mealRatePerPerson}/person tea & lunch</span>
            </div>
            <input
              type="checkbox"
              checked={includeMeals}
              onChange={(e) => setIncludeMeals(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Expandable Advanced Tuning & Rate Customizer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-400 hover:text-slate-200 font-semibold flex items-center space-x-1 transition"
          >
            <span>{showAdvanced ? 'Hide Custom Fuel Rates & Calibration' : 'Customize Fuel Price & Vehicle Mileage'}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1 transition"
          >
            <span>{showComparison ? 'Hide Vehicle Comparison' : 'Compare All Vehicle Types'}</span>
            {showComparison ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Advanced Inputs Drawer */}
        {showAdvanced && (
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
            {/* Custom Mileage */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Vehicle Mileage / Economy ({calculation.unit})
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={customMileage}
                onChange={(e) => setCustomMileage(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Benchmark: {currentBenchmark.defaultMileage} {calculation.unit}</span>
            </div>

            {/* Custom Fuel Rate */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Fuel / Power Rate ({calculation.rateUnit})
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={customFuelRate}
                onChange={(e) => setCustomFuelRate(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Nepal NOC/NEA standard: Rs. {currentBenchmark.defaultRateNpr}</span>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <button
                onClick={handleResetDefaults}
                className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Nepal Standard</span>
              </button>
            </div>
          </div>
        )}

        {/* Comparison Table Across Vehicles */}
        {showComparison && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/90 animate-fadeIn">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Vehicle Type</th>
                  <th className="p-2.5">Fuel Volume</th>
                  <th className="p-2.5">Fuel Expense</th>
                  <th className="p-2.5">Tolls & Fees</th>
                  <th className="p-2.5">Total Trip Cost</th>
                  <th className="p-2.5">CO₂ Emission</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {vehicleComparisons.map((item) => {
                  const Icon = item.icon;
                  return (
                    <tr
                      key={item.type}
                      className={`${
                        item.isCurrent ? 'bg-emerald-500/10 font-bold text-white' : 'hover:bg-slate-800/40 text-slate-300'
                      } transition`}
                    >
                      <td className="p-2.5 flex items-center space-x-2">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{item.label}</span>
                        {item.isCurrent && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-slate-400">
                        {item.volume} {item.volUnit}
                      </td>
                      <td className="p-2.5 font-mono text-amber-400">
                        Rs. {item.fuelCost.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono text-cyan-400">
                        Rs. {(item.tollCost + calculation.totalEmergencyNpr).toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        Rs. {item.totalTripCost.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono text-slate-400">
                        {item.co2} kg
                      </td>
                      <td className="p-2.5 text-right">
                        {!item.isCurrent && onVehicleChange && (
                          <button
                            onClick={() => onVehicleChange(item.type)}
                            className="px-2 py-1 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded text-[10px] font-semibold transition"
                          >
                            Select
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Advisory Tip */}
      <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>Highway Travel Budget Advice:</strong> Nagdhunga Tunnel FASTag lanes and Mugling municipal toll booths accept eSewa / Fonepay QR or cash. Keep emergency assistance hotline <strong>1114 (DOR)</strong> and <strong>103 (Traffic Police)</strong> saved in speed dial for mountain towing assistance.
        </span>
      </div>
    </div>
  );
};
