// Client-safe toll rates - imports JSON directly (bundled by Vite)
// This avoids fs/path which don't work in browsers

import allTollRates from '../../public/data/all-toll-rates.json';

import type { VehicleType } from '../types';

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

const typedTollRates = allTollRates as AllTollRatesCache;

let tollPlazasCache: TollPlaza[] | null = null;

function loadTollPlazas(): TollPlaza[] {
  if (tollPlazasCache) return tollPlazasCache;
  tollPlazasCache = typedTollRates.tollPlazas;
  return tollPlazasCache;
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