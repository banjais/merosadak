import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Navigation, Route, Building, Mountain, X, LocateFixed, RotateCcw, AlertTriangle, Camera } from 'lucide-react';
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

export const MyLocationPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [locationInfo, setLocationInfo] = useState<MyLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [touristPlaces, setTouristPlaces] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/data/tourist-places.json').then(r => r.json()).then(setTouristPlaces).catch(console.error);
    fetch('/data/incidents.json').then(r => r.json()).then(setIncidents).catch(console.error);
  }, []);

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
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-5 shadow-2xl space-y-6">
            
            {/* Header: Address and GPS */}
            <div className="space-y-2">
              {nearbyIncidents.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-2xl flex items-start space-x-3 mb-4">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">Safety Warning</h4>
                    <p className="text-xs mt-1">{nearbyIncidents.length} incident(s) reported near your location.</p>
                  </div>
                </div>
              )}

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

            {/* Administrative Context */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Region & Admin</h3>
              {locationInfo.nearestJunction.city ? (
                <div className="flex items-center space-x-3 bg-slate-950 p-4 rounded-2xl">
                  <Building className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">{locationInfo.nearestJunction.city.name}</p>
                    <p className="text-xs text-slate-400">
                      {locationInfo.nearestJunction.city.district} Dist • {locationInfo.nearestJunction.city.province} Prov
                    </p>
                  </div>
                  <div className="ml-auto text-right pl-2 border-l border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Distance</p>
                    <p className="text-sm font-bold text-amber-300">
                      {locationInfo.nearestJunction.distanceKm !== null ? `${locationInfo.nearestJunction.distanceKm.toFixed(2)} km` : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No region data available.</p>
              )}
            </div>

            {/* Road Context */}
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

            {/* Tourist Place Context */}
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
