import { VehicleType, RoutePreference } from '../types';
import { Car, Mountain, Bike, Truck, Zap } from 'lucide-react';

export interface FuelRateConfig {
  petrol: number;
  diesel: number;
  electricity: number;
}

export const NOC_FUEL_RATES: FuelRateConfig = {
  petrol: 175,
  diesel: 158,
  electricity: 15,
};

export interface VehicleUIConfig {
  type: VehicleType;
  label: string;
  shortName: string;
  icon: any;
  desc: string;
}

export interface VehicleCalcConfig {
  mileageKmPerUnit: number;
  fuelCostPerUnit: number;
  speedMultiplier: number;
  /**
   * Average sustained speed in km/h on a national highway. This is a SPEED and
   * must never be derived from `mileageKmPerUnit`, which is fuel economy
   * (km per litre / km per kWh) and is dimensionally unrelated.
   */
  avgSpeedKmh: number;
}

export const VEHICLE_UI_CONFIGS: VehicleUIConfig[] = [
  { type: 'car', label: 'Car / Sedan', shortName: 'Car', icon: Car, desc: 'Standard sedan or hatchback' },
  { type: 'suv_4wd', label: 'SUV / 4WD Jeep', shortName: 'SUV/4WD', icon: Mountain, desc: 'High ground clearance 4x4' },
  { type: 'motorbike', label: 'Motorcycle', shortName: 'Bike', icon: Bike, desc: 'Motorcycle or scooter' },
  { type: 'bus_truck', label: 'Bus / Heavy Cargo', shortName: 'Truck', icon: Truck, desc: 'Commercial bus or truck' },
  { type: 'electric_vehicle', label: 'Electric Vehicle', shortName: 'EV', icon: Zap, desc: 'Battery electric vehicle' },
];

/**
 * Real-world EV consumption in km per kWh. Defined once here because it was
 * hardcoded as 6.2 in nine places while this config said 6.5, so the KPI and
 * the fuel estimator card disagreed on the same screen.
 */
export const EV_KM_PER_KWH = 6.5;

/** Assumed usable battery capacity in kWh, used for the state-of-charge estimate. */
export const EV_BATTERY_KWH = 50;

export const VEHICLE_CALC_CONFIGS: Record<VehicleType, VehicleCalcConfig> = {
  car: { mileageKmPerUnit: 14, fuelCostPerUnit: 175, speedMultiplier: 1.0, avgSpeedKmh: 55 },
  suv_4wd: { mileageKmPerUnit: 10, fuelCostPerUnit: 158, speedMultiplier: 1.05, avgSpeedKmh: 48 },
  motorbike: { mileageKmPerUnit: 35, fuelCostPerUnit: 175, speedMultiplier: 1.12, avgSpeedKmh: 50 },
  bus_truck: { mileageKmPerUnit: 4.5, fuelCostPerUnit: 158, speedMultiplier: 0.75, avgSpeedKmh: 40 },
  electric_vehicle: { mileageKmPerUnit: EV_KM_PER_KWH, fuelCostPerUnit: 15, speedMultiplier: 1.0, avgSpeedKmh: 50 },
};

/** kWh needed to cover `distanceKm`, guarded against non-positive input. */
export function estimateEvKwh(distanceKm: number): number {
  if (!(distanceKm > 0)) return 0;
  return Math.round((distanceKm / EV_KM_PER_KWH) * 10) / 10;
}

/** State-of-charge used for `distanceKm`, as a percentage of EV_BATTERY_KWH. */
export function estimateEvBatteryPercent(distanceKm: number): number {
  if (!(distanceKm > 0)) return 0;
  return Math.round(((distanceKm / EV_KM_PER_KWH) / EV_BATTERY_KWH) * 100);
}

/**
 * Estimated travel minutes for a distance, from a real average speed.
 * Guarded so a non-positive distance or speed can never yield Infinity.
 */
export function estimateMinutesFromSpeed(distanceKm: number, type: VehicleType): number {
  const speed = VEHICLE_CALC_CONFIGS[type]?.avgSpeedKmh ?? VEHICLE_CALC_CONFIGS.car.avgSpeedKmh;
  if (!(distanceKm > 0) || !(speed > 0)) return 0;
  return Math.max(1, Math.round((distanceKm / speed) * 60));
}

export const PREFERENCE_CONFIGS: { pref: RoutePreference; icon: string; label: string; desc: string }[] = [
  { pref: 'fastest', icon: '⚡', label: 'Fastest', desc: 'Shortest travel time' },
  { pref: 'shortest', icon: '🛣️', label: 'Shortest', desc: 'Shortest distance' },
  { pref: 'safest', icon: '🛡️', label: 'Safest', desc: 'Best road score' },
  { pref: 'scenic', icon: '🏔️', label: 'Scenic', desc: 'Mountain views' },
  { pref: 'ev_optimized', icon: '🔋', label: 'EV Optimized', desc: 'Charging & efficiency' },
];

export const FUEL_RATE_LABELS = {
  petrol: 'Rs 175/L',
  diesel: 'Rs 158/L',
  electricity: 'Rs 15/kWh',
};

// Backward compatibility aliases
export const VEHICLE_CONFIGS = VEHICLE_UI_CONFIGS;

export function getVehicleUIConfig(type: VehicleType): VehicleUIConfig {
  return VEHICLE_UI_CONFIGS.find((v) => v.type === type) || VEHICLE_UI_CONFIGS[0];
}

export function getVehicleCalcConfig(type: VehicleType): VehicleCalcConfig {
  return VEHICLE_CALC_CONFIGS[type] || VEHICLE_CALC_CONFIGS.car;
}

export function getFuelRate(type: VehicleType): number {
  return VEHICLE_CALC_CONFIGS[type]?.fuelCostPerUnit ?? VEHICLE_CALC_CONFIGS.car.fuelCostPerUnit;
}

export function getFuelRateLabel(type: VehicleType): string {
  if (type === 'electric_vehicle') return FUEL_RATE_LABELS.electricity;
  if (type === 'suv_4wd' || type === 'bus_truck') return FUEL_RATE_LABELS.diesel;
  return FUEL_RATE_LABELS.petrol;
}

export function getFuelName(type: VehicleType): string {
  if (type === 'electric_vehicle') return 'NEA Electricity';
  if (type === 'suv_4wd' || type === 'bus_truck') return 'NOC Diesel';
  return 'NOC Petrol';
}

export const getNOCFuelRate = getFuelRate;

export function formatPreference(pref: RoutePreference): string {
  return PREFERENCE_CONFIGS.find((p) => p.pref === pref)?.label || pref.replace('_', ' ');
}