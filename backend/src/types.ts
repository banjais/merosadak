/**
 * MeroSadak Type Definitions
 * This file serves as the single source of truth for data structures
 * shared across services, controllers, and the frontend.
 */

// ---------------- Basic Labels ----------------
export type Label = {
  en: string | null;
  ne?: string | null;
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
  incidentDistrict: Label;
  incidentPlace: Label;
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

// ---------------- Other Data Points ----------------
export type TrafficInfo = {
  id: number;
  highwayLabel?: Label;
  place?: string;
  status?: string | Label;
  coordinate?: LatLng | null;
  lastUpdated?: string;
  averageSpeed?: number;
  congestionLevel?: number;
  source?: "waze" | "tomtom" | "mock" | "cache";
};

export type POI = {
  id: number;
  nameLabel?: Label;
  coordinate?: LatLng | null;
  type?: string;
  city?: string;
  source?: "api" | "mock" | "cache";
};

export type WeatherData = {
  id?: number;
  locationLabel?: Label;
  coordinate?: LatLng | null;
  temp?: number;
  condition?: string;
  lastUpdated?: string;
  source?: "openweathermap" | "open-meteo" | "mock" | "cache";
};

// ---------------- Search ----------------
export type SearchResult = {
  id: number;
  type: "road" | "poi" | "traffic" | "weather";
  name: string;
  status?: string;
  coordinate?: LatLng | null;
  distance?: number;
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
