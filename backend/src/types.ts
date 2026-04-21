/**
 * MeroSadak Type Definitions
 * This file serves as the single source of truth for data structures
 * shared across services, controllers, and the frontend.
 */

// ---------------- Basic Labels ----------------
export type Label = {
  en: string | null;
  ne?: string | null;
  [key: string]: string | null | undefined;
};

// ---------------- User & Auth ----------------
export type UserRole = "superadmin" | "admin" | "user";

export type User = {
  id: string | number;
  email: string;
  role: UserRole;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

export interface UserPreferences {
  language: string;
  defaultLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
  notificationPreferences: {
    push: boolean;
    email: boolean;
    telegram: boolean;
    weatherAlerts: boolean;
    roadBlockAlerts: boolean;
    monsoonAlerts: boolean;
  };
  favoriteHighways: string[];
  savedLocations: Array<{ name: string; lat: number; lng: number; createdAt: string }>;
  theme: "light" | "dark" | "auto";
  mapStyle: "standard" | "satellite" | "terrain" | "dark";
  autoRefreshInterval: number;
  showTrafficOverlay: boolean;
  showWeatherOverlay: boolean;
  showMonsoonOverlay: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  name?: string;
  phone?: string;
  preferences: UserPreferences;
  stats: {
    incidentsReported: number;
    incidentsVerified: number;
    votesCast: number;
    routesPlanned: number;
    memberSince: string;
    lastActive: string;
  };
  badges: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------- UI & Branding ----------------
/** 
 * major colors for the logo-click theme selector:
 * Blue (Default), Emerald (Green), Rose (Red), Amber (Orange), Indigo (Indigo), Violet (Purple)
 */
export type ThemeColor = "blue" | "emerald" | "rose" | "amber" | "indigo" | "violet";

export type UIConfig = {
  themeColor: ThemeColor;
  /** 
   * 'fullscreen' is the classic map view.
   * 'split' divides the screen 50/50 between map and display board.
   */
  layoutMode: "fullscreen" | "split";
  /** 
   * When true, the UI is a fixed split-screen for navigation.
   * When false, the UI becomes a vertically scrollable page showing 
   * creators' info and deep service documentation.
   */
  isLocked: boolean;
  /** 
   * mapOpacity: 1.0 (Normal), < 1.0 (Deem/Transparent) 
   * Used specifically when search is active.
   */
  mapOpacity: number;
  notificationsEnabled: boolean;
};

// ---------------- Geography ----------------
export type LatLng = {
  lat: number;
  lng: number;
};

// ---------------- Road Status ----------------
export type RoadStatusCode = "Blocked" | "One-Lane" | "Resumed";

export type RoadStatus = {
  road_refno: string;
  status: RoadStatusCode;
  chainage?: string | null;
  incidentDistrict?: Label;
  incidentPlace?: Label;
  province?: string | null;
  div_name?: string | null;
  incidentStarted?: string | null;
  estimatedRestoration?: string | null;
  restorationEfforts?: string | null;
  remarks?: string | null;
  dataPulledDate?: string;
  coordinate?: LatLng | null;
  incidentCoordinate?: string | null; // Raw string from sheet before parsing
  source?: "DOR" | "cache" | "mock" | "sheets";
  toll?: {
    highwayCode?: string;
    highwayName?: string;
    fee?: string;
    remarks?: string;
    hasToll?: boolean;
  };
};

export type GeoJSONLineString = { type: "LineString"; coordinates: [number, number][] };
export type GeoJSONMultiLineString = { type: "MultiLineString"; coordinates: [number, number][][] };
export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONMultiLineString;

export interface RoadSegment {
  id: string;
  name: string;
  chainageStart?: number;
  chainageEnd?: number;
  geometry: GeoJSONGeometry;
  status: RoadStatusCode;
  source: string;
  properties: RoadStatus & Record<string, any>;
}

// ---------------- Other Data Points ----------------

export interface TrafficFlowSegment {
  id: string;
  coordinates: [number, number][];
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  color: 'green' | 'yellow' | 'orange' | 'red';
  delay: number;
  confidence: number;
}

export interface WazeAlert {
  id: string;
  type: string;
  subtype: string;
  location: { lat: number; lng: number };
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface TrafficResult {
  flowSegments: TrafficFlowSegment[];
  wazeAlerts: WazeAlert[];
  summary: {
    totalSegments: number;
    congestedSegments: number;
    averageSpeed: number;
    averageDelay: number;
  };
  lastUpdated: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface RiskAssessment {
  roadId: string;
  roadName: string;
  riskLevel: RiskLevel;
  color: string;
  reason: string;
  rainIntensity?: number;
  slopeAngle?: number;
  lat: number;
  lng: number;
}

/** Groups for the Display Board Hub */
export type POIGroup = "Fuel" | "Medical" | "Logistics" | "Police" | "Tourist" | "Food";

export type POI = {
  id: number;
  nameLabel?: Label;
  coordinate?: LatLng | null;
  type?: string;
  group?: POIGroup; // Grouping for the dashboard
  city?: string;
  source?: "api" | "mock" | "cache";
  details?: {
    status: "Open" | "Closed" | "Busy";
    contact?: string;
    lastVerified?: string;
    amenities?: string[];
  };
};

export interface AlertEntry {
  id: string | number;
  type: string;
  title: string;
  message: string;
  severity: string;
  lat?: number;
  lng?: number;
  extra?: any;
  timestamp: string;
}

export type WeatherData = {
  id?: number;
  locationLabel?: Label;
  coordinate?: LatLng | null;
  temp?: number;
  condition?: string;
  lastUpdated?: string;
  source?: "openweathermap" | "open-meteo" | "mock" | "cache";
};

// ---------------- Vehicle & Driver Telemetry ----------------
export type VehicleHealth = {
  fuelLevel: number; // Percentage
  engineTemp: number; // Celsius
  tirePressure: "Optimal" | "Low" | "Critical";
  batteryVoltage: number;
  oilLife: number; // Percentage
  isOdometerDue: boolean;
  lastServiceDate?: string;
};

// ---------------- AI Reminder Service ----------------
export type AIReminder = {
  id: string;
  planId?: string; // Links the reminder to a specific Travel Plan
  task: string;
  alertTime: string; // ISO string
  proactiveSuggestion?: string;
  status: "pending" | "suggested" | "completed";
  category: "travel" | "maintenance" | "safety";
  createdAt: string;
};

// ---------------- Service Hub Metadata ----------------
export type ServiceCategory = "safety" | "services" | "traffic" | "infrastructure";

export type ServiceDashboardMetadata = {
  id: string;
  category: ServiceCategory;
  icon: string;
  label: Label;
  priority: number;
  hasLiveUpdates: boolean;
};

// ---------------- Route Planning ----------------

export interface RouteOption {
  id: string;
  name: string;
  description: string;
  waypoints: LatLng[];
  highways: string[];
  estimatedDistance: number;
  estimatedDuration: number;
  riskScore: number;
  conditionScore: number;
  isRecommended: boolean;
  status: "optimal" | "alternative" | "avoid";
  warnings: string[];
  highlights: string[];
}

export interface RoutePlan {
  origin: LatLng;
  destination: LatLng;
  routes: RouteOption[];
  recommendedRouteId: string;
  calculatedAt: string;
}

export interface RouteRiskFactors {
  blockedIncidents: number;
  oneLaneIncidents: number;
  monsoonRisk: boolean;
  nightTravel: boolean;
  mountainousTerrain: boolean;
  roadQuality: "good" | "fair" | "poor";
}

// ---------------- Search ----------------
export type SearchResult = {
  id: string | number;
  type: "road" | "traffic" | "poi" | "location" | "weather";
  name: string;
  lat: number;
  lng: number;
  subtitle?: string;
  source: "local" | "tomtom" | "osm" | "weather";
  score?: number;
  extra?: any;
};

// ---------------- GeoJSON ----------------
export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONFeature<P = unknown> {
  type: "Feature";
  geometry: GeoJSONPoint | { type: string; coordinates: any };
  properties: P;
}

export interface GeoJSONFeatureCollection<P = unknown> {
  type: "FeatureCollection";
  features: GeoJSONFeature<P>[];
  // Metadata for Superadmin Dashboard
  updatedFeatures?: number;
  totalSheetRows?: number;
  lastSyncTime?: string;
}

// Shortcut for the master road collection used by the map
export type FeatureCollection = GeoJSONFeatureCollection<RoadStatus & Record<string, unknown>>;

// ---------------- OTP & Auth Logic ----------------
export type OTPMethod = "email" | "sms" | "telegram" | "inapp";

export type OTPEntry = {
  email: string;
  code: string;
  expiresAt: string | number | Date; // Flexible for different storage types
  method: OTPMethod;
  attempts: number;
  telegramChatId?: string; // Needed for Telegram response routing
};

export type JWTPayload = {
  email: string;
  role: UserRole;
  identifier: string; // Could be email or Telegram ID
  method: OTPMethod;
  iat?: number;
  exp?: number;
};
