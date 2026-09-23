import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Route, Building, Mountain, LocateFixed, RotateCcw,
  AlertTriangle, Camera, MapPin, Plane, Bus, Fuel, Zap, Heart,
  UtensilsCrossed, Compass, Shield, Landmark, Info, CloudSun, CloudRain,
  CloudSnow, Wind, Droplets, Thermometer, Sun, Cloud,
} from 'lucide-react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findNearestHighwayFromCoords, findNearestHighwayJunction, getDistanceKm } from '../utils/geoUtils';
import { CityNode } from '../types';

interface MyLocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
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
}

interface NearbyItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  lat: number;
  lng: number;
  distanceKm: number;
  icon: React.ElementType;
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

function formatDMS(lat: number, lng: number): string {
  const convert = (coord: number, isLat: boolean) => {
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    const direction = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };
  return `${convert(lat, true)} ${convert(lng, false)}`;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
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

function getConfig(category: string): { icon: React.ElementType; color: string; label: string } {
  return CATEGORY_CONFIG[category?.toLowerCase()] || DEFAULT_CONFIG;
}

function getWeatherIcon(code: number): React.ReactElement {
  if (code === 0) return <Sun className="w-5 h-5" />;
  if (code <= 3) return <Cloud className="w-5 h-5" />;
  if (code === 45 || code === 48) return <Cloud className="w-5 h-5" />; // Fog
  if (code <= 55) return <CloudRain className="w-5 h-5" />; // Drizzle
  if (code <= 65) return <CloudRain className="w-5 h-5" />; // Rain
  if (code <= 67) return <CloudRain className="w-5 h-5" />; // Freezing rain
  if (code <= 75) return <CloudSnow className="w-5 h-5" />; // Snow
  if (code <= 82) return <CloudRain className="w-5 h-5" />; // Rain showers
  if (code >= 95) return <CloudRain className="w-5 h-5" />; // Thunderstorm
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

export const MyLocationPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [locationInfo, setLocationInfo] = useState<MyLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [touristPlaces, setTouristPlaces] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [airports, setAirports] = useState<any[]>([]);
  const [busStations, setBusStations] = useState<any[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const fetches = [
        fetch('/data/tourist-places.json').then(r => r.json()).then(setTouristPlaces).catch(() => []),
        fetch('/data/incidents.json').then(r => r.json()).then(setIncidents).catch(() => []),
        fetch('/data/airports.json').then(r => r.json()).then(setAirports).catch(() => []),
        fetch('/data/bus-stations.json').then(r => r.json()).then(setBusStations).catch(() => []),
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
          setWeather({ ...data, elevation: locationInfo.lat });
          setWeatherError(null);
        }
      } catch (err) {
        if (!cancelled) setWeatherError((err as Error).message);
      }
    };
    fetchWeather();
    return () => { cancelled = true; };
  }, [locationInfo?.lat, locationInfo?.lng]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

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

        let address = null;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' }
          });
          if (res.ok) {
            const data = await res.json();
            address = data.display_name;
          }
        } catch (e) {
          console.error("Failed to fetch address", e);
        }

        setLocationInfo((prev) => ({
          lat,
          lng,
          accuracy,
          address: address || prev?.address || null,
          nearestHighway,
          nearestJunction: junctionInfo,
        }));
        setLoading(false);
      },
      (err) => {
        setError('Failed to detect location. Please allow GPS permission and try again.');
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const metersToKm = (m: number | null) => {
    if (m === null) return '—';
    if (m < 100) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  };

  const nearbyLandmarks = React.useMemo(() => {
    if (!locationInfo) return [];

    const items: NearbyItem[] = [];

    const addItem = (id: string, name: string, category: string, subcategory: string | undefined, lat: number, lng: number, icon: React.ElementType, color: string) => {
      const d = getDistanceKm(locationInfo.lat, locationInfo.lng, lat, lng);
      items.push({ id, name, category, subcategory, lat, lng, distanceKm: d, icon, color });
    };

    airports.forEach((a: any) => {
      if (a.lat != null && a.lng != null) {
        const cfg = getConfig('airport');
        addItem(a.code || `air-${a.name}`, a.name, 'Airport', a.type || a.district, a.lat, a.lng, cfg.icon, cfg.color);
      }
    });

    busStations.forEach((b: any) => {
      if (b.lat != null && b.lng != null) {
        const cfg = getConfig('bus_station');
        addItem(b.id || `bus-${b.name}`, b.name, 'Bus Station', b.location || b.district, b.lat, b.lng, cfg.icon, cfg.color);
      }
    });

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

    touristPlaces.forEach((t: any) => {
      if (t.lat != null && t.lng != null) {
        const cfg = getConfig(t.type || 'tourist');
        addItem(t.id || `tour-${t.name}`, t.name, 'Tourist Place', t.type || t.district, t.lat, t.lng, cfg.icon, cfg.color);
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
  }, [locationInfo, airports, busStations, pois, landmarks, touristPlaces]);

  const nearestTouristPlace = React.useMemo(() => {
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

  const nearbyIncidents = React.useMemo(() => {
    if (!locationInfo || incidents.length === 0) return [];
    return incidents.filter(inc => {
      if (!inc.lat || !inc.lng) return false;
      return getDistanceKm(locationInfo.lat, locationInfo.lng, inc.lat, inc.lng) <= 5.0;
    });
  }, [locationInfo?.lat, locationInfo?.lng, incidents]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-3 sm:px-5 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition"
              title="Back"
              type="button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl accent-bg flex items-center justify-center">
                <LocateFixed className="w-5 h-5 accent-text" />
              </div>
              <div>
                <h1 className="text-base font-black text-white font-display tracking-tight">My Location</h1>
                <p className="text-[9px] accent-text font-semibold uppercase tracking-wider">GPS &amp; Road Info</p>
              </div>
            </div>
          </div>
          <div className="w-8 h-8 flex items-center justify-center">
            {loading && <RotateCcw className="w-4 h-4 text-emerald-400 animate-spin" />}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-5 shadow-2xl space-y-5">

            {nearbyIncidents.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-2xl flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">Safety Warning</h4>
                  <p className="text-xs mt-1">{nearbyIncidents.length} incident(s) reported near your location.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 pr-4">
                  <h2 className="text-2xl font-black text-white leading-tight">
                    {locationInfo.address || "Detecting address..."}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400 mt-2">
                    <span className="bg-emerald-500/10 px-2 py-1 rounded-lg">
                      {formatDMS(locationInfo.lat, locationInfo.lng)}
                    </span>
                    {locationInfo.accuracy && (
                      <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">
                        ± {Math.round(locationInfo.accuracy)}m
                      </span>
                    )}
                    {locationInfo.nearestJunction.city && (
                      <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded-lg flex items-center space-x-1">
                        <Mountain className="w-3 h-3" />
                        <span>{locationInfo.nearestJunction.city.elevationM}m ASL</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <LocateFixed className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Region &amp; Admin</h3>
              {locationInfo.nearestJunction.city ? (
                <div className="flex items-center space-x-3 bg-slate-950 p-4 rounded-2xl">
                  <Building className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{locationInfo.nearestJunction.city.name}</p>
                      <span className="bg-slate-800 text-slate-400 text-[9px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                        {locationInfo.nearestJunction.city.elevationM}m ASL
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {locationInfo.nearestJunction.city.district} Dist • {locationInfo.nearestJunction.city.province} Prov
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No region data available.</p>
              )}
            </div>

            {/* Weather Section */}
            {weather && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Weather</h3>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getWeatherIconBg(weather.current.weather_code)}`}>
                        {getWeatherIcon(weather.current.weather_code)}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Temp</p>
                        <p className="text-xl font-black text-white">{Math.round(weather.current.temperature_2m)}°C</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Rain</p>
                        <p className="text-xl font-black text-emerald-400">{weather.current.precipitation.toFixed(1)} mm/hr</p>
                        <p className="text-[9px] text-slate-500">{weather.current.precipitation > 0 ? 'Active rain' : 'No rain'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                      <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Humidity</p>
                        <p className="text-xl font-black text-white">{weather.current.relative_humidity_2m}%</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Wind className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Wind</p>
                        <p className="text-xl font-black text-white">{Math.round(weather.current.wind_speed_10m)} km/h</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
                    <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-[10px] text-slate-500">Visibility</p>
                      <p className="text-sm font-bold text-white">{weather.current.visibility ? (weather.current.visibility / 1000).toFixed(1) : '—'} km</p>
                    </div>
                    <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-[10px] text-slate-500">Cloud Cover</p>
                      <p className="text-sm font-bold text-white">{weather.current.cloud_cover}%</p>
                    </div>
                    <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-[10px] text-slate-500">Today High</p>
                      <p className="text-sm font-bold text-rose-400">{weather.daily?.temperature_2m_max?.[0] ? Math.round(weather.daily.temperature_2m_max[0]) : '—'}°C</p>
                    </div>
                    <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-[10px] text-slate-500">Rain Risk</p>
                      <p className="text-sm font-bold text-emerald-400">{weather.daily?.precipitation_probability_max?.[0] ? weather.daily.precipitation_probability_max[0] : '—'}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {weatherError && !weather && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Weather</h3>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-700/50 text-center">
                  <p className="text-slate-500 text-sm">Weather unavailable: {weatherError}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nearest Highway</h3>
              {locationInfo.nearestHighway && locationInfo.nearestHighway.highway?.code ? (
                <div className="flex items-center space-x-3 bg-slate-950 p-4 rounded-2xl">
                  <Route className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white line-clamp-1">
                      {locationInfo.nearestHighway.highway.code} - {locationInfo.nearestHighway.highway.name}
                    </p>
                    {locationInfo.nearestHighway.segment && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {locationInfo.nearestHighway.segment.from} → {locationInfo.nearestHighway.segment.to}
                      </p>
                    )}
                  </div>
                  <div className="ml-auto text-right pl-2 border-l border-slate-800 shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase">Distance</p>
                    <p className="text-sm font-bold text-cyan-300">
                      {metersToKm(locationInfo.nearestHighway.distanceKm !== null ? (locationInfo.nearestHighway.distanceKm ?? 0) * 1000 : null)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No highway data available.</p>
              )}
            </div>

            {nearbyLandmarks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nearby Landmarks</h3>
                <div className="space-y-2">
                  {nearbyLandmarks.map((item) => {
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
              </div>
            )}

            {nearestTouristPlace && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nearest Tourist Place</h3>
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
