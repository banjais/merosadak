import { apiFetch } from './apiService';
import { TravelIncident, IncidentType } from '../types';
import { NEPAL_CENTER, APP_CONFIG } from '../config/config';
import { WEATHER_MOCKS } from '../mocks';

export async function fetchWeatherIncidents(lat?: number, lng?: number): Promise<TravelIncident[]> {
  if (APP_CONFIG.useMocks) return WEATHER_MOCKS;

  try {
    const query = lat && lng ? `?lat=${lat}&lng=${lng}` : `?lat=${NEPAL_CENTER[0]}&lng=${NEPAL_CENTER[1]}`;
    const result = await apiFetch<any>(`/weather${query}`);
    const data = result?.data || result;

    if (!data) throw new Error("No live weather data");

    // Map single weather object to an incident for UI consistency
    return [{
      id: `weather-now-${Date.now()}`,
      type: IncidentType.WEATHER,
      title: `Weather in ${data.location || 'Nepal'}`,
      description: `Condition: ${data.condition || 'Clear'}. Temp: ${data.temp}°C. Humidity: ${data.humidity}%. Wind: ${data.windSpeed}km/h.`,
      lat: lat ?? NEPAL_CENTER[0],
      lng: lng ?? NEPAL_CENTER[1],
      severity: (data.intensity > 10 || (data.condition && data.condition.includes('Heavy'))) ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    }];

  } catch (e) {
    console.warn("[WeatherService] API failed. Using Mocks.", e);
    return WEATHER_MOCKS;
  }
}