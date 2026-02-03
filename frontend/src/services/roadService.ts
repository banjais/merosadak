import { apiFetch } from './apiService';
import { TravelIncident, IncidentType } from '../types';
import { NEPAL_CENTER, APP_CONFIG } from '../config/config';
import { ROAD_MOCKS } from '../mocks';

export async function fetchRoadIncidents(): Promise<TravelIncident[]> {
  // Respect the forced mock flag if set
  if (APP_CONFIG.useMocks) return ROAD_MOCKS;

  try {
    const result = await apiFetch<any>("/roads");

    const features = result?.features || result?.data?.features || [];
    
    if (features.length === 0) {
      throw new Error("No features found in road data");
    }
    
    return features.map((item: any, idx: number) => ({
      id: item.id || item.properties?.id || `road-${idx}-${Date.now()}`,
      type: item.properties?.status === 'Blocked' ? IncidentType.BLOCKAGE : IncidentType.ONE_WAY,
      title: item.properties?.road_name || item.properties?.title || 'Road Alert',
      description: item.properties?.message || item.properties?.description || 'No description.',
      lat: item.geometry?.coordinates?.[0]?.[0]?.[1] ?? item.lat ?? NEPAL_CENTER[0],
      lng: item.geometry?.coordinates?.[0]?.[0]?.[0] ?? item.lng ?? NEPAL_CENTER[1],
      severity: item.properties?.status === 'Blocked' ? 'high' : 'medium',
      timestamp: item.properties?.timestamp || new Date().toISOString()
    }));

  } catch (e) {
    console.warn("[RoadService] API failed. Using Mocks.", e);
    return ROAD_MOCKS;
  }
}