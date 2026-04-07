// frontend/src/services/roadService.ts
import { api, TravelIncident } from './apiService';

export async function fetchRoadIncidents(): Promise<TravelIncident[]> {
  const data = await api.getRoads();
  return data;
}
