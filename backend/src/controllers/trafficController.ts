import { Request, Response } from 'express';
import { withCache } from '../services/cacheService.js';
import * as TrafficService from '../services/trafficService.js';
import { logError } from '@logs/logs';

/**
 * 🚦 Get traffic status
 * - If `query` provided → geocode first and return local traffic
 * - Else → return global highway traffic summary
 */
export const getTrafficStatus = async (req: Request, res: Response) => {
  try {
    const { query, lat, lng } = req.query;

    if (query && !lat) {
      // Geocode query string
      const location = await TrafficService.geocodeLocation(String(query));
      if (!location) return res.status(404).json({ success: false, message: "Location not found" });

      const data = await TrafficService.getTrafficFlow(location.lat, location.lng);
      return res.json({ success: true, location, data });
    }

    // Global highway flow (cached)
    const trafficData = await withCache("api:traffic:flow:global", TrafficService.getGlobalHighwayFlow, 300);
    return res.json({ success: true, data: trafficData });

  } catch (err: any) {
    logError('Traffic Controller Error', { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch traffic data" });
  }
};

export const getTraffic = getTrafficStatus;

/**
 * 🖼️ Get traffic overlay tile for map
 */
export const getTrafficTile = async (req: Request, res: Response) => {
  const { z, x, y } = req.params;
  const cacheKey = `tile:traffic:${z}:${x}:${y}`;
  const CACHE_TIME = 120; // seconds

  try {
    const base64Tile = await withCache<string>(cacheKey, async () => {
      const buffer = await TrafficService.fetchTrafficTile(z, x, y);
      return buffer.toString('base64');
    }, CACHE_TIME);

    const imageBuffer = Buffer.from(base64Tile, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TIME}`);
    return res.send(imageBuffer);

  } catch (err: any) {
    logError('Traffic Tile Error', { z, x, y, error: err.message });
    return res.status(404).send();
  }
};
