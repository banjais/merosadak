import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Navigation, Route, Building, Mountain, X, LocateFixed, RotateCcw } from 'lucide-react';
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
}

function detectGPSPosition(): Promise<MyLocationInfo> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: 0, lng: 0, accuracy: null, nearestHighway: null, nearestJunction: { city: null, distanceKm: null } });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
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

        resolve({
          lat,
          lng,
          accuracy,
          nearestHighway,
          nearestJunction: junctionInfo,
        });
      },
      () => {
        resolve({ lat: 0, lng: 0, accuracy: null, nearestHighway: null, nearestJunction: { city: null, distanceKm: null } });
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
    );
  });
}

export const MyLocationPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [locationInfo, setLocationInfo] = useState<MyLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await detectGPSPosition();
      if (info.lat === 0 && info.lng === 0) {
        setError('Could not detect your location. Please allow GPS permission and try again.');
      } else {
        setLocationInfo(info);
      }
    } catch (err) {
      setError('Failed to detect location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const metersToKm = (m: number | null) => {
    if (m === null) return '—';
    if (m < 100) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-5 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition"
              title="Back"
              type="button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <LocateFixed className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-base font-black text-white font-display tracking-tight">My Location</h1>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">GPS &amp; Road Info</p>
              </div>
            </div>
          </div>
          <button
            onClick={loadLocation}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Refresh location"
            type="button"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
              onClick={loadLocation}
              className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 transition"
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {locationInfo && !loading && !error && (
          <>
            {/* GPS Coordinates */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <LocateFixed className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Current Location</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Latitude</p>
                  <p className="text-sm font-mono text-emerald-300">{locationInfo.lat.toFixed(6)}</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Longitude</p>
                  <p className="text-sm font-mono text-emerald-300">{locationInfo.lng.toFixed(6)}</p>
                </div>
                {locationInfo.accuracy && (
                  <div className="bg-slate-950 rounded-xl p-3 col-span-2 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Accuracy</p>
                    <p className="text-sm font-mono text-slate-300">± {Math.round(locationInfo.accuracy)} m</p>
                  </div>
                )}
              </div>
            </div>

            {/* Nearest Highway */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <Route className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Nearest Highway</h2>
              </div>
              {locationInfo.nearestHighway && locationInfo.nearestHighway.highway?.code ? (
                <div className="space-y-2">
                  <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Highway</p>
                    <p className="text-sm font-bold text-white">{locationInfo.nearestHighway.highway.code}</p>
                    <p className="text-xs text-slate-400">{locationInfo.nearestHighway.highway.name}</p>
                  </div>
                  {locationInfo.nearestHighway.segment && (
                    <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Segment</p>
                      <p className="text-sm text-slate-300">{locationInfo.nearestHighway.segment.from} → {locationInfo.nearestHighway.segment.to}</p>
                    </div>
                  )}
                  <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Distance from Highway</p>
                    <p className="text-sm font-bold text-cyan-300">{metersToKm(locationInfo.nearestHighway.distanceKm !== null ? (locationInfo.nearestHighway.distanceKm ?? 0) * 1000 : null)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No highway data available for your location.</p>
              )}
            </div>

            {/* Nearest City / Junction */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">Nearest City / Junction</h2>
              </div>
              {locationInfo.nearestJunction.city ? (
                <div className="space-y-2">
                  <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">City / Junction</p>
                    <p className="text-sm font-bold text-white">{locationInfo.nearestJunction.city.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {locationInfo.nearestJunction.city.district} District • {locationInfo.nearestJunction.city.province} Province
                    </p>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Distance</p>
                    <p className="text-sm font-bold text-amber-300">
                      {locationInfo.nearestJunction.distanceKm !== null ? `${locationInfo.nearestJunction.distanceKm.toFixed(2)} km` : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No nearby city data available.</p>
              )}
            </div>

            {/* Elevation */}
            {locationInfo.nearestJunction.city && (
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Mountain className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-bold text-white">Elevation</h2>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Nearest Junction Elevation</p>
                  <p className="text-sm font-mono text-violet-300">{locationInfo.nearestJunction.city.elevationM} m ASL</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
