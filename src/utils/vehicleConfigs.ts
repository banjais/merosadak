import { VehicleType } from '../types';
import { Car, Mountain, Bike, Truck, Zap } from 'lucide-react';

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
