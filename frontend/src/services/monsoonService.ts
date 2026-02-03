import { apiFetch } from './apiService';
import { TravelIncident, IncidentType } from '../types';
import { NEPAL_CENTER, APP_CONFIG } from '../config/config';
import { MONSOON_MOCKS } from '../mocks';

export async function fetchMonsoonIncidents(): Promise<TravelIncident[]> {
  if (APP_CONFIG.useMocks) return MONSOON_MOCKS;

  try {
    const data = await apiFetch<any[]>("/monsoon/risk");
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("No live monsoon data");
    }

    return data.map((item, idx) => ({
      id: item.id || `monsoon-${idx}-${Date.now()}`,
      type: item.risk_level === 'High' ? IncidentType.LANDSLIDE : IncidentType.MONSOON,
      title: item.road_name || 'Monsoon Risk Area',
      description: `Risk Level: ${item.risk_level}. ${item.reason || 'Saturated soil conditions.'}`,
      lat: item.lat ?? NEPAL_CENTER[0],
      lng: item.lng ?? NEPAL_CENTER[1],
      severity: item.risk_level === 'High' ? 'high' : 'medium',
      timestamp: item.timestamp || new Date().toISOString()
    }));

  } catch (e) {
    console.warn("[MonsoonService] API failed. Using Mocks.", e);
    return MONSOON_MOCKS;
  }
}