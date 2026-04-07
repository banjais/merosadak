import { useState, useEffect, useRef } from 'react';

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  loading: boolean;
  error: string | null;
}

// Nepal center fallback
const FALLBACK = { lat: 28.3949, lng: 84.1240 };

// Minimum distance (km) before triggering an update to avoid excessive API calls
const MIN_DISTANCE_KM = 0.5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation(): GeoPosition {
  const [position, setPosition] = useState<GeoPosition>({
    ...FALLBACK,
    accuracy: 0,
    loading: true,
    error: null,
  });

  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPosition({ ...FALLBACK, accuracy: 0, loading: false, error: 'Geolocation not supported' });
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      const prev = prevPosRef.current;

      // Only update state if moved more than MIN_DISTANCE_KM or first fix
      if (!prev || haversineKm(prev.lat, prev.lng, newLat, newLng) >= MIN_DISTANCE_KM) {
        prevPosRef.current = { lat: newLat, lng: newLng };
        setPosition({
          lat: newLat,
          lng: newLng,
          accuracy: pos.coords.accuracy,
          loading: false,
          error: null,
        });
      }
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn('[useGeolocation]', err.message);
      setPosition((prev) => ({ ...prev, loading: false, error: err.message }));
    };

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return position;
}
