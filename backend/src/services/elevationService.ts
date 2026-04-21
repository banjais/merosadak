import axios from "axios";
import { logError } from "../logs/logs.js";

interface Point {
    lat: number;
    lng: number;
}

interface ElevationPoint extends Point {
    elevation: number;
}

/**
 * Fetches or simulates elevation data for a given path
 */
export async function getPathElevation(points: Point[]): Promise<ElevationPoint[]> {
    if (!points || points.length === 0) return [];

    try {
        // Use Open-Meteo Elevation API for real-world terrain data
        const lats = points.map(p => p.lat).join(',');
        const lons = points.map(p => p.lng).join(',');

        const response = await axios.get(
            `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`,
            { timeout: 5000 }
        );

        const elevations = response.data.elevation;

        return points.map((p, index) => ({
            ...p,
            elevation: Math.round(elevations[index])
        }));
    } catch (err: any) {
        logError("[ElevationService] Failed to fetch profile from Open-Meteo", err.message);
        return points.map(p => ({ ...p, elevation: 0 }));
    }
}