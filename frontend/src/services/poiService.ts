import { apiFetch } from './apiService';
import { TravelIncident, IncidentType } from '../types';
import { NEPAL_CENTER, APP_CONFIG } from '../config/config';
import { POI_MOCKS } from '../mocks';

export async function fetchPOIs(query: string = 'fuel station', lat?: number, lng?: number): Promise<TravelIncident[]> {
  if (APP_CONFIG.useMocks) return POI_MOCKS;

  try {
    const latitude = lat ?? NEPAL_CENTER[0];
    const longitude = lng ?? NEPAL_CENTER[1];
    
    // Explicitly using query parameters as required by backend poiController
    const res = await apiFetch<any>(`/pois?q=${encodeURIComponent(query)}&lat=${latitude}&lng=${longitude}`);
    const data = res?.data || res;

    if (!data || !Array.isArray(data)) throw new Error("Invalid POI data format");
    
    return data.map((item: any, idx: number) => ({
      id: item.id || `poi-${idx}-${Date.now()}`,
      type: IncidentType.POI,
      title: item.name || item.title || 'Point of Interest',
      description: `${item.category || 'Place'}. ${item.address || 'Himalayan Region, Nepal.'}`,
      lat: item.location?.lat ?? item.lat ?? latitude,
      lng: item.location?.lng ?? item.lng ?? longitude,
      severity: 'success',
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    console.warn("[POIService] API failed. Using Mocks.", e);
    return POI_MOCKS;
  }
}