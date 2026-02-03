import { apiFetch } from './apiService';
import { TravelIncident, IncidentType } from '../types';
import { NEPAL_CENTER, APP_CONFIG } from '../config/config';
import { TRAFFIC_MOCKS } from '../mocks';

export async function fetchTrafficIncidents(): Promise<TravelIncident[]> {
  if (APP_CONFIG.useMocks) return TRAFFIC_MOCKS;

  try {
    const response = await apiFetch<any>("/traffic");
    const data = response?.data || response;

    if (!data) throw new Error("No traffic data");

    // If it's the global summary object, we wrap it into a single dummy incident for the UI
    if (data.status && data.network) {
      return [{
        id: 'traffic-global-status',
        type: IncidentType.TRAFFIC,
        title: data.network,
        description: `Status: ${data.status}. Monitoring ${data.segmentsMonitored} segments. Last updated: ${new Date(data.lastUpdated).toLocaleTimeString()}`,
        lat: NEPAL_CENTER[0],
        lng: NEPAL_CENTER[1],
        severity: 'low',
        timestamp: data.lastUpdated || new Date().toISOString()
      }];
    }

    // Otherwise if it's an array (unlikely based on backend but for compatibility)
    if (Array.isArray(data)) {
      return data.map((item, idx) => ({
        id: item.id || `traffic-${idx}`,
        type: item.type || IncidentType.TRAFFIC,
        title: item.title || 'Traffic Alert',
        description: item.description || 'Slow moving traffic.',
        lat: item.lat ?? NEPAL_CENTER[0],
        lng: item.lng ?? NEPAL_CENTER[1],
        severity: item.severity || 'low',
        timestamp: item.timestamp || new Date().toISOString()
      }));
    }

    return TRAFFIC_MOCKS;
  } catch (e) {
    console.warn("[TrafficService] API failed. Using Mocks.", e);
    return TRAFFIC_MOCKS;
  }
}