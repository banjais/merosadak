/**
 * Core spatial utilities for Nepal Strategic Road Network analysis
 */

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Validates if a coordinate is within the administrative bounds of Nepal.
 * Approx: 80.0°E to 88.3°E | 26.3°N to 30.5°N
 */
export function isValidNepalCoordinate(lat: number, lng: number): boolean {
    return lat >= 26.3 && lat <= 30.5 && lng >= 80.0 && lng <= 88.3;
}

/**
 * Calculates the bearing (azimuth) between two points in degrees.
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const startLat = lat1 * (Math.PI / 180);
    const startLng = lng1 * (Math.PI / 180);
    const endLat = lat2 * (Math.PI / 180);
    const endLng = lng2 * (Math.PI / 180);

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
}

/**
 * Calculates total length of a LineString coordinate array in km.
 */
export function calculateLineStringLength(coordinates: [number, number][] | number[][]): number {
    let length = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        length += haversineDistance(coordinates[i][1], coordinates[i][0], coordinates[i + 1][1], coordinates[i + 1][0]);
    }
    return length;
}