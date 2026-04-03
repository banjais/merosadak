// frontend/src/services/trafficService.ts
import { api, TravelIncident } from './apiService';

export async function fetchTrafficIncidents(lat?: number, lng?: number): Promise<TravelIncident[]> {
  const data = await api.getTraffic(lat, lng);
  return data;
}
