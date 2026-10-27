import React from 'react';
import { Wrench } from 'lucide-react';
import type { RoutePlanResult, VehicleType } from '../../types';
import type { FuelRateConfig } from '../../utils/vehicleConfigs';
import { CarbonFootprintCard } from '../CarbonFootprintCard';
import { FuelCostEstimator } from '../FuelCostEstimator';
import { FuelPriceCard } from '../FuelPriceCard';

interface CostsPanelProps {
  route: RoutePlanResult;
  vehicle: VehicleType;
  highwayCodes: string[];
  fuelPrices: FuelRateConfig | null;
  fuelPriceMetadata: any;
  isLoadingPrices: boolean;
  minutesSinceLastCheck: number;
  isPriceStale: boolean;
  onRefreshPrices: () => void;
  onVehicleChange: (vehicle: VehicleType) => void;
  onOpenPreTrip?: () => void;
}

/** Driver-only: what the trip costs and emits, plus the pre-trip checklist. */
export const CostsPanel: React.FC<CostsPanelProps> = ({
  route,
  vehicle,
  highwayCodes,
  fuelPrices,
  fuelPriceMetadata,
  isLoadingPrices,
  minutesSinceLastCheck,
  isPriceStale,
  onRefreshPrices,
  onVehicleChange,
  onOpenPreTrip,
}) => (
  <div className="space-y-4">
    <FuelPriceCard
      fuelPrices={fuelPrices}
      metadata={fuelPriceMetadata}
      isLoading={isLoadingPrices}
      onRefresh={onRefreshPrices}
      minutesSinceLastCheck={minutesSinceLastCheck}
      isStale={isPriceStale}
    />
    <FuelCostEstimator
      distanceKm={route.totalDistanceKm}
      vehicleType={vehicle}
      elevationGainM={route.elevationGainM}
      origin={route.origin}
      destination={route.destination}
      defaultTollCost={route.totalTollCostNpr}
      highwayCodes={highwayCodes}
      fuelPrices={fuelPrices}
      fuelPriceMetadata={fuelPriceMetadata}
      onVehicleChange={onVehicleChange}
    />
    <CarbonFootprintCard
      distanceKm={route.totalDistanceKm}
      vehicleType={vehicle}
      elevationGainM={route.elevationGainM}
      onVehicleChange={onVehicleChange}
    />
    {onOpenPreTrip && (
      <button
        type="button"
        onClick={onOpenPreTrip}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-xs font-bold text-amber-300 transition hover:bg-amber-950/70"
      >
        <Wrench className="h-4 w-4" />
        Pre-trip vehicle checklist
      </button>
    )}
  </div>
);
