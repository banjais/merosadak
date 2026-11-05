/**
 * Sunrise / sunset (NOAA general solar position equations, ~1 min accuracy)
 * and arrival-time helpers for the trip summary. All display is pinned to
 * Nepal time so the numbers match what the traveller's watch shows.
 */

const NPT = 'Asia/Kathmandu';
const RAD = Math.PI / 180;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

export function sunTimesFor(now: Date, lat: number, lng: number): SunTimes | null {
  // Calendar date as seen in Nepal (UTC+5:45), independent of the device zone.
  const local = new Date(now.getTime() + 5.75 * 3600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const dayStart = Date.UTC(y, m, d);
  const n = Math.floor((dayStart - Date.UTC(y, 0, 0)) / 86_400_000);

  const g = (2 * Math.PI / 365) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);

  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (!Number.isFinite(cosHa) || cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / RAD;

  const sunriseMin = 720 - 4 * (lng + ha) - eqTime;
  const sunsetMin = 720 - 4 * (lng - ha) - eqTime;
  // Minutes above are UTC minutes of that solar day, so they offset UTC midnight of the date.
  const base = dayStart;
  return {
    sunrise: new Date(base + sunriseMin * 60_000),
    sunset: new Date(base + sunsetMin * 60_000),
  };
}

export function formatNepalTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NPT,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export interface ArrivalInfo {
  arrival: Date;
  /** Present only when leaving now would arrive after sunset. */
  afterDark?: { sunset: Date; leaveBy: Date; leaveByIsPast: boolean };
}

const DAYLIGHT_BUFFER_MIN = 30;

export function arrivalFor(
  now: Date,
  durationMin: number,
  dest: { lat: number; lng: number }
): ArrivalInfo {
  const arrival = new Date(now.getTime() + durationMin * 60_000);
  // Trips over ~14 h are overnight by nature; a daylight hint would only nag.
  if (!(durationMin > 0) || durationMin > 14 * 60) return { arrival };
  const sun = sunTimesFor(arrival, dest.lat, dest.lng);
  if (!sun || arrival.getTime() <= sun.sunset.getTime()) return { arrival };
  const leaveBy = new Date(sun.sunset.getTime() - (durationMin + DAYLIGHT_BUFFER_MIN) * 60_000);
  return { arrival, afterDark: { sunset: sun.sunset, leaveBy, leaveByIsPast: leaveBy.getTime() <= now.getTime() } };
}
