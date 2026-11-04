import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
   ArrowLeft, Route, Mountain, LocateFixed,
   AlertTriangle, Camera, MapPin, Plane, Bus, Fuel, Zap, Heart,
   UtensilsCrossed, Compass, Shield, Landmark, Info, CloudSun, CloudRain,
   CloudSnow, Wind, Droplets, Sun, Cloud, Phone, Bell, BellOff,
} from 'lucide-react';
import { findNearestHighwayFromCoords, findNearestHighwayJunction, findNearestHighwaysFromCoords, getDistanceKm } from '../utils/geoUtils';
import { reverseGeocode } from '../utils/reverseGeocode';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { CityNode } from '../types';

interface MyLocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
  localArea?: string | null;
  municipality?: string | null;
  district?: string | null;
  province?: string | null;
  nearestHighway: {
    highway: { code: string; name: string };
    segment: { from: string; to: string } | null;
    distanceKm: number | null;
    nearestPoint: { lat: number; lng: number } | null;
  } | null;
  nearestJunction: {
    city: CityNode | null;
    distanceKm: number | null;
  };
  address?: string | null;
  formattedAddress?: string | null;
}

interface NearbyItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  lat: number;
  lng: number;
  distanceKm: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    visibility: number;
    cloud_cover: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
  elevation: number;
  timezone: string;
}


const CATEGORY_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  airport: { icon: Plane, color: 'text-sky-400', label: 'Airport' },
  bus_station: { icon: Bus, color: 'text-amber-400', label: 'Bus Station' },
  ev_charger: { icon: Zap, color: 'text-emerald-400', label: 'EV Charger' },
  fuel_station: { icon: Fuel, color: 'text-orange-400', label: 'Fuel' },
  food_rest: { icon: UtensilsCrossed, color: 'text-yellow-400', label: 'Food' },
  hospital: { icon: Heart, color: 'text-rose-400', label: 'Hospital' },
  emergency_dor: { icon: Shield, color: 'text-red-400', label: 'Emergency' },
  temple: { icon: Landmark, color: 'text-amber-400', label: 'Temple' },
  attraction: { icon: Camera, color: 'text-fuchsia-400', label: 'Attraction' },
  viewpoint: { icon: Compass, color: 'text-cyan-400', label: 'Viewpoint' },
  tourist: { icon: Camera, color: 'text-fuchsia-400', label: 'Tourist Place' },
  landmark: { icon: MapPin, color: 'text-purple-400', label: 'Landmark' },
  pass: { icon: Mountain, color: 'text-slate-300', label: 'Mountain Pass' },
  interchange: { icon: Route, color: 'text-blue-400', label: 'Interchange' },
  poi: { icon: Info, color: 'text-indigo-400', label: 'POI' },
  place: { icon: MapPin, color: 'text-teal-400', label: 'Place' },
};

const DEFAULT_CONFIG = { icon: MapPin, color: 'text-slate-400', label: 'Location' };

function getConfig(category: string): { icon: React.ComponentType<{ className?: string }>; color: string; label: string } {
  return CATEGORY_CONFIG[category?.toLowerCase()] || DEFAULT_CONFIG;
}

function getWeatherIcon(code: number): React.ReactElement {
  if (code === 0) return <Sun className="w-5 h-5" />;
  if (code <= 3) return <Cloud className="w-5 h-5" />;
  if (code === 45 || code === 48) return <Cloud className="w-5 h-5" />;
  if (code <= 55) return <CloudRain className="w-5 h-5" />;
  if (code <= 65) return <CloudRain className="w-5 h-5" />;
  if (code <= 67) return <CloudRain className="w-5 h-5" />;
  if (code <= 75) return <CloudSnow className="w-5 h-5" />;
  if (code <= 82) return <CloudRain className="w-5 h-5" />;
  if (code >= 95) return <CloudRain className="w-5 h-5" />;
  return <Cloud className="w-5 h-5" />;
}

function getWeatherIconBg(code: number): string {
  if (code === 0) return 'bg-amber-500/20';
  if (code <= 3) return 'bg-slate-500/20';
  if (code === 45 || code === 48) return 'bg-slate-400/20';
  if (code <= 67) return 'bg-sky-500/20';
  if (code <= 75) return 'bg-blue-500/20';
  if (code <= 82) return 'bg-sky-500/20';
  if (code >= 95) return 'bg-purple-500/20';
  return 'bg-slate-500/20';
}

type TabType = 'weather' | 'incidents' | 'emergency' | 'airport' | 'bus_station' | 'temple' | 'tourist_place' | 'landmarks' | 'highway';

export const MyLocationPage: React.FC<{
  onBack: () => void;
}> = ({ onBack }) => {
  const [locationInfo, setLocationInfo] = useState<MyLocationInfo | null>(null);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('weather');
  const [showAllNearby, setShowAllNearby] = useState(false);

  const [touristPlaces, setTouristPlaces] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [airports, setAirports] = useState<any[]>([]);
  const [busStations, setBusStations] = useState<any[]>([]);
  const [temples, setTemples] = useState<any[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Last position the reverse geocode resolved, and the watcher's error kept in a
  // ref so the effect below can read it without re-subscribing.
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationErrorRef = useRef<unknown>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const fetches = [
        fetch('/data/tourist-places.json').then(r => r.json()).then(setTouristPlaces).catch(() => []),
        fetch('/data/incidents.json').then(r => r.json()).then(setIncidents).catch(() => []),
        fetch('/data/airports.json').then(r => r.json()).then(setAirports).catch(() => []),
        fetch('/data/bus-stations.json').then(r => r.json()).then(setBusStations).catch(() => []),
        fetch('/data/temples.json').then(r => r.json()).then(setTemples).catch(() => []),
        fetch('/data/landmarks.json').then(r => r.json()).then(setLandmarks).catch(() => []),
        fetch('/data/pois.json').then(r => r.json()).then(setPois).catch(() => []),
      ];
      await Promise.allSettled(fetches);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!locationInfo?.lat || !locationInfo?.lng) return;
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${locationInfo.lat}&longitude=${locationInfo.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,visibility,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Kathmandu`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          // Open-Meteo returns a real `elevation`; use it as-is. The previous
          // code overwrote it with the latitude, which was never correct.
          setWeather({ ...data, elevation: data.elevation ?? 0 });
          setWeatherError(null);
        }
      } catch (err) {
        if (!cancelled) setWeatherError((err as Error).message);
      }
    };
    fetchWeather();
    return () => { cancelled = true; };
  }, [locationInfo?.lat, locationInfo?.lng]);

  /**
   * Derive everything this page shows from one fix. Cheap, synchronous parts
   * (nearest highway, nearest junction) are recomputed on every fix so the page
   * tracks the user in real time. The reverse-geocode call is rate-limited by
   * Nominatim, so it only runs when the fix has moved far enough to change the
   * address, or when there is no address yet.
   */
  const applyFix = useCallback((lat: number, lng: number, accuracy: number | null) => {
    const highwayInfo = findNearestHighwayFromCoords(lat, lng);
    const nearestHighway = highwayInfo
      ? {
          highway: { code: highwayInfo.highway?.code ?? '', name: highwayInfo.highway?.name ?? '' },
          segment: highwayInfo.segment
            ? { from: highwayInfo.segment.from, to: highwayInfo.segment.to }
            : null,
          distanceKm: highwayInfo.distanceKm,
          nearestPoint: highwayInfo.nearestPoint,
        }
      : null;

    const junctionInfo = findNearestHighwayJunction(lat, lng);

    // Reuse the last address while the user stays on the same street, so the
    // page does not fire a geocoding request on every GPS sample.
    const previous = lastGeocodedRef.current;
    const movedM = previous ? getDistanceKm(previous.lat, previous.lng, lat, lng) * 1000 : Infinity;
    const needsAddress = movedM > 25 || !previous;

    const base = {
      lat,
      lng,
      accuracy,
      nearestHighway,
      nearestJunction: junctionInfo,
    };

    if (!needsAddress) {
      setLocationInfo((prev) => ({
        ...base,
        address: prev?.address ?? null,
        formattedAddress: prev?.formattedAddress ?? null,
        localArea: prev?.localArea ?? null,
        municipality: prev?.municipality ?? null,
        district: prev?.district ?? null,
        province: prev?.province ?? null,
      }));
      return;
    }

    lastGeocodedRef.current = { lat, lng };
    setLocationInfo({ ...base, address: null, formattedAddress: null, localArea: null, municipality: null, district: null, province: null });

    // The shared reverse geocoder — the Route Planner describes its fix through
    // the very same call, so both surfaces read as the same place. Movement
    // throttling and per-cell caching live inside the module.
    // No cancellation flag. The effect re-runs on every watcher error or
    // tracking-state change, and a cleanup flag there used to swallow the
    // in-flight answer, leaving the page on "Detecting address..." until
    // the user moved 25 m. The setState guard below already discards a
    // result for a position the page has moved past — the only staleness
    // that matters — and the shared module dedupes concurrent requests
    // for one grid cell.
    void reverseGeocode(lat, lng).then((result) => {
      if (!result) return;
      setLocationInfo((prev) => (prev && prev.lat === lat && prev.lng === lng)
        ? { ...prev, address: result.displayName, formattedAddress: result.formatted, localArea: result.localArea, municipality: result.municipality, district: result.district, province: result.province }
        : prev);
    });

  }, []);

  // One shared device watcher. This page no longer asks for its own position: it
  // derives everything from the fix the watcher already produces, so it stays
  // current as the user walks or drives and agrees with the map and planner.
  const { fix, watching, accuracyLabel, refresh, restart, error: locationError } = useDeviceLocation();
  locationErrorRef.current = locationError;

  useEffect(() => {
    if (!fix) {
      if (!watching && locationError) setError('Failed to detect location. Please allow GPS permission and try again.');
      setLoading(false);
      return;
    }
    setError(null);
    return applyFix(fix.lat, fix.lng, fix.accuracy);
  }, [fix, watching, locationError, applyFix]);

  const metersToKm = (m: number | null) => {
    if (m === null) return '—';
    if (m < 100) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  };

  const nearbyAirports = useMemo(() => {
    if (!locationInfo || airports.length === 0) return [];
    return airports
      .map((a: any) => {
        if (a.lat == null || a.lng == null) return null;
        const d = getDistanceKm(locationInfo.lat, locationInfo.lng, a.lat, a.lng);
        const cfg = getConfig('airport');
        return { id: a.code || `air-${a.name}`, name: a.name, category: 'Airport', subcategory: a.type || a.district, lat: a.lat, lng: a.lng, distanceKm: d, icon: cfg.icon, color: cfg.color };
      })
      .filter(Boolean)
      .filter((item) => item.distanceKm <= 25)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  }, [locationInfo?.lat, locationInfo?.lng, airports]);

  const nearbyBusStations = useMemo(() => {
    if (!locationInfo || busStations.length === 0) return [];
    return busStations
      .map((b: any) => {
        if (b.lat == null || b.lng == null) return null;
        const d = getDistanceKm(locationInfo.lat, locationInfo.lng, b.lat, b.lng);
        const cfg = getConfig('bus_station');
        return { id: b.id || `bus-${b.name}`, name: b.name, category: 'Bus Station', subcategory: b.location || b.district, lat: b.lat, lng: b.lng, distanceKm: d, icon: cfg.icon, color: cfg.color };
      })
      .filter(Boolean)
      .filter((item) => item.distanceKm <= 25)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  }, [locationInfo?.lat, locationInfo?.lng, busStations]);

  const nearbyTemples = useMemo(() => {
    if (!locationInfo || temples.length === 0) return [];
    return temples
      .map((t: any) => {
        if (t.lat == null || t.lng == null) return null;
        const d = getDistanceKm(locationInfo.lat, locationInfo.lng, t.lat, t.lng);
        const cfg = getConfig('temple');
        return { id: t.id || `temple-${t.name}`, name: t.name, category: 'Temple', subcategory: t.location || t.district, lat: t.lat, lng: t.lng, distanceKm: d, icon: cfg.icon, color: cfg.color };
      })
      .filter(Boolean)
      .filter((item) => item.distanceKm <= 25)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  }, [locationInfo?.lat, locationInfo?.lng, temples]);

  const nearbyTouristPlaces = useMemo(() => {
    if (!locationInfo || touristPlaces.length === 0) return [];
    return touristPlaces
      .map((t: any) => {
        if (t.lat == null || t.lng == null) return null;
        const d = getDistanceKm(locationInfo.lat, locationInfo.lng, t.lat, t.lng);
        const cfg = getConfig(t.type || 'tourist');
        return { id: t.id || `tour-${t.name}`, name: t.name, category: 'Tourist Place', subcategory: t.type || t.district, lat: t.lat, lng: t.lng, distanceKm: d, icon: cfg.icon, color: cfg.color };
      })
      .filter(Boolean)
      .filter((item) => item.distanceKm <= 25)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  }, [locationInfo?.lat, locationInfo?.lng, touristPlaces]);
  // Top nearest highways - the same engine as the single nearest lookup,
  // ranked across every national highway so the tab can list more roads.
  const nearbyHighways = useMemo(() => {
    if (!locationInfo) return [];
    return findNearestHighwaysFromCoords(locationInfo.lat, locationInfo.lng, 5);
  }, [locationInfo?.lat, locationInfo?.lng]);


  const nearbyLandmarks = useMemo(() => {
    if (!locationInfo) return [];

    const items: NearbyItem[] = [];

    const addItem = (id: string, name: string, category: string, subcategory: string | undefined, lat: number, lng: number, icon: React.ComponentType<{ className?: string }>, color: string) => {
      const d = getDistanceKm(locationInfo.lat, locationInfo.lng, lat, lng);
      items.push({ id, name, category, subcategory, lat, lng, distanceKm: d, icon, color });
    };

    pois.forEach((p: any) => {
      if (p.lat != null && p.lng != null) {
        const cfg = getConfig(p.category || 'poi');
        addItem(p.id || `poi-${p.name}`, p.name, cfg.label, p.locationName || p.highwayCode || p.district, p.lat, p.lng, cfg.icon, cfg.color);
      }
    });

    landmarks.forEach((l: any) => {
      if (l.lat != null && l.lng != null) {
        const cat = l.categoryLabel || l.category || 'landmark';
        const cfg = getConfig(cat.toLowerCase());
        addItem(l.id || `lm-${l.name}`, l.name, cat, l.district || l.fromId, l.lat, l.lng, cfg.icon, cfg.color);
      }
    });

    const nearby = items.filter(item => item.distanceKm <= 25);
    const bestPerCategory: Record<string, NearbyItem> = {};
    for (const item of nearby) {
      const cat = item.category;
      if (!bestPerCategory[cat] || item.distanceKm < bestPerCategory[cat].distanceKm) {
        bestPerCategory[cat] = item;
      }
    }

    return Object.values(bestPerCategory).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [locationInfo, pois, landmarks]);

  const nearestTouristPlace = useMemo(() => {
    if (!locationInfo || touristPlaces.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const p of touristPlaces) {
      if (p.lat && p.lng) {
        const d = getDistanceKm(locationInfo.lat, locationInfo.lng, p.lat, p.lng);
        if (d < minDist) {
          minDist = d;
          nearest = { place: p, distanceKm: d };
        }
      }
    }
    return nearest;
  }, [locationInfo?.lat, locationInfo?.lng, touristPlaces]);

  const nearbyIncidents = useMemo(() => {
    if (!locationInfo || incidents.length === 0) return [];
    return incidents.filter(inc => {
      if (!inc.lat || !inc.lng) return false;
      return getDistanceKm(locationInfo.lat, locationInfo.lng, inc.lat, inc.lng) <= 5.0;
    });
  }, [locationInfo?.lat, locationInfo?.lng, incidents]);

  const nearbyEmergency = useMemo(() => {
    if (!locationInfo) return [];
    const items: NearbyItem[] = [];
    const addItem = (id: string, name: string, category: string, subcategory: string | undefined, lat: number, lng: number, icon: React.ComponentType<{ className?: string }>, color: string) => {
      const d = getDistanceKm(locationInfo.lat, locationInfo.lng, lat, lng);
      items.push({ id, name, category, subcategory, lat, lng, distanceKm: d, icon, color });
    };
    airports.forEach((a: any) => {
      if (a.lat != null && a.lng != null && a.type === 'helipad') {
        addItem(a.code || `helipad-${a.name}`, a.name, 'Emergency', a.district, a.lat, a.lng, Shield, 'text-red-400');
      }
    });
    pois.forEach((p: any) => {
      if (p.lat != null && p.lng != null && p.category?.toLowerCase() === 'emergency_dor') {
        const cfg = getConfig('emergency_dor');
        addItem(p.id || `dor-${p.name}`, p.name, 'Emergency DOR', p.locationName || p.district, p.lat, p.lng, cfg.icon, cfg.color);
      }
    });
    landmarks.forEach((l: any) => {
      if (l.lat != null && l.lng != null && (l.categoryLabel?.toLowerCase() === 'emergency' || l.category?.toLowerCase() === 'emergency_dor')) {
        const cfg = getConfig(l.categoryLabel?.toLowerCase() || 'emergency_dor');
        addItem(l.id || `em-${l.name}`, l.name, 'Emergency', l.district || l.fromId, l.lat, l.lng, cfg.icon, cfg.color);
      }
    });
    touristPlaces.forEach((t: any) => {
      if (t.lat != null && t.lng != null && t.tags && t.tags.includes('emergency')) {
        addItem(t.id || `tour-em-${t.name}`, t.name, 'Emergency', t.district, t.lat, t.lng, Heart, 'text-rose-400');
      }
    });
    const nearby = items.filter(item => item.distanceKm <= 50);
    return nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [locationInfo, airports, pois, landmarks, touristPlaces]);

  // The address line, composed exactly like the Route Planner's "My Location"
  // card: street-level area, then municipality, then district (or province
  // when OSM gives no district), never the same part twice. Falls back to
  // the raw OSM address while the structured fields resolve.
  const addressLabel = useMemo(() => {
    if (!locationInfo) return null;
    const placeParts = [locationInfo.localArea, locationInfo.municipality].filter(
      (p): p is string => !!p,
    );
    const place = [...new Set(placeParts)].join(', ');
    if (!place) return locationInfo.formattedAddress || locationInfo.address || null;
    const region = locationInfo.district && !placeParts.includes(locationInfo.district)
      ? locationInfo.district
      : (!locationInfo.district && locationInfo.province) || null;
    return region ? `${place} · ${region}` : place;
  }, [locationInfo]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'weather', label: 'Weather', icon: <CloudSun className="w-3.5 h-3.5" /> },
  ];
  if (nearbyIncidents.length > 0) {
    tabs.push({ id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />, count: nearbyIncidents.length });
  }
  tabs.push({ id: 'emergency', label: 'Emergency', icon: <Phone className="w-3.5 h-3.5 text-red-400" />, count: nearbyEmergency.length });
  if (nearbyAirports.length > 0) {
    tabs.push({ id: 'airport', label: 'Airport', icon: <Plane className="w-3.5 h-3.5 text-sky-400" />, count: nearbyAirports.length });
  }
  if (nearbyBusStations.length > 0) {
    tabs.push({ id: 'bus_station', label: 'Bus Station', icon: <Bus className="w-3.5 h-3.5 text-amber-400" />, count: nearbyBusStations.length });
  }
  if (nearbyTemples.length > 0) {
    tabs.push({ id: 'temple', label: 'Temple', icon: <Landmark className="w-3.5 h-3.5 text-amber-400" />, count: nearbyTemples.length });
  }
  if (nearbyTouristPlaces.length > 0 || nearestTouristPlace) {
    tabs.push({ id: 'tourist_place', label: 'Tourist Place', icon: <Camera className="w-3.5 h-3.5 text-fuchsia-400" />, count: nearbyTouristPlaces.length > 0 ? nearbyTouristPlaces.length : undefined });
  }
  if (nearbyLandmarks.length > 0) {
    tabs.push({ id: 'landmarks', label: 'Landmarks', icon: <MapPin className="w-3.5 h-3.5 text-purple-400" />, count: nearbyLandmarks.length });
  }
  if (nearbyHighways.length > 0) {
    tabs.push({ id: 'highway', label: 'Nearest Highway', icon: <Route className="w-3.5 h-3.5 text-cyan-400" /> });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Page Header - matching Distance Calculator style */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="w-full max-w-7xl mx-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition touch-target shrink-0"
            title="Back to Main App"
            aria-label="Back to main app"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shrink-0">
              <LocateFixed className="w-5 h-5 accent-text" />
            </div>
            <div>
              <h1 className="text-sm font-semibold accent-text tracking-wider">
                Mero Sadak
              </h1>
              <p className="text-lg sm:text-xl font-black tracking-tight text-white font-display leading-tight">
                My Location
              </p>
            </div>
          </div>            {/* Place alerts bell — notifications filtered to the current place.
                Opens a popover listing the road incidents reported within 5 km
                of this fix; when there are none it says so instead. */}
            <div className="relative flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={() => setIsBellOpen(!isBellOpen)}
                className={`p-2 rounded-xl transition relative touch-target border ${
                  isBellOpen || nearbyIncidents.length > 0
                    ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-rose-500/30'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border-slate-700/80'
                }`}
                title="Alerts near your current place"
                aria-label="Alerts near your current place"
                aria-expanded={isBellOpen}
                aria-controls="my-location-alerts-popover"
              >
                <Bell className="w-5 h-5" />
                {nearbyIncidents.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>

              {isBellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBellOpen(false)} />
                  <div
                    id="my-location-alerts-popover"
                    className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-950/98 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-fadeIn"
                  >
                    <div className="p-3.5 border-b border-slate-800 bg-slate-900/80">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                          <Bell className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">Alerts for This Place</h4>
                          <p className="text-[10px] text-slate-400 truncate">{addressLabel || 'Your current place'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {nearbyIncidents.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          <BellOff className="w-6 h-6 mx-auto mb-1.5 text-slate-500 opacity-80" />
                          <p className="font-semibold text-slate-300">No notifications found</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            No road alerts reported within 5 km of your current place.
                          </p>
                        </div>
                      ) : (
                        nearbyIncidents.map((inc: any) => {
                          const dKm = locationInfo && inc.lat && inc.lng
                            ? getDistanceKm(locationInfo.lat, locationInfo.lng, inc.lat, inc.lng)
                            : null;
                          return (
                            <div key={inc.id} className={`p-2.5 rounded-xl border bg-slate-900/80 ${
                              inc.severity === 'severe' || inc.severity === 'critical'
                                ? 'border-rose-900/60'
                                : inc.severity === 'moderate' || inc.severity === 'high'
                                ? 'border-amber-900/60'
                                : 'border-slate-800'
                            }`}>
                              <div className="flex items-center space-x-1.5 flex-wrap mb-0.5">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  inc.severity === 'severe' || inc.severity === 'critical'
                                    ? 'bg-rose-500 text-white'
                                    : inc.severity === 'moderate' || inc.severity === 'high'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-sky-500 text-slate-950'
                                }`}>
                                  {inc.type}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-amber-300">{inc.highwayCode}</span>
                                {dKm !== null && (
                                  <span className="text-[10px] font-bold text-cyan-300">{dKm.toFixed(1)} km away</span>
                                )}
                              </div>
                              {inc.title && (
                                <p className="text-[11px] font-bold text-white line-clamp-1">{inc.title}</p>
                              )}
                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{inc.description}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-2.5 border-t border-slate-800 bg-slate-900/60">
                      <button
                        onClick={() => {
                          setActiveTab('emergency');
                          setIsBellOpen(false);
                        }}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                      >
                        <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          {nearbyEmergency.length > 0
                            ? `${nearbyEmergency.length} emergency facility/facilities within 50 km`
                            : 'No emergency facilities within 50 km'}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4 card-scroll">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Detecting your location...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-rose-400">
            <MapPin className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium text-center px-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 transition"
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {locationInfo && !loading && !error && (
          <div className="space-y-4">
            {/* Safety Warning & Emergency Alert */}
             {nearbyIncidents.length > 0 && (
               <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-2xl flex items-start space-x-3">
                 <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold">Safety Warning</h4>
                   <p className="text-xs mt-1">{nearbyIncidents.length} incident(s) reported near your location.</p>
                 </div>
               </div>
             )}

             {nearbyEmergency.length > 0 && nearbyIncidents.length === 0 && (
               <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-2xl flex items-start space-x-3">
                 <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold">Emergency Info Available</h4>
                   <p className="text-xs mt-1">{nearbyEmergency.length} emergency facility/facilities within 50 km. Open the Emergency tab for details.</p>
                 </div>
               </div>
             )}

                            {/* Location identity card, mirroring the Route Planner's "My
                  Location" card: same style, same information (address line,
                  live GPS fix + accuracy, nearest junction, nearest highway). */}
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1 rounded-2xl px-3 py-2.5 border bg-slate-950/60 border-slate-800 shadow-inner">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">My Location</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {addressLabel || 'Detecting address...'}
                      </div>
                      <div className="text-[10px] text-emerald-400/80 font-mono truncate mt-0.5">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${watching ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {watching ? 'LIVE GPS' : 'GPS FIX'}{' '}
                        {locationInfo.lat.toFixed(5)}, {locationInfo.lng.toFixed(5)}
                        {accuracyLabel && <span className="text-slate-500"> · {accuracyLabel}</span>}
                        {locationInfo.nearestJunction.city?.name && (
                          <span className="text-slate-500"> · {locationInfo.nearestJunction.distanceKm?.toFixed(1)} km to {locationInfo.nearestJunction.city.name}</span>
                        )}
                      </div>
                      {locationInfo.nearestHighway?.highway?.code && (
                        <div className="text-[10px] text-cyan-400 font-medium truncate mt-0.5">
                          {locationInfo.nearestHighway.highway.code} ({locationInfo.nearestHighway.highway.name}) · {locationInfo.nearestHighway.distanceKm?.toFixed(1)} km away
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation - small buttons */}
            <nav className="flex flex-wrap gap-2" aria-label="Location information tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === tab.id
                      ? 'bg-slate-800/80 text-white border border-slate-700 shadow-lg'
                      : 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="bg-slate-700 text-slate-300 px-1.5 py-0.25 rounded-full text-[9px] font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>


              {activeTab === 'weather' && (
                weather ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center space-x-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getWeatherIconBg(weather.current.weather_code)}`}>
                          {getWeatherIcon(weather.current.weather_code)}
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Temp</p>
                          <p className="text-lg font-black text-white">{Math.round(weather.current.temperature_2m)}°C</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div className={`w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center ${
                          weather.current.precipitation > 10 ? 'bg-rose-500/30' :
                          weather.current.precipitation > 2.5 ? 'bg-orange-500/20' :
                          weather.current.precipitation > 0.1 ? 'bg-emerald-500/20' :
                          'bg-slate-500/20'
                        }`}>
                          <CloudRain className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                            {weather.current.precipitation > 10 ? 'Heavy Rain' :
                             weather.current.precipitation > 2.5 ? 'Moderate Rain' :
                             weather.current.precipitation > 0.1 ? 'Light Rain' :
                             'No Precipitation'}
                          </p>
                          <p className={`text-lg font-black ${
                            weather.current.precipitation > 10 ? 'text-rose-400' :
                            weather.current.precipitation > 2.5 ? 'text-orange-400' :
                            'text-white'
                          }`}>
                            {weather.current.precipitation.toFixed(1)} mm/hr
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <Droplets className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Humidity</p>
                          <p className="text-lg font-black text-white">{weather.current.relative_humidity_2m}%</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Wind className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Wind</p>
                          <p className="text-lg font-black text-white">{Math.round(weather.current.wind_speed_10m)} km/h</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                      <div className="text-center p-2 bg-slate-950/60 rounded-lg">
                        <p className="text-[9px] text-slate-500">Visibility</p>
                        <p className="text-sm font-bold text-white">{weather.current.visibility ? (weather.current.visibility / 1000).toFixed(1) : '—'} km</p>
                      </div>
                      <div className="text-center p-2 bg-slate-950/60 rounded-lg">
                        <p className="text-[9px] text-slate-500">Clouds</p>
                        <p className="text-sm font-bold text-white">{weather.current.cloud_cover}%</p>
                      </div>
                      <div className="text-center p-2 bg-slate-950/60 rounded-lg">
                        <p className="text-[9px] text-slate-500">Today High</p>
                        <p className="text-sm font-bold text-rose-400">{weather.daily?.temperature_2m_max?.[0] ? Math.round(weather.daily.temperature_2m_max[0]) : '—'}°C</p>
                      </div>
                      <div className="text-center p-2 bg-slate-950/60 rounded-lg">
                        <p className="text-[9px] text-slate-500">Rain Risk</p>
                        <p className="text-sm font-bold text-emerald-400">{weather.daily?.precipitation_probability_max?.[0] ? weather.daily.precipitation_probability_max[0] : '—'}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                        <Cloud className="w-2.5 h-2.5" />
                        <span>Data: Open-Meteo (ECMWF)</span>
                      </div>
                      {weather?.current?.precipitation > 2.5 && (
                        <p className="text-[9px] text-rose-500 font-medium">⚠ Road conditions may be impacted</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <p className="text-sm">Weather unavailable: {weatherError}</p>
                  </div>
                )
              )}

              {activeTab === 'incidents' && nearbyIncidents.length > 0 && (
                <div className="space-y-2">
                  {nearbyIncidents.map((inc: any) => (
                    <div key={inc.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          inc.severity === 'critical' ? 'bg-rose-500 text-white' :
                          inc.severity === 'high' ? 'bg-amber-500 text-slate-950' :
                          'bg-sky-500 text-slate-950'
                        }`}>
                          {inc.type}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">{inc.highwayCode}</span>
                      </div>
                      <p className="text-[10px] text-slate-300">{inc.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tourist_place' && nearbyTouristPlaces.length === 0 && nearestTouristPlace && (
                <div className="flex items-center space-x-3 bg-slate-950 p-4 rounded-2xl">
                  <Camera className="w-5 h-5 text-fuchsia-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white line-clamp-1">
                      {nearestTouristPlace.place.name}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                      {nearestTouristPlace.place.type} • {nearestTouristPlace.place.location || nearestTouristPlace.place.district}
                    </p>
                  </div>
                  <div className="ml-auto text-right pl-2 border-l border-slate-800 shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase">Distance</p>
                    <p className="text-sm font-bold text-fuchsia-300">
                      {nearestTouristPlace.distanceKm.toFixed(2)} km
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'airport' && nearbyAirports.length > 0 && (
                <div className="space-y-2">
                  {nearbyAirports.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white">
                            {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'bus_station' && nearbyBusStations.length > 0 && (
                <div className="space-y-2">
                  {nearbyBusStations.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white">
                            {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'temple' && nearbyTemples.length > 0 && (
                <div className="space-y-2">
                  {nearbyTemples.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white">
                            {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'tourist_place' && nearbyTouristPlaces.length > 0 && (
                <div className="space-y-2">
                  {nearbyTouristPlaces.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white">
                            {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'landmarks' && nearbyLandmarks.length > 0 && (
                <div className="space-y-2">
                  {(showAllNearby ? nearbyLandmarks : nearbyLandmarks.slice(0, 5)).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white">
                            {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {nearbyLandmarks.length > 5 && !showAllNearby && (
                    <button
                      onClick={() => setShowAllNearby(true)}
                      className="w-full py-2 text-xs text-sky-400 hover:text-sky-300 font-medium"
                    >
                      Show all {nearbyLandmarks.length}
                    </button>
                  )}
                </div>
              )}

                            {activeTab === 'highway' && nearbyHighways.length > 0 && (
                <div className="space-y-2">
                  {nearbyHighways.map((h) => (
                    <div key={h.highway.id} className="flex items-center space-x-3 bg-slate-950 p-4 rounded-2xl">
                      <Route className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white line-clamp-1">
                          {h.highway.code} - {h.highway.name}
                        </p>
                        {h.segment && (
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {h.segment.from} → {h.segment.to}
                          </p>
                        )}
                      </div>
                      <div className="ml-auto text-right pl-2 border-l border-slate-800 shrink-0">
                        <p className="text-[10px] text-slate-500 uppercase">Distance</p>
                        <p className="text-sm font-bold text-cyan-300">
                          {h.distanceKm.toFixed(1)} km
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'emergency' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-red-400" />
                      Emergency Contacts & Locations
                    </h3>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {nearbyEmergency.length} nearby
                    </div>
                  </div>

                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                     <div className="touch-target flex flex-col items-center justify-center p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                       <Phone className="w-5 h-5 text-rose-400 mb-1" />
                       <p className="text-[9px] text-slate-500 uppercase">Police</p>
                       <p className="text-lg font-black text-white">100</p>
                     </div>
                     <div className="touch-target flex flex-col items-center justify-center p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                       <Phone className="w-5 h-5 text-amber-400 mb-1" />
                       <p className="text-[9px] text-slate-500 uppercase">Ambulance</p>
                       <p className="text-lg font-black text-white">104</p>
                     </div>
                     <div className="touch-target flex flex-col items-center justify-center p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                       <Phone className="w-5 h-5 text-sky-400 mb-1" />
                       <p className="text-[9px] text-slate-500 uppercase">Fire</p>
                       <p className="text-lg font-black text-white">103</p>
                     </div>
                     <div className="touch-target flex flex-col items-center justify-center p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                       <Phone className="w-5 h-5 text-emerald-400 mb-1" />
                       <p className="text-[9px] text-slate-500 uppercase">Tourist</p>
                       <p className="text-lg font-black text-white">1111</p>
                     </div>
                   </div>

                  {nearbyEmergency.length > 0 ? (
                    nearbyEmergency.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl">
                          <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-rose-300">
                              {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(2)} km`}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No emergency facilities found within 50 km</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'incidents' && !nearbyIncidents.length && (
                <div className="text-center py-6 text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No incidents reported near your location</p>
                </div>
              )}
            </div>
          )}
      </main>
    </div>
  );
};
