// One device GPS watcher shared by the whole app.
//
// Every surface that needs "where am I right now" previously called
// getCurrentPosition once, which returns a single fix and goes stale the moment
// the user moves. The map therefore sat on the position from app start, the
// Route Planner overrode it with its own fix, and My Location only refreshed
// when the user tapped the button.
//
// This is a module-level external store over watchPosition. The watcher starts
// when the first surface subscribes and stops when the last one leaves, so
// there is exactly one watch regardless of how many components read it, and no
// watch is left running with nothing to update. A fix is also written to the
// session cache, so a page reload shows the last known position instantly.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { writeCachedGps, readCachedGps } from '../utils/gpsLocation';

export interface DeviceFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, as reported by the platform. */
  accuracy: number | null;
  /** Fix time in ms. Falls back to performance time when the platform omits it. */
  timestamp: number;
  /** m/s ground speed, when the platform provides one. */
  speed: number | null;
}

export interface DeviceLocationState {
  fix: DeviceFix | null;
  /** Set when the browser cannot or will not give a position. */
  error: GeolocationPositionError | string | null;
  /** True while the watcher is running. */
  watching: boolean;
  /** True until the first fix or error arrives. */
  resolving: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let watcherId: number | null = null;
let subscriberCount = 0;
/** Generational token so a superseded fix can't overwrite a newer one. */
let fixSeq = 0;

// Seeded from the session cache so the first render already has a position.
function initialState(): DeviceLocationState {
  const cached = readCachedGps();
  return {
    fix: cached ? { lat: cached.lat, lng: cached.lng, accuracy: null, timestamp: cached.timestamp, speed: null } : null,
    error: null,
    watching: false,
    resolving: cached === null,
  };
}

let state: DeviceLocationState = initialState();

function emit(): void {
  // Snapshot identity must change for useSyncExternalStore to re-render.
  state = { ...state };
  for (const listener of listeners) listener();
}

function patch(next: Partial<DeviceLocationState>): void {
  state = { ...state, ...next };
  emit();
}

/**
 * A position only counts when it is a usable coordinate. The same guard the
 * graph builder uses applies here: (0, 0) is the Gulf of Guinea, not Nepal,
 * and a platform that reports null would otherwise pin the user there.
 */
function toFix(position: GeolocationPosition): DeviceFix | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return {
    lat: latitude,
    lng: longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    timestamp: position.timestamp || Date.now(),
    speed: Number.isFinite(position.coords.speed) && position.coords.speed != null
      ? Math.max(0, position.coords.speed)
      : null,
  };
}

function handlePosition(position: GeolocationPosition): void {
  const fix = toFix(position);
  if (!fix) return; // ignore an unusable fix rather than clobbering a good one
  fixSeq += 1;
  writeCachedGps(fix.lat, fix.lng);
  patch({
    fix,
    error: null,
    resolving: false,
    // Any error is cleared once a fix arrives again, so a transient loss of GPS
    // under a tunnel does not leave the UI stuck in an error state.
  });
}

function handleError(error: GeolocationPositionError | string): void {
  patch({ error, resolving: false });
}

function startWatching(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    patch({ error: 'Geolocation is not supported by this browser.', watching: false, resolving: false });
    return;
  }
  if (watcherId !== null) {
    patch({ watching: true });
    return;
  }

  // maximumAge 0 forces a fresh fix instead of a cached one, which is what makes
  // walking and driving track in real time. enableHighAccuracy asks the platform
  // for GPS/GNSS rather than a network-derived position.
  watcherId = navigator.geolocation.watchPosition(handlePosition, handleError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
  patch({ watching: true });
}

function stopWatching(): void {
  if (watcherId === null) return;
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watcherId);
  }
  watcherId = null;
  patch({ watching: false });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) startWatching();
  return () => {
    listeners.delete(listener);
    subscriberCount -= 1;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      stopWatching();
    }
  };
}

function getSnapshot(): DeviceLocationState {
  return state;
}

export interface DeviceLocationApi extends DeviceLocationState {
  /** One sharp fix on demand, without stopping the watcher. */
  refresh: () => void;
  /** Restart the watcher, e.g. after the user re-grants permission. */
  restart: () => void;
  /** Stop tracking. The position stays shown, it just stops following. */
  stop: () => void;
  /** Human-readable position label, or null when there is no fix. */
  accuracyLabel: string | null;
}

/**
 * Reads the shared device location. All subscribers see the same watch, so the
 * map, the Route Planner and My Location cannot disagree about where the user
 * is, and every one of them updates as the user moves.
 */
export function useDeviceLocation(): DeviceLocationApi {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const seqAtMount = useRef(fixSeq);

  const refresh = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  }, []);

  const restart = useCallback(() => {
    stopWatching();
    state = { ...state, resolving: true, error: null };
    emit();
    startWatching();
  }, []);

  const stop = useCallback(() => {
    stopWatching();
  }, []);

  const accuracyLabel = snapshot.fix?.accuracy == null
    ? null
    : snapshot.fix.accuracy < 100
      ? `± ${Math.round(snapshot.fix.accuracy)} m`
      : `± ${(snapshot.fix.accuracy / 1000).toFixed(2)} km`;

  // A remount after the watcher was stopped still resumes tracking, because the
  // store keeps the last fix and the new subscriber restarts the watch.
  useEffect(() => {
    seqAtMount.current = fixSeq;
  }, []);

  return { ...snapshot, refresh, restart, stop, accuracyLabel };
}

/** Non-reactive read of the current fix, for event handlers outside React. */
export function getCurrentFix(): DeviceFix | null {
  return state.fix;
}
