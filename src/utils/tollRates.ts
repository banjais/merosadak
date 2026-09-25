import fs from 'fs';
import path from 'path';
import type { VehicleType } from '../types';

const CACHE_FILE = path.join(process.cwd(), 'public', 'data', 'all-toll-rates.json');

interface TollRateEntry {
  car: number;
  suv_4wd: number;
  motorbike: number;
  bus_truck: number;
  electric_vehicle: number;
}

interface TollPlaza {
  id: string;
  name: string;
  highwayCode: string;
  location: string;
  lat: number;
  lng: number;
  operator: string;
  directional: boolean;
  rates: {
    entry?: TollRateEntry;
    exit?: TollRateEntry;
    single?: TollRateEntry;
  };
  prohibitedVehicles?: string[];
  gazetteRef: string;
  cabinetDecisionDate?: string;
  tollBooths: { entry?: number; exit?: number; total?: number };
  operatingHours: string;
}

interface AllTollRatesCache {
  tollPlazas: TollPlaza[];
  lastUpdated: string;
}

let tollPlazasCache: TollPlaza[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function loadTollPlazas(): TollPlaza[] {
  const now = Date.now();
  if (tollPlazasCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return tollPlazasCache;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as AllTollRatesCache;
    tollPlazasCache = data.tollPlazas;
    cacheTimestamp = now;
    return tollPlazasCache;
  } catch (err) {
    console.warn('[Toll Rates] Failed to load all-toll-rates.json, using empty array:', err);
    return [];
  }
}

export function getTollPlazasForHighway(highwayCode: string): TollPlaza[] {
  const plazas = loadTollPlazas();
  return plazas.filter((p) => p.highwayCode === highwayCode);
}

export function calculateTollCost(highwayCodes: string[], vehicle: VehicleType): number {
  const plazas = loadTollPlazas();
  let total = 0;

  for (const code of highwayCodes) {
    const highwayPlazas = plazas.filter((p) => p.highwayCode === code);
    for (const plaza of highwayPlazas) {
      if (plaza.directional) {
        // For directional tolls (like Nagdhunga), use entry rate as default
        // In a real app, you'd determine direction from route
        const rates = plaza.rates.entry || plaza.rates.single;
        if (rates) total += rates[vehicle] || 0;
      } else {
        const rates = plaza.rates.single;
        if (rates) total += rates[vehicle] || 0;
      }
    }
  }

  return total;
}

export function getTollPlazaById(id: string): TollPlaza | undefined {
  const plazas = loadTollPlazas();
  return plazas.find((p) => p.id === id);
}

export function getAllTollPlazas(): TollPlaza[] {
  return loadTollPlazas();
}

// Vehicle type mapping for toll calculation
export function mapVehicleToTollCategory(vehicle: VehicleType): keyof TollRateEntry {
  switch (vehicle) {
    case 'car': return 'car';
    case 'suv_4wd': return 'suv_4wd';
    case 'motorbike': return 'motorbike';
    case 'bus_truck': return 'bus_truck';
    case 'electric_vehicle': return 'electric_vehicle';
    default: return 'car';
  }
}