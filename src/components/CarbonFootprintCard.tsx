import React, { useMemo, useState } from 'react';
import { VehicleType } from '../types';
import { Leaf, TreePine, Wind, Car, Bike, Truck, Mountain, ShieldCheck, ArrowRight, Info, Sparkles, Award } from 'lucide-react';

interface CarbonFootprintCardProps {
  distanceKm: number;
  vehicleType: VehicleType;
  elevationGainM?: number;
  onVehicleChange?: (vehicle: VehicleType) => void;
}

// Emission factors in grams of CO2 per km
const CO2_FACTORS: Record<VehicleType, { gramsPerKm: number; label: string; icon: any; unit: string }> = {
  car: { gramsPerKm: 142, label: 'Car / Sedan', icon: Car, unit: 'km/L' },
  suv_4wd: { gramsPerKm: 198, label: 'SUV / 4WD Jeep', icon: Mountain, unit: 'km/L' },
  motorbike: { gramsPerKm: 65, label: 'Motorcycle', icon: Bike, unit: 'km/L' },
  bus_truck: { gramsPerKm: 580, label: 'Bus / Heavy Truck', icon: Truck, unit: 'km/L' },
  electric_vehicle: { gramsPerKm: 18, label: 'Electric Vehicle (EV)', icon: Leaf, unit: 'km/kWh' }, // Hydropower grid factor in Nepal
};

export const CarbonFootprintCard: React.FC<CarbonFootprintCardProps> = ({
  distanceKm,
  vehicleType,
  elevationGainM = 0,
  onVehicleChange,
}) => {
  const [showComparison, setShowComparison] = useState(false);

  // Calculate CO2 emissions
  const emissionData = useMemo(() => {
    const baseFactor = CO2_FACTORS[vehicleType]?.gramsPerKm || 142;
    // Elevation gain increases fuel burn / electricity load (~5% per 1000m climb for ICE, ~2% for EV)
    const climbMultiplier = 1 + (elevationGainM / 1000) * (vehicleType === 'electric_vehicle' ? 0.025 : 0.06);
    
    const totalGrams = distanceKm * baseFactor * climbMultiplier;
    const totalKg = Math.round((totalGrams / 1000) * 10) / 10;
    
    // Mature trees needed to absorb this CO2 for 1 year (approx 21.7 kg CO2 per mature tree per year)
    const treesNeeded = Math.max(1, Math.ceil(totalKg / 21.7));

    // Equivalent miles in standard petrol car for comparison
    const petrolFactor = CO2_FACTORS['car'].gramsPerKm;
    const equivalentPetrolKg = Math.round(((distanceKm * petrolFactor) / 1000) * 10) / 10;
    const savingsKg = Math.max(0, Math.round((equivalentPetrolKg - totalKg) * 10) / 10);

    return {
      totalKg,
      totalGrams: Math.round(totalGrams),
      treesNeeded,
      savingsKg,
      equivalentPetrolKg,
    };
  }, [distanceKm, vehicleType, elevationGainM]);

  const currentVehicleInfo = CO2_FACTORS[vehicleType] || CO2_FACTORS['car'];
  const CurrentIcon = currentVehicleInfo.icon;

  return (
    <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-900/40 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Carbon Footprint & Eco Estimator</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                Green Transit Nepal
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Estimated CO₂ emissions for {distanceKm} km route ({elevationGainM}m elevation climb)
            </p>
          </div>
        </div>

        {/* Primary CO2 Badge */}
        <div className="flex items-center space-x-2 bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-emerald-500/30">
          <Wind className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Total CO₂ Output</div>
            <div className="text-base font-black text-white font-mono">{emissionData.totalKg} kg CO₂</div>
          </div>
        </div>
      </div>

      {/* Grid Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Tree Offset Equivalent */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <TreePine className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tree Offset Equivalent</span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {emissionData.treesNeeded} {emissionData.treesNeeded === 1 ? 'Tree' : 'Trees'}
          </div>
          <p className="text-[10px] text-slate-500">
            Mature pine/sal trees absorbing for 1 full year
          </p>
        </div>

        {/* Metric 2: Vehicle Efficiency Factor */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <CurrentIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Current Vehicle Rate</span>
          </div>
          <div className="text-lg font-black text-cyan-300 font-mono">
            {currentVehicleInfo.gramsPerKm} g CO₂/km
          </div>
          <p className="text-[10px] text-slate-500">
            {currentVehicleInfo.label} (incl. mountain climb factor)
          </p>
        </div>

        {/* Metric 3: Eco Savings / Comparison */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Eco Impact vs Sedan</span>
          </div>
          <div className="text-lg font-black text-amber-300 font-mono">
            {vehicleType === 'electric_vehicle' || vehicleType === 'motorbike'
              ? `-${emissionData.savingsKg} kg CO₂`
              : vehicleType === 'bus_truck'
              ? `+${Math.round(emissionData.totalKg - emissionData.equivalentPetrolKg)} kg`
              : 'Baseline'}
          </div>
          <p className="text-[10px] text-slate-500">
            {vehicleType === 'electric_vehicle' ? 'Zero direct tailpipe emissions (Hydropower)' : 'Compared to standard petrol sedan'}
          </p>
        </div>
      </div>

      {/* Mode Comparison Toggle */}
      <div className="space-y-2 pt-1">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-semibold flex items-center justify-between transition"
        >
          <span className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compare Emissions Across Vehicle Types for This Route</span>
          </span>
          <span className="text-emerald-400 text-[11px] font-mono">{showComparison ? 'Hide ▴' : 'View ▾'}</span>
        </button>

        {showComparison && (
          <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
            {(Object.keys(CO2_FACTORS) as VehicleType[]).map((vKey) => {
              const vInfo = CO2_FACTORS[vKey];
              const VIcon = vInfo.icon;
              const vGrams = distanceKm * vInfo.gramsPerKm;
              const vKg = Math.round((vGrams / 1000) * 10) / 10;
              const isSelected = vKey === vehicleType;

              return (
                <div
                  key={vKey}
                  onClick={() => onVehicleChange && onVehicleChange(vKey)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                      <VIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>{vInfo.label}</span>
                        {isSelected && <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded">Selected</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{vInfo.gramsPerKm} g/km • {vInfo.unit}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-black font-mono text-emerald-400">{vKg} kg CO₂</div>
                    <div className="text-[10px] text-slate-500">~{Math.ceil(vKg / 21.7)} trees offset</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eco-Driving & Nepal Hydropower Note */}
      <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Green Transit Note:</strong> Nepal's grid electricity for Electric Vehicles is predominantly generated via clean run-of-river hydropower. Utilizing engine braking on mountain descents (Prithvi/BP Highway) also regenerates EV battery range and minimizes brake pad wear.
        </div>
      </div>
    </div>
  );
};
