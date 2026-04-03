// frontend/src/services/weatherService.ts
import { api, TravelIncident, IncidentType } from './apiService';

export async function fetchWeatherIncidents(lat?: number, lng?: number): Promise<TravelIncident[]> {
  const data = await api.getWeather(lat, lng);

  // If already an array, return as-is
  if (Array.isArray(data)) return data;

  // If it's a weather object, convert to a single incident
  if (data && typeof data === 'object' && (data.main || data.weather)) {
    const weather = data.weather?.[0];
    return [{
      id: `weather-${lat ?? 0}-${lng ?? 0}`,
      type: IncidentType.WEATHER,
      title: weather?.main || data.name || 'Weather',
      description: weather?.description || `Temp: ${data.main?.temp ?? 'N/A'}°C, Humidity: ${data.main?.humidity ?? 'N/A'}%`,
      lat: data.coord?.lat ?? lat ?? 0,
      lng: data.coord?.lon ?? lng ?? 0,
      severity: (data.main?.temp ?? 0) < 5 || (data.wind?.speed ?? 0) > 20 ? 'high' : 'low',
      timestamp: new Date().toISOString(),
    }];
  }

  return [];
}
