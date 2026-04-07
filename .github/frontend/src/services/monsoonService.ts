// frontend/src/services/monsoonService.ts
import { api, TravelIncident } from './apiService';

export async function fetchMonsoonIncidents(lat?: number, lng?: number): Promise<TravelIncident[]> {
  const data = await api.getMonsoon(lat, lng);
  return data;
}
