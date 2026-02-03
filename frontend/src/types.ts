
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
  ONE_WAY = 'One Way',
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