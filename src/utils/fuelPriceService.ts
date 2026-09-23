import { FuelRateConfig } from './vehicleConfigs';
export type { FuelRateConfig };

const CACHE_KEY = 'merosadak_fuel_prices';
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface FuelPriceMetadata {
  source: string;
  sourceUrl: string;
  sourceLabel: string;
  lastUpdated: string;
  fetchedAt: string;
  nextUpdate: string;
  note: string;
}

export interface FuelPriceState {
  prices: FuelRateConfig | null;
  metadata: FuelPriceMetadata | null;
  lastChecked: number | null;
  isLoading: boolean;
  error: string | null;
}

let cachedPrices: FuelRateConfig | null = null;
let cachedMetadata: FuelPriceMetadata | null = null;
let lastChecked: number | null = null;

export async function fetchFuelPrices(): Promise<FuelRateConfig> {
  try {
    const res = await fetch('/api/fuel-prices');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const prices: FuelRateConfig = data.prices;
    cachedPrices = prices;
    cachedMetadata = data.source ? {
      source: data.source,
      sourceUrl: data.sourceUrl || '',
      sourceLabel: data.sourceLabel || '',
      lastUpdated: data.lastUpdated || '',
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      nextUpdate: data.nextUpdate || '',
      note: data.note || '',
    } : null;
    lastChecked = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, metadata: cachedMetadata, lastChecked }));
    } catch { /* storage unavailable */ }
    return prices;
  } catch (err: any) {
    const message = err?.message || 'Price fetch failed';
    try {
      const local = localStorage.getItem(CACHE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Date.now() - (parsed.lastChecked || 0) < CACHE_TTL_MS) {
          cachedPrices = parsed.prices;
          lastChecked = parsed.lastChecked;
          cachedMetadata = parsed.metadata || null;
          return cachedPrices;
        }
      }
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }
}

export function getFuelPrices(): FuelRateConfig | null {
  return cachedPrices;
}

export function getFuelPriceMetadata(): FuelPriceMetadata | null {
  return cachedMetadata;
}

export function getLastPriceCheck(): number | null {
  return lastChecked;
}

export function isPriceStale(): boolean {
  if (!lastChecked) return true;
  return Date.now() - lastChecked > CACHE_TTL_MS;
}

export function getMinutesSinceLastCheck(): number {
  if (!lastChecked) return Infinity;
  return Math.floor((Date.now() - lastChecked) / 60000);
}

export function getEffectiveFuelRate(
  vehicleType: string,
  prices: FuelRateConfig | null = cachedPrices
): number {
  if (prices) {
    if (vehicleType === 'electric_vehicle') return prices.electricity;
    if (vehicleType === 'suv_4wd' || vehicleType === 'bus_truck') return prices.diesel;
    return prices.petrol;
  }
  if (vehicleType === 'electric_vehicle') return 15;
  if (vehicleType === 'suv_4wd' || vehicleType === 'bus_truck') return 158;
  return 175;
}

export async function refreshFuelPrices(): Promise<FuelRateConfig | null> {
  try {
    return await fetchFuelPrices();
  } catch {
    return cachedPrices;
  }
}
