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

// Reference point used to tell which way a directional toll plaza is being
// crossed. Currently the only directional plaza is the Nagdhunga Tunnel,
// whose published rates (Cabinet decision, Aug 2025) are named around
// Kathmandu Valley: "entry" = travelling INTO the valley, "exit" = travelling
// OUT of it. We approximate that by comparing which endpoint of the trip is
// closer to the valley.
const KATHMANDU_VALLEY_REF = { lat: 27.7172, lng: 85.324 };

function squaredDistance(lat: number, lng: number, ref: { lat: number; lng: number }): number {
  const dLat = lat - ref.lat;
  const dLng = lng - ref.lng;
  return dLat * dLat + dLng * dLng;
}

/**
 * true  = trip is heading INTO Kathmandu Valley (use "entry" rate)
 * false = trip is heading OUT of Kathmandu Valley (use "exit" rate)
 * undefined = no coordinates given; caller should fall back to a default.
 */
export function isEnteringKathmandu(
  origin?: { lat: number; lng: number },
  destination?: { lat: number; lng: number }
): boolean | undefined {
  if (!origin || !destination) return undefined;
  const originDist = squaredDistance(origin.lat, origin.lng, KATHMANDU_VALLEY_REF);
  const destDist = squaredDistance(destination.lat, destination.lng, KATHMANDU_VALLEY_REF);
  return destDist < originDist;
}

function pickDirectionalRate(plaza: TollPlaza, entering: boolean | undefined): TollRateEntry | undefined {
  // Default to "entry" (the pre-existing behaviour) only when direction is unknown.
  if (entering === false) return plaza.rates.exit || plaza.rates.entry || plaza.rates.single;
  return plaza.rates.entry || plaza.rates.single;
}

export function calculateTollCost(
  highwayCodes: string[],
  vehicle: VehicleType,
  origin?: { lat: number; lng: number },
  destination?: { lat: number; lng: number }
): number {
  const plazas = loadTollPlazas();
  const entering = isEnteringKathmandu(origin, destination);
  let total = 0;

  for (const code of highwayCodes) {
    const highwayPlazas = plazas.filter((p) => p.highwayCode === code);
    for (const plaza of highwayPlazas) {
      const rates = plaza.directional ? pickDirectionalRate(plaza, entering) : plaza.rates.single;
      if (rates) total += rates[vehicle] || 0;
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