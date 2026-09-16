// Free DHM rainfall watch — used by worker index via dynamic path or future import
// Endpoint implemented in index until bundle splits: GET /api/dhm-rainfall
// Data: https://dhm.gov.np/home/getAPIData/3  (no key)
// Fallback: empty stations array (never break app)
// Thresholds mm: 1h=60, 3h=80, 6h=100, 12h=120, 24h=140

export const DHM_RAIN_API = "https://dhm.gov.np/home/getAPIData/3";
export const DHM_THRESHOLDS = { "1": 60, "3": 80, "6": 100, "12": 120, "24": 140 } as const;

export type DhmStation = {
  id: string;
  name: string;
  district: string | null;
  basin: string | null;
  lat: number;
  lng: number;
  averages: Record<string, number | null>;
  status: string;
  isWarning: boolean;
  isDanger: boolean;
  latestMm: number | null;
  latestAt: string | null;
};

export function normalizeDhmRainfall(raw: any): DhmStation[] {
  const list: any[] = Array.isArray(raw?.rainfall_watch) ? raw.rainfall_watch : [];
  return list
    .map((s) => {
      const lat = s.latitude != null ? Number(s.latitude) : NaN;
      const lng = s.longitude != null ? Number(s.longitude) : NaN;
      const averages: Record<string, number | null> = {};
      let isWarning = false;
      let isDanger = false;
      for (const a of s.averages || []) {
        const v = a.value === "N/A" || a.value == null ? null : Number(a.value);
        averages[String(a.interval)] = Number.isFinite(v as number) ? (v as number) : null;
        if (a.status?.warning) isWarning = true;
        if (a.status?.danger) isDanger = true;
      }
      const status = String(s.status || "N/A");
      if (/WARNING|DANGER|ALERT/i.test(status)) isWarning = true;
      if (/DANGER/i.test(status)) isDanger = true;
      return {
        id: String(s.id ?? s.name),
        name: String(s.name || "Station").trim(),
        district: (s.district || "").toString().trim() || null,
        basin: (s.basin || "").toString().trim() || null,
        lat,
        lng,
        averages,
        status,
        isWarning,
        isDanger,
        latestMm: s.latest_observation?.value != null ? Number(s.latest_observation.value) : null,
        latestAt: s.latest_observation?.datetime || null,
      };
    })
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
}
