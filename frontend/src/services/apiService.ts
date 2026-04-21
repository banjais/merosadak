// frontend/src/services/apiService.ts
import { APP_CONFIG, NEPAL_CENTER } from "../config/config";
import { apiFetch } from "../api";
import type { TravelIncident } from "../types";
export type { TravelIncident } from "../types";
import { resolveLabel } from "../utils/labelUtils";

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
 * API Methods (Frontend)
 * -------------------------
 */

export const api = {
  getRoads: async (lang: string = 'en'): Promise<TravelIncident[]> => {
    const result = await apiFetch<any>('/roads/all');
    // Result is { merged: RoadSegment[], raw: [], rowIssues: [] }
    const features = result.merged || result.features || [];
    return features.map((f: any) => {
      const props = f.properties || {};
      const status = props.status || f.status || '';
      const isBlocked = status.toLowerCase().includes('block');
      const isOneLane = status.toLowerCase().includes('one');

      let lat = 0;
      let lng = 0;
      const geom = f.geometry;
      if (geom?.type === 'Point') {
        lng = geom.coordinates[0];
        lat = geom.coordinates[1];
      } else if (geom?.type === 'LineString' && geom.coordinates.length > 0) {
        // Take the first point of the line as the reference coordinate
        lng = geom.coordinates[0][0];
        lat = geom.coordinates[0][1];
      }

      return {
        id: f.id || Math.random().toString(36).substr(2, 9),
        type: isBlocked ? IncidentType.BLOCKAGE : isOneLane ? IncidentType.ONE_LANE : IncidentType.RESUMED,
        title: resolveLabel(props.road_name, lang) || f.name || "Road Alert",
        source: f.source || 'community',
        description: resolveLabel(props.remarks, lang) || f.description || `Road status: ${status || 'Resumed'}`,
        lat,
        lng,
        severity: isBlocked ? 'high' : isOneLane ? 'medium' : 'success',
        timestamp: props.reportDate || new Date().toISOString(),
        // Sheet fields
        road_refno: props.road_refno || '',
        incidentDistrict: resolveLabel(props.incidentDistrict, lang),
        incidentPlace: resolveLabel(props.incidentPlace, lang),
        chainage: props.chainage || '',
        incidentStarted: props.incidentStarted || '',
        estimatedRestoration: props.estimatedRestoration || '',
        resumedDate: props.resumedDate || '',
        blockedHours: props.blockedHours || '',
        contactPerson: props.contactPerson || '',
        restorationEfforts: props.restorationEfforts || '',
        remarks: resolveLabel(props.remarks, lang),
        status: status,
        reportDate: props.reportDate || '',
        div_name: props.div_name || '',
      };
    }).filter((i: any) => i.lat !== 0);
  },
  getNepalBoundary: async (): Promise<GeoData> => {
    const result = await apiFetch<any>('/boundary');
    return result.data || result;
  },
  getPois: async (lat?: number, lng?: number): Promise<TravelIncident[]> => {
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
    })).filter((i: TravelIncident) => i.lat !== 0);
  },
  getWeather: async (lat?: number, lng?: number): Promise<TravelIncident[]> => {
    const data = await apiFetch<any>(`/weather?lat=${lat ?? NEPAL_CENTER[0]}&lng=${lng ?? NEPAL_CENTER[1]}`);
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && (data.main || data.weather)) {
      const weather = data.weather?.[0];
      return [{
        id: `weather-${lat ?? 0}-${lng ?? 0}`,
        type: IncidentType.WEATHER,
        title: weather?.main || data.name || 'Weather',
        description: weather?.description || `Temp: ${data.main?.temp ?? 'N/A'}°C, Humidity: ${data.main?.humidity ?? 'N/A'}%`,
        lat: data.coord?.lat ?? lat ?? 0,
        lng: data.coord?.lon ?? lng ?? 0,
        severity: (data.main?.temp ?? 0) < 5 || (data.wind?.speed ?? 0) > 20 ? 'high' : 'low',
        timestamp: new Date().toISOString(),
      }];
    }
    return [];
  },
  getAlerts: async (lat?: number, lng?: number, lang: string = 'en'): Promise<TravelIncident[]> => {
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
      incidentDistrict: resolveLabel(a.extra?.incidentDistrict, lang),
      incidentPlace: resolveLabel(a.extra?.incidentPlace, lang),
      chainage: a.extra?.chainage || '',
      incidentStarted: a.extra?.incidentStarted || '',
      estimatedRestoration: a.extra?.estimatedRestoration || '',
      resumedDate: a.extra?.resumedDate || '',
      blockedHours: a.extra?.blockedHours || '',
      contactPerson: a.extra?.contactPerson || '',
      restorationEfforts: a.extra?.restorationEfforts || '',
      remarks: resolveLabel(a.extra?.remarks, lang),
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
  },
  getHighwayReport: async (code: string, lang: string = 'en'): Promise<any> => {
    try {
      const result = await apiFetch<any>(`/highways/${code}/report?lang=${lang}`);
      return result.data || null;
    } catch (err) {
      console.error(`Failed to load highway report for ${code}:`, err);
      return null;
    }
  },
  suggestAlternativeRoutes: async (from: string, to: string, lang: string = 'en'): Promise<any[]> => {
    try {
      const result = await apiFetch<any>(`/highways/alternatives?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&lang=${lang}`);
      return result.data || [];
    } catch (err) {
      console.error('Failed to suggest alternative routes:', err);
      return [];
    }
  },
  getHighwayIncidents: async (code: string, lang: string = 'en'): Promise<any> => {
    try {
      const result = await apiFetch<any>(`/highways/${code}/incidents?lang=${lang}`);
      return result.data || result;
    } catch (err) {
      console.error(`Failed to load incidents for highway ${code}:`, err);
      return { code: code.toUpperCase(), totalActive: 0, blocked: 0, oneLane: 0, fromSegments: {}, fromSheet: {}, error: true };
    }
  }
};

/**
 * -------------------------
 * Auth Service
 * -------------------------
 * Backend: POST /auth/request-otp ({email}), POST /auth/login ({email, otp})
 */
const USER_KEY = 'merosadak_session';

export const authService = {
  getCurrentUser: (): any => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  requestOtp: async (email: string): Promise<any> => {
    try {
      return await apiFetch<any>("/auth/request-otp", {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Auth request-otp failed:', error);
      throw error;
    }
  },

  login: async (email: string, otp: string): Promise<any> => {
    try {
      const result = await apiFetch<any>("/auth/login", {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
        headers: { 'Content-Type': 'application/json' }
      });
      const user = result.data || result;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Auth login failed:', error);
      throw error;
    }
  },

  logout: () => localStorage.removeItem(USER_KEY)
};

/**
 * -------------------------
 * OTP Service
 * Backend: POST /otp/request ({email}), POST /otp/login ({email, otp})
 * Note: /auth/* is the preferred path; /otp/* is legacy but kept for compatibility.
 * -------------------------
 */
export const otpService = {
  sendOtp: async (email: string): Promise<boolean> => {
    try {
      await apiFetch("/otp/request", {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' }
      });
      return true;
    } catch (error) {
      console.error('[OTP] Send request failed:', error);
      return false;
    }
  },
  verifyOtp: async (email: string, code: string): Promise<boolean> => {
    try {
      const result = await apiFetch<{ success: boolean }>("/otp/login", {
        method: 'POST',
        body: JSON.stringify({ email, otp: code }),
        headers: { 'Content-Type': 'application/json' }
      });
      return result.success;
    } catch (error) {
      console.error('OTP verification failed:', error);
      throw error;
    }
  }
};
