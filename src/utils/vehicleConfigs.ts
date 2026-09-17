import { VehicleType } from '../types';
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

export const getNOCFuelRate = (vehicleType: VehicleType): number => {
  if (vehicleType === 'electric_vehicle') return NOC_FUEL_RATES.electricity;
  if (vehicleType === 'suv_4wd' || vehicleType === 'bus_truck') return NOC_FUEL_RATES.diesel;
  return NOC_FUEL_RATES.petrol;
};

export const FUEL_RATE_LABELS = {
  petrol: 'Rs 175/L',
  diesel: 'Rs 158/L',
  electricity: 'Rs 15/kWh',
};

export const getFuelRateLabel = (vehicleType: VehicleType): string => {
  if (vehicleType === 'electric_vehicle') return FUEL_RATE_LABELS.electricity;
  if (vehicleType === 'suv_4wd' || vehicleType === 'bus_truck') return FUEL_RATE_LABELS.diesel;
  return FUEL_RATE_LABELS.petrol;
};

export const getFuelName = (vehicleType: VehicleType): string => {
  if (vehicleType === 'electric_vehicle') return 'NEA Electricity';
  if (vehicleType === 'suv_4wd' || vehicleType === 'bus_truck') return 'NOC Diesel';
  return 'NOC Petrol';
};

export interface VehicleConfig {
  type: VehicleType;
  label: string;
  icon: any;
  shortName: string;
  desc: string;
}

export const VEHICLE_CONFIGS: VehicleConfig[] = [
  { type: 'car', label: 'Car / Sedan', icon: Car, shortName: 'Car', desc: 'Standard sedan or hatchback' },
  { type: 'suv_4wd', label: 'SUV / 4WD Jeep', icon: Mountain, shortName: 'SUV/4WD', desc: 'High ground clearance 4x4' },
  { type: 'motorbike', label: 'Motorcycle', icon: Bike, shortName: 'Bike', desc: 'Motorcycle or scooter' },
  { type: 'bus_truck', label: 'Bus / Heavy Cargo', icon: Truck, shortName: 'Truck', desc: 'Commercial bus or truck' },
  { type: 'electric_vehicle', label: 'Electric Vehicle', icon: Zap, shortName: 'EV', desc: 'Battery electric vehicle' },
];
