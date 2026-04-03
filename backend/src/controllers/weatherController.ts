import { Request, Response } from 'express';
import * as WeatherService from '../services/weatherService.js';
import { withCache } from '../services/cacheService.js';
import { config } from '../config/index.js';
import { logError, logInfo } from '../logs/logs.js';

/**
 * GET /api/weather/current?lat=27.7&lng=85.3
 */
export const getCurrentWeather = async (req: Request, res: Response) => {
  const { lat, lng } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, error: 'Valid lat (-90 to 90) and lng (-180 to 180) are required.' });
  }

  const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const CACHE_TIME = 900; // 15 min

  try {
    const data = await withCache(
      cacheKey,
      () => WeatherService.getRealWeather(latitude, longitude),
      CACHE_TIME
    );

    res.set('Cache-Control', `public, max-age=${CACHE_TIME}`);
    return res.json({ success: true, data });

  } catch (err: any) {
    logError('[weatherController] Fetch Error', { coords: `${latitude},${longitude}`, message: err.message });
    return res.status(500).json({ success: false, error: 'Weather data temporarily unavailable.' });
  }
};
