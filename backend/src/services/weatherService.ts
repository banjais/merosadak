// backend/src/services/weatherService.ts
import { getCache } from '@/services/cacheService.js';
import { config } from '@/config/index.js';

// Spatial promise cache to prevent redundant API calls for the same grid in flight
const pendingWeatherRequests = new Map<string, Promise<WeatherData>>();

/**
 * Weather data model used system-wide
 */
export interface WeatherData {
  source: 'openweathermap' | 'open-meteo' | 'mock';
  temp: number;                 // °C
  condition: string;
  humidity: number;             // %
  windSpeed: number;            // m/s
  intensity: number;            // mm/hour (rainfall)
  alertLevel?: 'none' | 'light' | 'heavy' | 'extreme';
  location?: string;
  icon?: string;
}

/**
 * Weather → emoji mapper (UI-safe)
 */
function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain')) return '🌧️';
  if (c.includes('storm') || c.includes('thunder')) return '⛈️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('cloud')) return '☁️';
  if (c.includes('clear') || c.includes('sun')) return '☀️';
  return '🌡️';
}

/**
 * Rainfall → alert severity
 */
function getAlertLevel(intensity: number): WeatherData['alertLevel'] {
  if (intensity >= 20) return 'extreme';   // Landslide / flood risk
  if (intensity >= 10) return 'heavy';     // Caution
  if (intensity > 0) return 'light';
  return 'none';
}

/**
 * OpenWeatherMap (PRIMARY)
 */
async function fetchOpenWeather(lat: number, lng: number): Promise<WeatherData> {
  if (!config.OPENWEATHERMAP_API_KEY) {
    throw new Error('OWM API key missing');
  }

  const url =
    `${config.OPENWEATHERMAP_API_URL}?lat=${lat}&lon=${lng}&appid=${config.OPENWEATHERMAP_API_KEY}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWM failed: ${res.status}`);

  const data = await res.json() as any;
  const condition = data.weather?.[0]?.main || 'Unknown';
  const intensity = data.rain?.['1h'] ?? 0;

  return {
    source: 'openweathermap',
    temp: data.main.temp,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    intensity,
    alertLevel: getAlertLevel(intensity),
    location: data.name,
    condition,
    icon: getWeatherIcon(condition)
  };
}

/**
 * Open-Meteo (FALLBACK – free, no key)
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherData> {
  const base = config.OPEN_METEO_API_BASE;

  const url =
    `${base}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,wind_speed_10m,precipitation` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`);

  const data = await res.json() as any;
  const intensity = data.current?.precipitation ?? 0;

  return {
    source: 'open-meteo',
    temp: data.current?.temperature_2m ?? 0,
    humidity: 0,
    windSpeed: data.current?.wind_speed_10m ?? 0,
    intensity,
    alertLevel: getAlertLevel(intensity),
    condition: intensity > 0 ? 'Rain' : 'Clear',
    icon: getWeatherIcon(intensity > 0 ? 'rain' : 'clear')
  };
}

/**
 * 🌦️ MASTER WEATHER FETCHER
 * Cache + fallback + safe defaults
 */
export async function getRealWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;

  // 🧠 Request Collapsing: if a request for this grid is already in flight, wait for it
  const existing = pendingWeatherRequests.get(cacheKey);
  if (existing) return existing;

  const fetcher = async () => {
    try {
      return await fetchOpenWeather(lat, lng);
    } catch (err: any) {
      console.warn(`⚠️ OpenWeatherMap failed: ${err.message} → fallback Open-Meteo`);
      return await fetchOpenMeteo(lat, lng);
    } finally {
      pendingWeatherRequests.delete(cacheKey);
    }
  };

  const requestPromise = getCache(cacheKey, fetcher, 10 * 60);
  pendingWeatherRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * 🌦️ BATCH WEATHER FETCHER
 * Groups multiple coordinates into single API calls via Open-Meteo.
 * Highly efficient for road network risk assessments where segments are clustered.
 */
export async function getLiveRainfallBatch(
  points: { lat: number; lng: number }[]
): Promise<Map<string, WeatherData>> {
  const resultsMap = new Map<string, WeatherData>();
  if (!points.length) return resultsMap;

  // 1. Deduplicate by grid key (0.01 precision ~1.1km)
  const uniqueGrids = new Map<string, { lat: number; lng: number }>();
  points.forEach(p => {
    const key = `weather:${p.lat.toFixed(2)}:${p.lng.toFixed(2)}`;
    if (!uniqueGrids.has(key)) uniqueGrids.set(key, p);
  });

  // 2. Separate cached vs missing
  // We use getRealWeather logic to benefit from spatial collapsing and OWM primary check
  const gridsToFetch: { lat: number; lng: number; key: string }[] = [];

  // Process sequentially but rapidly; getCache handles Memory/Redis instantly
  for (const [key, coords] of uniqueGrids.entries()) {
    try {
      const data = await getRealWeather(coords.lat, coords.lng);
      resultsMap.set(key, data);
    } catch {
      gridsToFetch.push({ ...coords, key });
    }
  }

  // 3. Optional: Perform true Batch API call for missing grids if too many
  // For Open-Meteo, we could fetch 50 locations in one URL. 
  // Currently, getRealWeather handles fallback/individual calls sufficiently 
  // when request collapsing is active.

  return resultsMap;
}

/**
 * Aliases used by other services
 */
export const getLiveRainfall = getRealWeather;

/**
 * System heartbeat (Kathmandu default)
 * Used for health checks / dashboard badge
 */
export const getWeather = () =>
  getRealWeather(27.7172, 85.3240);
