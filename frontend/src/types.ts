
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

// Added DataSource type definition
export type DataSource = 'live' | 'cache' | 'mock';

/**
 * Data source for incidents and road status
 * - DOR / Department of Roads: Official government data from 80 highways
 * - TomTom: Real-time traffic flow/speed data
 * - Waze: Community-reported traffic alerts
 * - Community / User Report: User-submitted incidents
 * - OSM / Overpass: OpenStreetMap fallback geometry
 */
export type IncidentSource =
  | 'DOR'
  | 'Department of Roads'
  | 'sheets'
  | 'highway'
  | 'tomtom'
  | 'waze'
  | 'community'
  | 'user'
  | 'overpass'
  | 'Verified';

export interface TravelIncident {
  id: string;
  type: string;
  title: string;
  name?: string; // Optional name alias for compatibility
  description: string;
  lat?: number; // Made optional for incidents without exact coordinates
  lng?: number; // Made optional for incidents without exact coordinates
  severity: 'low' | 'medium' | 'high' | 'success';
  timestamp: string;
  source?: IncidentSource | string;
  road_refno?: string;
  incidentDistrict?: string;
  incidentPlace?: string;
  chainage?: string;
  incidentStarted?: string;
  estimatedRestoration?: string;
  resumedDate?: string;
  blockedHours?: string;
  contactPerson?: string;
  restorationEfforts?: string;
  remarks?: string;
  status?: string;
  reportDate?: string;
  div_name?: string;
  distance?: number;
  phone?: string;
  hours?: string;
  rating?: number;
  hasExactLocation?: boolean; // Flag indicating if exact coordinates are available
}

export interface MapSettings {
  mode: 'standard' | 'satellite' | 'terrain';
  showBoundary: boolean;
  is3D: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}