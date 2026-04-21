import type { FeatureCollection } from "../types.js";

/**
 * Haversine distance between two points in kilometers.
 * Earth radius: 6371 km
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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
 * Validates if a coordinate set is within the general vicinity of Nepal.
 * Bounds: approx 80.0E to 89.0E | 26.0N to 31.0N
 */
export function isValidNepalCoordinate(lat: number, lng: number): boolean {
    if (isNaN(lat) || isNaN(lng)) return false;
    const withinLat = lat >= 26.3 && lat <= 30.5;
    const withinLng = lng >= 80.0 && lng <= 88.3;
    return withinLat && withinLng;
}

/**
 * Calculate length of a LineString in kilometers using Haversine formula
 */
export function calculateLineStringLength(coordinates: number[][]): number {
    let length = 0;

    for (let i = 1; i < coordinates.length; i++) {
        const [lng1, lat1] = coordinates[i - 1];
        const [lng2, lat2] = coordinates[i];
        length += haversineDistance(lat1, lng1, lat2, lng2);
    }

    return length;
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const rad = Math.PI / 180;
    const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
    const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
        Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}