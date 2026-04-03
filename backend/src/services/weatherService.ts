// backend/src/services/weatherService.ts
import { getCache } from './cacheService.js';
import { config } from '../config/index.js';

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
 * MOCK weather (dev / offline / demo)
 */
async function fetchMockWeather(lat: number, lng: number): Promise<WeatherData> {
  const seed = Math.abs(lat * 10 + lng);
  const intensity = Number(((seed * 7) % 30).toFixed(1));

  const condition =
    intensity >= 20 ? 'Extreme Rain' :
      intensity >= 10 ? 'Heavy Rain' :
        intensity > 0 ? 'Light Rain' :
          'Clear';

  return {
    source: 'mock',
    temp: 20 + (seed % 8),
    humidity: 75,
    windSpeed: 3 + (seed % 5),
    intensity,
    alertLevel: getAlertLevel(intensity),
    location: `Simulated (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
    condition,
    icon: getWeatherIcon(condition)
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

  return getCache(
    cacheKey,
    async () => {
      if (config.USE_MOCK === true || config.USE_MOCK === 'true') {
        return fetchMockWeather(lat, lng);
      }

      try {
        return await fetchOpenWeather(lat, lng);
      } catch (err: any) {
        console.warn(`⚠️ OpenWeatherMap failed: ${err.message} → fallback Open-Meteo`);
        try {
          return await fetchOpenMeteo(lat, lng);
        } catch {
          return fetchMockWeather(lat, lng);
        }
      }
    },
    10 * 60 // ⏱️ 10-minute cache
  );
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
