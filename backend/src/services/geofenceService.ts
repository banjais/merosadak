// backend/src/services/geofenceService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { getWeather } from "./weatherService.js";
import { getCachedRoads } from "./roadService.js";

// ────────────────────────────────
// Geofencing Alert Service
// Triggers alerts when users enter high-risk zones
// ────────────────────────────────

interface Location {
  lat: number;
  lng: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: Location;
  radius: number; // meters
  alertTypes: Array<"weather" | "blockage" | "landslide" | "flood">;
  riskLevel: "low" | "medium" | "high" | "critical";
  active: boolean;
}

interface GeofenceAlert {
  zoneId: string;
  zoneName: string;
  alertType: string;
  message: string;
  riskLevel: string;
  distance: number;
  timestamp: string;
}

// Predefined high-risk zones (in production, load from database)
let HIGH_RISK_ZONES: GeofenceZone[] = [
  {
    id: "zone_mugling_narayanghat",
    name: "Mugling-Narayanghat Road",
    center: { lat: 27.755, lng: 84.425 },
    radius: 20000,
    alertTypes: ["weather", "blockage", "landslide"],
    riskLevel: "high",
    active: true,
  },
  {
    id: "zone_prithvi_highway",
    name: "Prithvi Highway",
    center: { lat: 27.8, lng: 84.5 },
    radius: 30000,
    alertTypes: ["weather", "blockage"],
    riskLevel: "medium",
    active: true,
  },
  {
    id: "zone_kathmandu_valley",
    name: "Kathmandu Valley Entry Points",
    center: { lat: 27.7172, lng: 85.3240 },
    radius: 15000,
    alertTypes: ["weather", "blockage", "flood"],
    riskLevel: "medium",
    active: true,
  },
];

const GEOFENCE_FILE = path.join(DATA_DIR, "geofences.json");

/**
 * Loads geofence zones from a JSON file.
 * Provides persistence for dynamic zones and enables easier maintenance.
 */
export async function loadGeofences(): Promise<void> {
  try {
    const data = await fs.readFile(GEOFENCE_FILE, "utf-8");
    HIGH_RISK_ZONES = JSON.parse(data);
    logInfo("[Geofence] Successfully loaded zones from disk", { count: HIGH_RISK_ZONES.length });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      logInfo("[Geofence] No geofences.json found, initializing with defaults.");
      await fs.writeFile(GEOFENCE_FILE, JSON.stringify(HIGH_RISK_ZONES, null, 2));
    } else {
      logError("[Geofence] Error loading geofences from disk", err.message);
    }
  }
}

// Initialize on load
loadGeofences();

/**
 * Persists current geofence zones to the JSON file.
 */
export async function saveGeofences(): Promise<void> {
  try {
    await fs.writeFile(GEOFENCE_FILE, JSON.stringify(HIGH_RISK_ZONES, null, 2));
    logInfo("[Geofence] Successfully saved zones to disk");
  } catch (err: any) {
    logError("[Geofence] Error saving geofences to disk", err.message);
  }
}

/**
 * Haversine distance in meters
 */
function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a location is inside any geofence zone
 */
export function checkGeofence(location: Location): Array<{
  zone: GeofenceZone;
  distance: number;
  inside: boolean;
}> {
  const results = HIGH_RISK_ZONES.filter((zone) => zone.active).map((zone) => {
    // Optimization: Bounding Box Pre-filter
    // Skip expensive Haversine if point is clearly outside the square containing the circle
    const latDelta = zone.radius / 111320; // Approx degrees latitude
    const lngDelta = zone.radius / (111320 * Math.cos(location.lat * (Math.PI / 180)));

    if (location.lat < zone.center.lat - latDelta || location.lat > zone.center.lat + latDelta ||
      location.lng < zone.center.lng - lngDelta || location.lng > zone.center.lng + lngDelta) {
      return { zone, distance: Infinity, inside: false };
    }

    const distance = distanceInMeters(
      location.lat,
      location.lng,
      zone.center.lat,
      zone.center.lng
    );

    return {
      zone,
      distance,
      inside: distance <= zone.radius,
    };
  });

  return results;
}

/**
 * Get geofence alerts for a location
 */
export async function getGeofenceAlerts(
  location: Location,
  alertTypes?: Array<"weather" | "blockage" | "landslide" | "flood">
): Promise<GeofenceAlert[]> {
  const alerts: GeofenceAlert[] = [];

  const zones = checkGeofence(location);

  for (const { zone, distance, inside } of zones) {
    // Only trigger alerts for nearby or inside zones
    if (distance > zone.radius * 2) continue;

    const applicableTypes = alertTypes || zone.alertTypes;

    for (const alertType of applicableTypes) {
      if (!zone.alertTypes.includes(alertType)) continue;

      let message = "";

      switch (alertType) {
        case "weather":
          message = `Weather alert: ${zone.name} has active weather warnings`;
          break;
        case "blockage":
          message = `Road blockage alert: ${zone.name} may have blocked sections`;
          break;
        case "landslide":
          message = `Landslide risk: ${zone.name} has elevated landslide risk`;
          break;
        case "flood":
          message = `Flood alert: ${zone.name} has flood warnings`;
          break;
      }

      if (message) {
        alerts.push({
          zoneId: zone.id,
          zoneName: zone.name,
          alertType,
          message,
          riskLevel: zone.riskLevel,
          distance: Math.round(distance),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return alerts;
}

/**
 * Add custom geofence zone (runtime)
 */
export function addGeofenceZone(zone: GeofenceZone): void {
  HIGH_RISK_ZONES.push(zone);
  logInfo("[Geofence] Added new zone", { zoneId: zone.id, name: zone.name });
}

/**
 * Remove geofence zone
 */
export function removeGeofenceZone(zoneId: string): boolean {
  const index = HIGH_RISK_ZONES.findIndex((z) => z.id === zoneId);
  if (index >= 0) {
    HIGH_RISK_ZONES.splice(index, 1);
    logInfo("[Geofence] Removed zone", { zoneId });
    return true;
  }
  return false;
}

/**
 * Get all active zones
 */
export function getActiveZones(): GeofenceZone[] {
  return HIGH_RISK_ZONES.filter((z) => z.active);
}

/**
 * Get all geofence zones (including inactive ones)
 */
export function getAllGeofences(): GeofenceZone[] {
  return HIGH_RISK_ZONES;
}

/**
 * Check for critical alerts (immediate danger)
 */
export async function checkCriticalAlerts(location: Location): Promise<{
  isCritical: boolean;
  messages: string[];
  recommendedAction: string;
} | null> {
  const zones = checkGeofence(location);
  const criticalZones = zones.filter((z) => z.inside && z.zone.riskLevel === "critical");

  if (criticalZones.length === 0) {
    return null;
  }

  const messages = criticalZones.map((z) =>
    `CRITICAL: You are in ${z.zone.name} - ${z.zone.riskLevel.toUpperCase()} risk zone`
  );

  return {
    isCritical: true,
    messages,
    recommendedAction: "Exercise extreme caution. Consider alternative routes or delay travel.",
  };
}
