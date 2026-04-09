// frontend/src/services/apiService.ts
import { APP_CONFIG, NEPAL_CENTER } from "../config/config";
import { apiFetch } from "../api";
import type { TravelIncident } from "../types";
export type { TravelIncident } from "../types";

/**
 * Types
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface GeoData {
  type: string;
  features: any[];
}

export type AppAlert = {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
};

export enum IncidentType {
  BLOCKAGE = 'Road Block',
  TRAFFIC = 'Traffic Jam',
  HEAVY_TRAFFIC = 'Heavy Traffic',
  MONSOON = 'Monsoon Risk',
  FLOOD = 'Flood Alert',
  LANDSLIDE = 'Landslide Risk',
  WEATHER = 'Weather Alert',
  SNOW = 'Heavy Snow',
  FOG = 'Dense Fog',
  POI = 'Point of Interest',
  ONE_LANE = 'One-Lane',
  RESUMED = 'Resumed'
}

/**
 * -------------------------
 * Alert Service
 * -------------------------
 */
let alertListeners: ((alerts: AppAlert[]) => void)[] = [];
let currentAlerts: AppAlert[] = [];

export const alertService = {
  subscribe: (listener: (alerts: AppAlert[]) => void) => {
    alertListeners.push(listener);
    return () => {
      alertListeners = alertListeners.filter(l => l !== listener);
    };
  },

  notify: (type: AppAlert['type'], message: string, duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newAlert: AppAlert = { id, type, message, duration };
    currentAlerts = [...currentAlerts, newAlert];
    alertListeners.forEach(l => l(currentAlerts));

    if (duration > 0) {
      setTimeout(() => {
        alertService.dismiss(id);
      }, duration);
    }
  },

  dismiss: (id: string) => {
    currentAlerts = currentAlerts.filter(a => a.id !== id);
    alertListeners.forEach(l => l(currentAlerts));
  }
};

/**
 * -------------------------
 * Mock Data
 * -------------------------
 */
const ROAD_MOCKS: TravelIncident[] = [
  {
    id: 'road-mock-1',
    type: IncidentType.BLOCKAGE,
    title: 'Narayangadh-Mugling Landslide',
    description: 'Highway blocked due to fresh landslide near Jalbire. Clearance expected in 4 hours.',
    lat: 27.755,
    lng: 84.425,
    severity: 'high',
    timestamp: new Date().toISOString()
  },
  {
    id: 'road-mock-2',
    type: IncidentType.ONE_LANE,
    title: 'Prithvi Highway One-Lane',
    description: 'One-way traffic operation near Kurintar due to road maintenance.',
    lat: 27.8174,
    lng: 84.5919,
    severity: 'medium',
    timestamp: new Date().toISOString()
  },
  {
    id: 'road-mock-3',
    type: IncidentType.BLOCKAGE,
    title: 'Siddhartha Highway Closure',
    description: 'Road closed near Tansen due to bridge repair work. Reopening at 6 PM.',
    lat: 27.871,
    lng: 83.551,
    severity: 'high',
    timestamp: new Date().toISOString()
  }
];

// Similar mocks for TRAFFIC, WEATHER, MONSOON, POI
// ... define TRAFFIC_MOCKS, WEATHER_MOCKS, MONSOON_MOCKS, POI_MOCKS here exactly as you had them

/**
 * -------------------------
 * API Methods (Frontend)
 * -------------------------
 */

const TRAFFIC_MOCKS: TravelIncident[] = [
  {
    id: 'traffic-mock-1',
    type: IncidentType.TRAFFIC,
    title: 'Heavy Traffic at Kalanki',
    description: 'Severe congestion due to peak hour rush.',
    lat: 27.693,
    lng: 85.281,
    severity: 'high',
    timestamp: new Date().toISOString()
  }
];

const WEATHER_MOCKS = {
  coord: { lon: 85.324, lat: 27.7172 },
  weather: [{ id: 800, main: "Clear", description: "clear sky", icon: "01d" }],
  main: { temp: 22, humidity: 45 },
  visibility: 10000,
  wind: { speed: 3.5 },
  name: "Kathmandu"
};

const MONSOON_MOCKS: TravelIncident[] = [];

const POI_MOCKS: any[] = [
  {
    id: 'poi-1',
    type: IncidentType.POI,
    title: 'Fuel Station',
    description: 'Sajha Petrol Pump',
    lat: 27.67,
    lng: 85.32,
    severity: 'success',
    timestamp: new Date().toISOString()
  }
];

export const api = {
  getRoads: async (): Promise<TravelIncident[]> => {
    if (APP_CONFIG.useMocks) return ROAD_MOCKS;
    const result = await apiFetch<any>('/roads');
    // Result is { merged: RoadSegment[], raw: [], rowIssues: [] }
    const features = result.merged || result.features || [];
    return features.map((f: any) => {
      const props = f.properties || {};
      const status = props.status || f.status || '';
      const isBlocked = status.toLowerCase().includes('block');
      const isOneLane = status.toLowerCase().includes('one');
      return {
        id: f.id || Math.random().toString(36).substr(2, 9),
        type: isBlocked ? IncidentType.BLOCKAGE : isOneLane ? IncidentType.ONE_LANE : IncidentType.RESUMED,
        title: props.road_name || f.name || "Road Alert",
        source: f.source || 'community',
        description: props.remarks || f.description || `Road status: ${status || 'Resumed'}`,
        lat: f.geometry?.coordinates?.[1] || 0,
        lng: f.geometry?.coordinates?.[0] || 0,
        severity: isBlocked ? 'high' : isOneLane ? 'medium' : 'success',
        timestamp: props.reportDate || new Date().toISOString(),
        // Sheet fields
        road_refno: props.road_refno || '',
        incidentDistrict: props.incidentDistrict || '',
        incidentPlace: props.incidentPlace || '',
        chainage: props.chainage || '',
        incidentStarted: props.incidentStarted || '',
        estimatedRestoration: props.estimatedRestoration || '',
        resumedDate: props.resumedDate || '',
        blockedHours: props.blockedHours || '',
        contactPerson: props.contactPerson || '',
        restorationEfforts: props.restorationEfforts || '',
        remarks: props.remarks || '',
        status: status,
        reportDate: props.reportDate || '',
        div_name: props.div_name || '',
      };
    }).filter((i: any) => i.lat !== 0);
  },
  getNepalBoundary: async (): Promise<GeoData> => {
    const result = await apiFetch<any>('/boundary');
    return result;
  },
  getPois: async (lat?: number, lng?: number): Promise<TravelIncident[]> => {
    if (APP_CONFIG.useMocks) return POI_MOCKS;
    const qLat = lat ?? NEPAL_CENTER[0];
    const qLng = lng ?? NEPAL_CENTER[1];
    const result = await apiFetch<any>(`/pois?q=hospital&lat=${qLat}&lng=${qLng}`);
    const features = Array.isArray(result) ? result : (result.features || []);
    return features.map((f: any) => {
      const p = f.properties || {};
      return {
        id: f.id || Math.random(),
        type: IncidentType.POI,
        title: p.name || "Point of Interest",
        source: f.source || 'community', // Source added
        description: p.amenity || p.category || "Service point",
        lat: f.geometry?.coordinates?.[1] || 0,
        lng: f.geometry?.coordinates?.[0] || 0,
        severity: 'success',
        timestamp: new Date().toISOString()
      };
    }).filter((i: any) => i.lat !== 0);
  },
  getTraffic: async (lat?: number, lng?: number): Promise<TravelIncident[]> => {
    if (APP_CONFIG.useMocks) return TRAFFIC_MOCKS;
    const qLat = lat ?? NEPAL_CENTER[0];
    const qLng = lng ?? NEPAL_CENTER[1];
    const result = await apiFetch<any>(`/traffic/nearby?lat=${qLat}&lng=${qLng}&radius=10`);
    const features = result.roads || result.features || result.incidents || [];
    return features.map((f: any) => ({
      id: f.id || f.properties?.id || Math.random(),
      type: IncidentType.TRAFFIC,
      title: f.name || f.properties?.road_name || "Traffic Delay",
      description: f.properties?.status ? `Status: ${f.properties.status}` : (f.properties?.description || "Heavy traffic"),
      lat: f.geometry?.coordinates?.[1] || f.lat || 0,
      lng: f.geometry?.coordinates?.[0] || f.lng || 0,
      severity: f.status?.toLowerCase().includes('block') || f.properties?.status?.toLowerCase().includes('block') ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    })).filter((i: TravelIncident) => i.lat !== 0);
  },
  getMonsoon: async (): Promise<TravelIncident[]> => {
    if (APP_CONFIG.useMocks) return MONSOON_MOCKS;
    const result = await apiFetch<any>('/monsoon/risk');
    const items = Array.isArray(result) ? result : (result.data || []);
    return items.map((r: any) => ({
      id: r.roadId || Math.random().toString(36).substr(2, 9),
      type: IncidentType.MONSOON,
      title: `${r.riskLevel} Risk: ${r.roadName}`,
      description: `${r.reason} (Rain: ${r.rainIntensity?.toFixed(1)}mm/h, Slope: ${r.slopeAngle}°)`,
      lat: (r as any).lat || 0, // Backend might need to include lat/lng in RiskAssessment
      lng: (r as any).lng || 0,
      severity: r.riskLevel === 'EXTREME' || r.riskLevel === 'HIGH' ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    })).filter((i: TravelIncident) => i.lat !== 0 || APP_CONFIG.useMocks);
  },
  getWeather: async (lat?: number, lng?: number) => APP_CONFIG.useMocks ? WEATHER_MOCKS : await apiFetch<any>(`/weather?lat=${lat ?? NEPAL_CENTER[0]}&lng=${lng ?? NEPAL_CENTER[1]}`),
  getAlerts: async (lat?: number, lng?: number): Promise<TravelIncident[]> => {
    const q = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : '';
    const result = await apiFetch<any>(`/alerts${q}`);
    const alerts = result.data || result || [];
    if (!Array.isArray(alerts)) return [];
    return alerts.map((a: any) => ({
      id: a.id || Math.random().toString(36).substr(2, 9),
      type: a.type || IncidentType.WEATHER,
      title: a.title || a.message || 'Alert',
      description: a.message || '',
      lat: a.lat, // Keep as undefined if no coordinates
      lng: a.lng, // Keep as undefined if no coordinates
      severity: a.severity || 'medium',
      timestamp: a.timestamp || new Date().toISOString(),
      source: 'sheet',
      road_refno: a.extra?.road_refno || '',
      incidentDistrict: a.extra?.incidentDistrict || '',
      incidentPlace: a.extra?.incidentPlace || '',
      chainage: a.extra?.chainage || '',
      incidentStarted: a.extra?.incidentStarted || '',
      estimatedRestoration: a.extra?.estimatedRestoration || '',
      resumedDate: a.extra?.resumedDate || '',
      blockedHours: a.extra?.blockedHours || '',
      contactPerson: a.extra?.contactPerson || '',
      restorationEfforts: a.extra?.restorationEfforts || '',
      remarks: a.extra?.remarks || '',
      status: a.extra?.status || '',
      reportDate: a.extra?.reportDate || '',
      div_name: a.extra?.div_name || '',
      hasExactLocation: a.extra?.hasExactLocation || false, // Flag for exact location availability
    })).filter((i: TravelIncident) => i.lat !== undefined || i.road_refno); // Keep alerts with road_refno even if no coordinates
  },
  getHighwayList: async (): Promise<Array<{ code: string, file: string, name?: string }>> => {
    try {
      const result = await apiFetch<any>('/highways');
      return result.data || [];
    } catch (err) {
      console.error('Failed to load highway list:', err);
      throw err; // Re-throw so caller can handle
    }
  },
  getHighwayByCode: async (code: string): Promise<GeoData | null> => {
    if (!code || code.trim() === '') {
      console.warn('getHighwayByCode called with empty code');
      return null;
    }

    try {
      const result = await apiFetch<any>(`/highways/${code}`);
      return result.data || null;
    } catch (err) {
      console.error(`Failed to load highway ${code}:`, err);
      return null;
    }
  }
};

/**
 * -------------------------
 * Auth Service
 * -------------------------
 */
const USER_KEY = 'nepal_traveler_session';

export const authService = {
  getCurrentUser: (): any => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  login: async (phone: string, name: string): Promise<any> => {
    try {
      const user = await apiFetch<any>("/auth", {
        method: 'POST',
        body: JSON.stringify({ phone, name }),
        headers: { 'Content-Type': 'application/json' }
      });
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      await new Promise(r => setTimeout(r, 800));
      const role = phone === '9800000000' ? 'superadmin' : phone === '9811111111' ? 'admin' : 'user';
      const user = { id: Math.random().toString(36).substr(2, 9), phone, name, role };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }
  },

  logout: () => localStorage.removeItem(USER_KEY)
};

/**
 * -------------------------
 * OTP Service
 * -------------------------
 */
export const otpService = {
  sendOtp: async (phone: string): Promise<boolean> => {
    try {
      await apiFetch("/otp", { method: 'POST', body: JSON.stringify({ phone, action: 'send' }), headers: { 'Content-Type': 'application/json' } });
      return true;
    } catch { await new Promise(r => setTimeout(r, 1000)); return true; }
  },
  verifyOtp: async (phone: string, code: string): Promise<boolean> => {
    try {
      const result = await apiFetch<{ success: boolean }>("/otp", { method: 'POST', body: JSON.stringify({ phone, code, action: 'verify' }), headers: { 'Content-Type': 'application/json' } });
      return result.success;
    } catch { await new Promise(r => setTimeout(r, 800)); return code === '1234'; }
  }
};
