// frontend/src/services/poiService.ts
import { api, TravelIncident } from './apiService';

export async function fetchPOIs(lat?: number, lng?: number): Promise<TravelIncident[]> {
  const data = await api.getPois(lat, lng);
  return data;
}
