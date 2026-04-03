
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

export interface TravelIncident {
  id: string;
  type: string; 
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high' | 'success';
  timestamp: string;
  source?: string;
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