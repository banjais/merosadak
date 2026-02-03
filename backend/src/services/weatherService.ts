import { getCache } from './cacheService.js';
import { config } from '../config/index.js';

export interface WeatherData {
  source: 'openweathermap' | 'open-meteo' | 'mock';
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  intensity: number; // mm/hour for monsoon/landslide alerts
  location?: string;
  icon?: string;
}

/**
 * Map condition to emoji icon
 */
function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('shower')) return '🌧️';
  if (c.includes('storm') || c.includes('thunder')) return '⛈️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('cloud')) return '☁️';
  if (c.includes('clear') || c.includes('sun')) return '☀️';
  return '🌡️';
}

/**
 * OpenWeatherMap primary fetch
 */
async function fetchOWM(lat: number, lng: number): Promise<WeatherData> {
  const apiKey = config.OPENWEATHERMAP_API_KEY;
  const url = `${config.OPENWEATHERMAP_API_URL || 'https://api.openweathermap.org/data/2.5/weather'}?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWM Failed: ${res.status}`);
  const data = await res.json() as any;
  const condition = data.weather?.[0]?.main || 'Unknown';

  return {
    source: 'openweathermap',
    temp: data.main.temp,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    intensity: data.rain?.['1h'] || 0,
    location: data.name,
    condition,
    icon: getWeatherIcon(condition)
  };
}

/**
 * Open-Meteo fallback
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherData> {
  const baseUrl = config.OPEN_METEO_API_BASE || 'https://api.open-meteo.com/v1/forecast';
  const url = `${baseUrl}?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo Failed: ${res.status}`);
  const data = await res.json() as any;
  const condition = data.current_weather?.weathercode ? `Weather-${data.current_weather.weathercode}` : 'Unknown';

  return {
    source: 'open-meteo',
    temp: data.current_weather?.temperature ?? 0,
    humidity: 0,
    windSpeed: data.current_weather?.windspeed ?? 0,
    intensity: data.current_weather?.precipitation ?? 0,
    condition,
    icon: getWeatherIcon(condition)
  };
}

/**
 * Mock weather for testing
 */
async function fetchMockWeather(lat: number, lng: number): Promise<WeatherData> {
  const seed = Math.abs(lat + lng);
  const intensity = parseFloat(((seed * 1337) % 25).toFixed(2));
  const condition = intensity > 15 ? 'Extreme Rain' : intensity > 5 ? 'Heavy Rain' : 'Clear';

  return {
    source: 'mock',
    temp: 22 + (seed % 8),
    humidity: 80,
    windSpeed: 5 + (seed % 10),
    intensity,
    location: `Simulated Area (${lat.toFixed(2)},${lng.toFixed(2)})`,
    condition,
    icon: getWeatherIcon(condition)
  };
}

/**
 * MASTER FUNCTION: auto-cache + fallback
 */
export async function getRealWeather(lat: number, lng: number): Promise<WeatherData> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;

  return getCache(cacheKey, async () => {
    if (config.USE_MOCK === true || config.USE_MOCK === 'true') return fetchMockWeather(lat, lng);

    try {
      return await fetchOWM(lat, lng);
    } catch (err) {
      console.warn(`⚠️ OWM failed: ${err.message}, trying Open-Meteo`);
      try {
        return await fetchOpenMeteo(lat, lng);
      } catch {
        return fetchMockWeather(lat, lng);
      }
    }
  }, 10 * 60); // 10 min cache
}

// Aliases for system-wide consistency
export const getLiveRainfall = getRealWeather;
export const getWeather = async () => getRealWeather(27.7172, 85.3240); // Kathmandu heartbeat
