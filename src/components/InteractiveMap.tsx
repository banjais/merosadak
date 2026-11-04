import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Highway,
  CityNode,
  RoadIncident,
  RoutePlanResult,
  KnownBlackspot,
  SegmentSafetyData,
  RoadStatusType,
} from '../types';
import {
  analyzeHighwayRealtimeStatus,
  HighwayRealtimeStatusType,
} from '../utils/highwayStatusHelper';
import {
  NEPAL_HIGHWAYS,
} from '../data/nepalHighwaysData';
import { loadAll79Highways } from '../utils/nepalHighwayDataLoader';
import { useDeviceLocation, getCurrentFix } from '../hooks/useDeviceLocation';
import { readCachedGps, readLastKnownGps } from '../utils/gpsLocation';
import { getHighwayEnrichment } from '../utils/geoUtils';
import {
  CITY_HIGHWAY_TOUCH_DISTANCE_KM,
  filterCitiesNearHighways,
  getCachedExpandedCities,
  loadExpandedCities,
} from '../utils/cityDataLoader';
import { NEPAL_HIGHWAY_BLACKSPOTS } from '../data/accidentBlackspotsData';
import {
  Zap,
  AlertTriangle,
  Layers,
  Navigation,
  ShieldCheck,
  MapPin,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Activity,
  Eye,
  Compass,
  Box,
  Ticket,
  ShieldAlert,
  Mountain,
  Route,
  Repeat,
  Building,
  Info,
  X,
  Map as MapIcon,
  Globe,
  Locate,
  LocateFixed,
} from 'lucide-react';

interface InteractiveMapProps {
  activeRoute: RoutePlanResult | null;
  onSelectAlternativeRoute?: (route: RoutePlanResult) => void;
  onSelectCity?: (city: CityNode, type: 'origin' | 'destination') => void;
  onSelectHighway?: (highway: Highway) => void;
  onSelectBlackspot?: (blackspot: KnownBlackspot) => void;
  focusedTarget?: { lat: number; lng: number; title: string; zoom?: number } | null;
  colorMode?: 'safety' | 'preference';
  onToggleColorMode?: (mode: 'safety' | 'preference') => void;
  liveIncidents?: RoadIncident[];
  isDimmed?: boolean;
  isAppReady?: boolean;
  onMyLocationMoreInfo?: () => void;
}

export type ActiveMapOverlayLayer =
  | 'none'
  | 'highways'
  | 'incidents'
  | 'traffic'
  | 'alternatives'
  | 'cities';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] || character));
}

const NEPAL_BOUNDS: L.LatLngBoundsExpression = [[26.34, 80.0], [30.5, 88.3]];

function createNepalTileLayer(
  url: string,
  attribution: string,
  maxZoom: number,
  subdomains: string = 'abc',
  onTileError?: () => void,
) {
  const LayerClass = L.GridLayer.extend({
    options: { url, attribution, maxZoom, subdomains, onTileError },

    createTile(coords: L.Coords) {
      const tileSize = this.getTileSize();
      const tile = document.createElement('div');
      tile.style.width = tileSize.x + 'px';
      tile.style.height = tileSize.y + 'px';
      tile.style.backgroundColor = 'transparent';

      const tileBounds = this._tileCoordsToBounds(coords);
      const nepalBounds = L.latLngBounds(NEPAL_BOUNDS as any);
      if (tileBounds.intersects(nepalBounds)) {
        const subs = this.options.subdomains || '';
        const s = subs.length
          ? subs[(coords.x + coords.y) % subs.length]
          : '';
        let tileUrl = this.options.url.replace('{s}', s);
        tileUrl = L.Util.template(tileUrl, {
          x: coords.x,
          y: coords.y,
          z: coords.z,
          r: '',
        });
        const img = document.createElement('img');
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.25s ease';
        // IMPORTANT: attach load + error handlers BEFORE assigning img.src.
        // Browsers may fire load synchronously from cache, before a later
        // onload assignment has a chance to run, leaving opacity stuck at 0
        // (the symptom was: 45 "loaded" tiles reported by Leaflet but all
        // visually blank because img.onload never ran to flip opacity to 1).
        img.onload = () => { img.style.opacity = '1'; };
        img.onerror = () => {
          // Report on the FIRST failure. An <img> fires onerror exactly once
          // per src, so the old "count to 3" guard could never be reached and
          // the ArcGIS→OSM fallback never engaged (map stayed blank forever).
          this.options.onTileError?.();
          img.style.opacity = '0';
        };
        img.src = tileUrl;
        tile.appendChild(img);
      }

      return tile;
    },
  });

  return new LayerClass();
}

interface PavementBadgeProps {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'red' | 'orange' | 'blue';
}

function PavementBadge({ label, value, color }: PavementBadgeProps): React.ReactElement {
  const colorClasses = {
    emerald: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    amber: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    red: 'bg-red-900/30 text-red-300 border-red-700/50',
    orange: 'bg-orange-900/30 text-orange-300 border-orange-700/50',
    blue: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
  };
  return (
    <div className={`px-1.5 py-1 rounded-lg border text-center ${colorClasses[color]}`}>
      <div className="text-[7px] uppercase font-bold">{label}</div>
      <div className="text-xs font-black">{value}</div>
    </div>
  );
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  activeRoute,
  onSelectAlternativeRoute,
  onSelectCity,
  onSelectHighway,
  onSelectBlackspot,
  focusedTarget,
  colorMode: externalColorMode,
  onToggleColorMode: externalToggleColorMode,
  liveIncidents,
  isDimmed,
  isAppReady,
  onMyLocationMoreInfo,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const outsideMaskRef = useRef<L.Polygon | null>(null);
  const nepalBorderRef = useRef<L.GeoJSON | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    highways: L.LayerGroup;
    cities: L.LayerGroup;
    incidents: L.LayerGroup;
    blackspots: L.LayerGroup;
    route: L.LayerGroup;
    alternatives: L.LayerGroup;
    nepalBorder: L.LayerGroup;
    outsideMask: L.LayerGroup;
    provinces: L.LayerGroup;
  }>({
    highways: L.layerGroup(),
    cities: L.layerGroup(),
    incidents: L.layerGroup(),
    blackspots: L.layerGroup(),
    route: L.layerGroup(),
    alternatives: L.layerGroup(),
    nepalBorder: L.layerGroup(),
    outsideMask: L.layerGroup(),
    provinces: L.layerGroup(),
  });

  // Mutually Exclusive Overlay Layer Selection
  // Toggles are mutually exclusive; clicking active layer hides it.
  // When the layer toolbar is closed, all showing layers are closed.
  const [activeLayer, setActiveLayer] = useState<ActiveMapOverlayLayer>('none');
  const [showLegend, setShowLegend] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [showMapStyle, setShowMapStyle] = useState(false);
  // While following, every new GPS fix keeps the camera centred on the user.
  // A manual drag or zoom releases the camera but the position dot keeps
  // updating, so the map always shows where the user actually is.
  const [followMe, setFollowMe] = useState(true);

  const showBlackspots = false;
  const toolbarToggleRef = useRef<HTMLButtonElement>(null);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const mapStyleToggleRef = useRef<HTMLButtonElement>(null);
  const mapStyleContainerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const arcGisFailRef = useRef(0);
  const osmFailRef = useRef(0);
  const suppressRecenterRef = useRef(false);

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationButtonRef = useRef<HTMLDivElement>(null);
  const changeDropdownRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Tile provider fallback state. Starts at 'none' so the first load shows a
  // transparent map (no base tiles, no blank screen). Tiles load only after the
  // user clicks the canvas to activate the map.
  const [tileProvider, setTileProvider] = useState<'arcgis' | 'osm' | 'none'>('none');
  const [tileError, setTileError] = useState(false);
  const tileFailCountRef = useRef(0);

  // Map activation state - controls when controls become visible. Starts
  // inactive so the map is dimmed with no magnifier, map type, layers, or
  // my-location icons until the user clicks the canvas.
  const [mapActive, setMapActive] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapInteracted, setMapInteracted] = useState(false);

  // Activate map when user clicks the canvas. Loads base tiles and reveals the
  // zoom / style / layers controls.
  const activateMap = useCallback(() => {
    setMapInteracted(true);
    if (!mapActive) {
      setMapActive(true);
    }
    setTileProvider('arcgis');
  }, [mapActive]);

  // One shared device watcher. The map, the planner and My Location all read
  // this, so they cannot show different positions and the dot moves as the user
  // walks or drives.
  const { fix, error: locationError, restart } = useDeviceLocation();

  const gpsDetected = !!fix;
  const gpsCoords = fix ? { lat: fix.lat, lng: fix.lng } : null;

  // Toggle layer with exclusive selection
  const handleToggleLayer = (layer: ActiveMapOverlayLayer) => {
    setActiveLayer((prev) => (prev === layer ? 'none' : layer));
  };

  const closeLayerToolbar = () => {
    setIsToolbarOpen(false);
    setActiveLayer('none');
    setShowLegend(false);
    layersRef.current.highways.clearLayers();
    layersRef.current.cities.clearLayers();
    layersRef.current.incidents.clearLayers();
    layersRef.current.alternatives.clearLayers();
  };

  const handleToggleToolbar = () => {
    if (isToolbarOpen) {
      closeLayerToolbar();
      return;
    }

    setMapInteracted(true);
    setIsToolbarOpen(true);
    setShowMapStyle(false);
    setIsLocationDropdownOpen(false);
  };

  const handleToggleMapStyle = () => {
    if (showMapStyle) {
      setShowMapStyle(false);
      return;
    }

    // Accordion: opening the map-style (basemap) selector closes the overlay
    // layer toolbar so basemap and overlay controls stay independent.
    setShowMapStyle(true);
    closeLayerToolbar();
    setIsLocationDropdownOpen(false);
  };

  // Close all floating map controls (toolbar, layers, legend, map style selector, location dropdown)
  const closeAllMapControls = () => {
    closeLayerToolbar();
    setShowMapStyle(false);
    setIsLocationDropdownOpen(false);
  };

  // Click-outside: close all floating map controls when clicking the map, header, or anywhere outside the controls
  useEffect(() => {
    if (!isToolbarOpen && !showLegend && !showMapStyle) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        toolbarToggleRef.current?.contains(target) ||
        toolbarContainerRef.current?.contains(target) ||
        mapStyleToggleRef.current?.contains(target) ||
        mapStyleContainerRef.current?.contains(target) ||
        legendRef.current?.contains(target)
      ) {
        return;
      }
      closeAllMapControls();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isToolbarOpen, showLegend, showMapStyle]);

  useEffect(() => {
    if (!isLocationDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        locationButtonRef.current?.contains(target) ||
        changeDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsLocationDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLocationDropdownOpen]);

  // 79 Highways state loaded from GeoJSON dataset
  const [highwaysList, setHighwaysList] = useState<Highway[]>(NEPAL_HIGHWAYS);
  const [expandedCities, setExpandedCities] = useState<CityNode[]>(() => getCachedExpandedCities());
  const [activeHighwayInfo, setActiveHighwayInfo] = useState<Highway | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadAll79Highways().then((data) => {
      if (isMounted && data && data.length > 0) {
        setHighwaysList(data);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadExpandedCities().then((data) => {
      if (isMounted && data && data.length > 0) {
        setExpandedCities(data);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Map Style: Standard, Satellite, Terrain
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain' | 'territorial' | '3d'>('3d');
  const tileLayerRef = useRef<L.GridLayer | null>(null);

  // Camera lock bookkeeping. True as soon as the camera is on the user — either
  // because the map opened centred on the cached fix, or because the first live
  // fix triggered the fly-in. Until then the first fix in the [fix] effect
  // flies the camera to street level instead of panning at country zoom.
  const cameraLockedRef = useRef(false);

  // Ref mirror of followMe so the ?e2e=1 diagnostics can read it without
  // re-subscribing effects.
  const followMeRef = useRef(true);
  followMeRef.current = followMe;

  // Pick a street-level zoom that still makes sense for how precise the fix is:
  // phone GPS (±10-50 m) gets close, a coarse WiFi/cell fix (± km) stays further
  // out so the dot is not wildly off-screen from the claimed point.
  const zoomForAccuracy = (accuracy: number | null): number => {
    if (accuracy == null) return 14; // cached fix — assume typical phone-grade accuracy
    if (accuracy > 5000) return 11;
    if (accuracy > 1500) return 12;
    if (accuracy > 500) return 13;
    return 14;
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Use focusedTarget as initial center if available. Otherwise open on the
    // user's position — live fix first, then the session cache, then the
    // persistent last-known fix (survives restarts), so a first load or
    // refresh shows their surroundings, never the full Nepal overview. Only a
    // device that has NEVER reported a position falls back to the Kathmandu
    // city view while the first live fix resolves (the camera flies to the
    // real location the moment it arrives).
    const hasFocusedTarget = focusedTarget &&
      typeof focusedTarget.lat === 'number' &&
      typeof focusedTarget.lng === 'number' &&
      !isNaN(focusedTarget.lat) &&
      !isNaN(focusedTarget.lng);
    const liveFix = hasFocusedTarget ? null : getCurrentFix();
    const bootFix = liveFix ?? (hasFocusedTarget ? null : readCachedGps()) ?? (hasFocusedTarget ? null : readLastKnownGps());
    const hasBootFix = !!bootFix &&
      typeof bootFix.lat === 'number' &&
      typeof bootFix.lng === 'number';
    // A live/cached DeviceFix carries an accuracy figure; the persisted
    // last-known GpsFix does not (treated as "unknown" → typical phone zoom).
    const bootAccuracy: number | null = hasBootFix && 'accuracy' in bootFix
      ? ((bootFix as { accuracy?: number | null }).accuracy ?? null)
      : null;
    // A stale last-known fix (older than the 5-minute freshness window) still
    // picks the boot area, but the camera stays unlocked so the first LIVE fix
    // flies the user to where they actually are.
    const bootFixIsFresh = hasBootFix && (Date.now() - bootFix!.timestamp) <= 5 * 60 * 1000;
    const initialCenter: L.LatLngExpression = hasFocusedTarget
      ? [focusedTarget.lat, focusedTarget.lng]
      : hasBootFix
        ? [bootFix!.lat, bootFix!.lng]
        // Kathmandu city level — deliberately NOT the country-wide view.
        : [27.7172, 85.324];
    const initialZoom = hasFocusedTarget
      ? (focusedTarget.zoom || 12)
      : hasBootFix
        ? (bootFixIsFresh ? zoomForAccuracy(bootAccuracy) : 13)
        : 12;

    // Opening centred on the user counts as the camera being locked on only
    // when the boot fix is fresh (live or cached this session). A stale
    // last-known fix leaves the camera unlocked so the first live fix FLIES to
    // the user's actual position instead of panning across the country.
    cameraLockedRef.current = hasBootFix && bootFixIsFresh;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 6,
      maxZoom: 17,
      maxBounds: NEPAL_BOUNDS,
      // Viscosity 0.7 keeps the user inside Nepal on a free drag but lets
      // fitBounds pull the camera where it needs to without the maxBounds
      // machinery re-anchoring and cancelling the animation.
      maxBoundsViscosity: 0.7,
      zoomControl: false,
      attributionControl: false,
      // Smooth navigation: inertia gives a gentle drift after a drag (iOS-like),
      // zoomSnap 0.25 allows fractional zoom for finer wheel/pinch control,
      // and zoomAnimation keeps the zoom transitions fluid rather than stepped.
      inertia: true,
      inertiaDeceleration: 2400,
      inertiaMaxSpeed: 1800,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomAnimation: true,
      zoomAnimationThreshold: 4,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    // Do not force whole-of-Nepal bounds on first load. The camera opens on a
    // focused target, the cached user position (street level), or — only when
    // no fix exists at all — the default Nepal centre. The live GPS fix effect
    // flies in to the user's actual position once it resolves (followMe is on
    // by default), and base tiles + control buttons stay hidden until the user
    // clicks the map.

    layersRef.current.highways.addTo(map);
    layersRef.current.cities.addTo(map);
    layersRef.current.incidents.addTo(map);
    layersRef.current.alternatives.addTo(map);
    layersRef.current.route.addTo(map);
    layersRef.current.outsideMask.addTo(map);
    layersRef.current.nepalBorder.addTo(map);
    layersRef.current.provinces.addTo(map);

    mapInstanceRef.current = map;

    // E2E diagnostics — present only when the page is loaded with ?e2e=1.
    // Lets browser test harnesses read the real camera state (zoom, center,
    // follow flag, camera-lock flag) without touching production behaviour.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')) {
      (window as unknown as Record<string, unknown>).__msMap = map;
      (window as unknown as Record<string, unknown>).__msDebug = {
        getFollowMe: () => followMeRef.current,
        getCameraLocked: () => cameraLockedRef.current,
      };
    }

    // Mark map as initialized after layers are added
    setMapInitialized(true);

    // Camera-flight-safe invalidateSize. ANY invalidateSize() during a running
    // zoom/fly animation re-anchors the view through the maxBounds machinery
    // (fire('move'/'moveend') → _panInsideMaxBounds → panTo → setView), and
    // setView CANCELS the animation. That exact chain killed the first-fix
    // fly-in: the GPS card above the map changed height, the ResizeObserver
    // fired a few frames into the flight, and the app stayed stuck on the
    // country-wide view. So while a flight is running (suppressRecenterRef is
    // set) we skip the resize entirely — the deferred flush in the fly branch
    // corrects the size once the camera settles.
    const invalidateSizeSafe = () => {
      if (suppressRecenterRef.current) return;
      map.invalidateSize();
    };

    const timer = window.setTimeout(invalidateSizeSafe, 500);

    const splashTimer = window.setTimeout(invalidateSizeSafe, 4500);

    const resizeObs = new ResizeObserver(invalidateSizeSafe);
    resizeObs.observe(mapContainerRef.current);

    window.addEventListener('resize', invalidateSizeSafe);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(splashTimer);
      resizeObs.disconnect();
      window.removeEventListener('resize', invalidateSizeSafe);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Re-size map immediately when splash screen dismisses
  useEffect(() => {
    if (!isAppReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    // Same flight guard as the ResizeObserver path above: an invalidateSize
    // during a camera flight cancels it (maxBounds re-anchor → setView).
    if (suppressRecenterRef.current) return;
    map.invalidateSize();
    const timer = window.setTimeout(() => {
      if (suppressRecenterRef.current) return;
      map.invalidateSize();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isAppReady]);

  const placeGpsMarker = useCallback((latLng: L.LatLngExpression) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    markerRef.current = L.circleMarker(latLng, {
      radius: 8,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(map);
  }, []);

  /** Move the existing position dot instead of recreating it, so it tracks smoothly. */
  const updateGpsMarker = useCallback((latLng: L.LatLngExpression) => {
    if (!markerRef.current) {
      placeGpsMarker(latLng);
      return;
    }
    markerRef.current.setLatLng(latLng);
  }, [placeGpsMarker]);

  // Every fix updates the dot, and while following it also moves the camera.
  // The FIRST fix that the camera locks onto flies in to street level — panTo
  // alone kept the country-wide zoom 7, which is exactly the "opens on the full
  // Nepal map" behaviour this replaces. Later fixes pan smoothly so walking and
  // driving track in real time without re-flying.
  // EXCEPTION: when a route is fixed, the ROUTE owns the camera — the route
  // render effect frames the corridor with fitBounds. Follow-me panning would
  // yank the camera back to the user's dot on every GPS tick and destroy the
  // route view (the exact "map shows me, not my route" complaint). The dot
  // still updates; only the camera is left alone.
  useEffect(() => {
    if (!fix) return;
    updateGpsMarker([fix.lat, fix.lng]);
    if (!followMe) return;
    if (activeRoute) return; // route owns the camera
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!cameraLockedRef.current) {
      cameraLockedRef.current = true;
      // Guard the flight from the zoomend recenter handler, the same way the
      // focusedTarget flight does, then release once it settles.
      suppressRecenterRef.current = true;
      map.flyTo([fix.lat, fix.lng], zoomForAccuracy(fix.accuracy), {
        duration: 1.2,
        easeLinearity: 0.25,
      });
      const release = window.setTimeout(() => {
        suppressRecenterRef.current = false;
      }, 1400);
      // Container resizes that were skipped during the flight (GPS card grew,
      // splash dismissed, panel opened) are flushed here — after the flight is
      // over, so the maxBounds re-anchor cannot cancel anything.
      const resizeFlush = window.setTimeout(() => {
        map.invalidateSize();
      }, 1500);
      return () => {
        window.clearTimeout(release);
        window.clearTimeout(resizeFlush);
      };
    }
    map.panTo([fix.lat, fix.lng], { animate: true, duration: 0.6, easeLinearity: 0.5 });
  }, [fix, followMe, updateGpsMarker, activeRoute]);

  // A manual drag hands the camera back to the user. The dot still tracks;
  // only following stops. A zoom (mouse wheel or +/- buttons) recenters on the
  // user's location while keeping the chosen zoom level.
  // EXCEPTION: while a route is active, zoom-end does NOT recenter on the
  // user — the route's fitBounds ends with a zoomend, and recentering would
  // immediately pull the camera off the route corridor.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const releaseOnDrag = () => setFollowMe(false);
    // Zoom (wheel or +/-) smoothly recenters on the user's location while
    // keeping the current zoom level — panTo is smooth, flyTo jumps.
    const recenterOnZoom = () => {
      if (suppressRecenterRef.current) return;
      if (activeRoute) return; // route owns the camera
      setFollowMe(true);
      if (fix) {
        map.panTo([fix.lat, fix.lng], { animate: true, duration: 0.5, easeLinearity: 0.4 });
      }
    };
    map.on('dragstart', releaseOnDrag);
    map.on('zoomend', recenterOnZoom);
    return () => {
      map.off('dragstart', releaseOnDrag);
      map.off('zoomend', recenterOnZoom);
    };
  }, [mapInitialized, fix, suppressRecenterRef, activeRoute]);

  const recenterOnMe = useCallback(() => {
    setFollowMe(true);
    if (fix) {
      mapInstanceRef.current?.flyTo([fix.lat, fix.lng], 15, { duration: 0.9 });
    } else {
      restart();
    }
  }, [fix, restart]);

  const detectGpsPosition = useCallback(() => {
    restart();
  }, [restart]);

  // Update tile layer based on mapStyle, with ArcGIS→OpenStreetMap fallback
  // when tiles fail repeatedly. No CARTO (requires API key).
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    // Each effect run installs a fresh tile layer, so failure counting
    // restarts with it. Without this reset a provider switch inherited the
    // previous provider's failure count and could cascade straight to 'none'.
    arcGisFailRef.current = 0;
    osmFailRef.current = 0;

    // 'none' = transparent map, no base tiles. Keep overlay layers (routes,
    // incidents, cities) on a transparent background.
    if (tileProvider === 'none') {
      return;
    }

    // Pick URL by active provider. ArcGIS is primary; OSM is the no-key fallback.
    let url: string;
    let attribution = '';
    let maxZoom = 16;
    let subdomains = '';

    const baseArcGis =
      'https://server.arcgisonline.com/ArcGIS/rest/services';
    if (tileProvider === 'osm') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '© OpenStreetMap contributors';
      maxZoom = 19;
      subdomains = 'abc';
    } else if (mapStyle === 'satellite') {
      url = `${baseArcGis}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
      maxZoom = 19;
    } else if (mapStyle === 'terrain') {
      url = `${baseArcGis}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`;
      maxZoom = 19;
    } else if (mapStyle === 'territorial') {
      url = `${baseArcGis}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
      maxZoom = 16;
    } else {
      // '3d' default — Esri RETIRED Canvas/World_Terrain_Base (every tile
      // 404s, which left the map permanently blank). World_Dark_Gray_Base is
      // the same dark canvas family the Distance Calculator uses and is live.
      url = `${baseArcGis}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
      maxZoom = 16;
    }

    const onTileError = () => {
      if (tileProvider === 'osm') {
        osmFailRef.current += 1;
        if (osmFailRef.current >= 6) {
          setTileProvider('none');
          setTileError(true);
        }
        return;
      }
      arcGisFailRef.current += 1;
      if (arcGisFailRef.current >= 6) {
        setTileProvider('osm');
      }
    };

    const newLayer = createNepalTileLayer(url, attribution, maxZoom, subdomains, onTileError);

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapStyle, tileProvider]);

  // Handle focused target flight
  useEffect(() => {
    if (!mapInstanceRef.current || !focusedTarget) return;
    if (
      typeof focusedTarget.lat !== 'number' ||
      typeof focusedTarget.lng !== 'number' ||
      isNaN(focusedTarget.lat) ||
      isNaN(focusedTarget.lng)
    ) {
      return;
    }
    // Explicitly focusing a city or destination means the camera is no longer
    // tracking the user, so following stops — the dot keeps updating.
    setFollowMe(false);
    suppressRecenterRef.current = true;
    // Activating the map here also loads the basemap tiles, so when the user
    // picks a destination they immediately see the actual area (terrain /
    // roads / labels) instead of a blank dark canvas. Without this, the map
    // stayed dim and tile-less until the user clicked it.
    if (!mapActive) setMapActive(true);
    if (tileProvider === 'none') setTileProvider('arcgis');
    mapInstanceRef.current.flyTo([focusedTarget.lat, focusedTarget.lng], focusedTarget.zoom || 11, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
    // Allow zoom-to-user recentering again once the focus flight settles.
    setTimeout(() => {
      suppressRecenterRef.current = false;
    }, 1400);
  }, [focusedTarget, mapActive, tileProvider]);

  // Render All 79 Highways Layer (shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const highwaysGroup = layersRef.current.highways;
    highwaysGroup.clearLayers();

    if (activeLayer !== 'highways') return;

    const incidents = liveIncidents ?? [];

    const statusToColor = (status: RoadStatusType): string => {
      if (status === 'clear') return '#10b981';
      if (status === 'caution') return '#f59e0b';
      return '#ef4444'; // obstructed | closed
    };

    const realtimeToRoadStatus = (type: HighwayRealtimeStatusType): RoadStatusType => {
      if (type === 'open') return 'clear';
      if (type === 'caution' || type === 'roadwork') return 'caution';
      return 'obstructed'; // obstruction | closed
    };

    highwaysList.forEach((highway) => {
      // Compute real-time segment status from live incidents so blocked /
      // obstructed sectors shown in the alerts bell also appear red on the map
      // instead of relying on the static bundled status only.
      const analysis = analyzeHighwayRealtimeStatus(highway, incidents, []);
      const isSelected = activeHighwayInfo?.code === highway.code;
      const selectedColor = '#22d3ee';
      const overallColor = statusToColor(realtimeToRoadStatus(analysis.realtimeStatus));
      const weight = isSelected ? 3 : 2;
      const opacity = isSelected ? 1.0 : 0.85;

      const bindHighwayEvents = (polyline: L.Polyline) => {
        polyline.bindTooltip(
          `<div class="p-1 text-xs font-sans">
            <div class="font-bold text-emerald-400">${highway.code}: ${highway.name}</div>
            <div class="text-slate-200 text-[11px]">${highway.startPoint || ''} ➔ ${highway.endPoint || ''} (${highway.totalLengthKm} km)</div>
            <div class="text-slate-400 text-[10px]">${highway.dorDivision || 'DoR Nepal'}</div>
          </div>`,
          { sticky: true, className: 'custom-dark-tooltip' }
        );

        polyline.on('mouseover', function () {
          this.setStyle({ weight: weight + 1, opacity: 1.0 });
        });
        polyline.on('mouseout', function () {
          this.setStyle({ weight, opacity });
        });

        polyline.on('click', () => {
          setActiveHighwayInfo(highway);
          if (onSelectHighway) onSelectHighway(highway);
          if (highway.bounds && mapInstanceRef.current) {
            mapInstanceRef.current.fitBounds(highway.bounds, { padding: [40, 40], maxZoom: 12 });
          }
        });
      };

      if (highway.coordinates && highway.coordinates.length > 0) {
        highway.coordinates.forEach((lineCoords) => {
          if (!lineCoords || lineCoords.length < 2) return;
          const polyline = L.polyline(lineCoords, {
            color: isSelected ? selectedColor : overallColor,
            weight,
            opacity,
            lineJoin: 'round',
            lineCap: 'round',
          });
          bindHighwayEvents(polyline);
          highwaysGroup.addLayer(polyline);
        });
      } else if (highway.segments && highway.segments.length > 0) {
        // Prefer real-time analysed segments (with live-incident status) when
        // they carry coordinates; otherwise fall back to the static segment
        // status so blocked sectors still render red.
        const analysedSegs = analysis.segments.filter(
          (s) => s.coordinates && s.coordinates.length >= 2
        );
        if (analysedSegs.length > 0) {
          analysedSegs.forEach((seg) => {
            const segColor = isSelected
              ? selectedColor
              : statusToColor(seg.status);
            const polyline = L.polyline(seg.coordinates!, {
              color: segColor,
              weight: isSelected ? 3 : seg.lanes >= 4 ? 3 : 2,
              opacity,
              lineJoin: 'round',
              lineCap: 'round',
            });
            bindHighwayEvents(polyline);
            highwaysGroup.addLayer(polyline);
          });
        } else {
          highway.segments.forEach((seg) => {
            const segColor = isSelected
              ? selectedColor
              : statusToColor(seg.status);
            const polyline = L.polyline(seg.coordinates, {
              color: segColor,
              weight: isSelected ? 3 : seg.lanes >= 4 ? 3 : 2,
              opacity,
              lineJoin: 'round',
              lineCap: 'round',
            });
            bindHighwayEvents(polyline);
            highwaysGroup.addLayer(polyline);
          });
        }
      }
    });
  }, [activeLayer, highwaysList, activeHighwayInfo, onSelectHighway, liveIncidents]);

  // Render White Mask (covers everything OUTSIDE Nepal) and Nepal Border Outline
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const maskGroup = layersRef.current.outsideMask;
    const borderGroup = layersRef.current.nepalBorder;
    maskGroup.clearLayers();
    borderGroup.clearLayers();

    fetch('/data/nepal-provinces.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data || !data.features || !data.features.length) {
          console.warn('No Nepal border data to render');
          return;
        }
        try {
          const worldCorners: L.LatLngExpression[] = [
            [-180, -90], [180, -90], [180, 90], [-180, 90],
          ];
          const holes: L.LatLngExpression[][] = [];

          data.features.forEach((feature: any) => {
            const geom = feature.geometry;
            if (!geom) return;
            const collectRings = (rings: any[]) => {
              rings.forEach((ring: any[]) => {
                holes.push(ring.map((coord: [number, number]) => [coord[1], coord[0]] as L.LatLngExpression));
              });
            };
            if (geom.type === 'Polygon') {
              collectRings(geom.coordinates);
            } else if (geom.type === 'MultiPolygon') {
              geom.coordinates.forEach((polygon: any[]) => collectRings(polygon));
            }
          });

          // Respect the active theme at creation time. The theme-sync effect
          // below only runs on `data-theme` mutations, and the mask is created
          // asynchronously after that effect's initial pass — a hardcoded light
          // fill here left a white mask around Nepal on every dark-mode load.
          const themeNow = document.documentElement.getAttribute('data-theme');
          const isLightTheme = themeNow === 'light';
          const mask = L.polygon(
            [worldCorners, ...holes] as unknown as L.LatLngExpression[][],
            {
              fillColor: isLightTheme ? '#efefeb' : '#0b1220',
              fillOpacity: isLightTheme ? 1.0 : 0.4,
              color: 'transparent',
              weight: 0,
              interactive: false,
            },
          );
          maskGroup.addLayer(mask);
          mask.bringToBack();
          // StrictMode dev double-mount can resolve two fetches in parallel;
          // drop any earlier mask so a stale fill never sits under the live one.
          if (outsideMaskRef.current && outsideMaskRef.current !== mask) {
            maskGroup.removeLayer(outsideMaskRef.current);
          }
          outsideMaskRef.current = mask;

          const border = L.geoJSON(data, {
            style: {
              color: '#10b981',
              weight: 2.5,
              opacity: 0.9,
              fillColor: '#064e3b',
              fillOpacity: 0.08,
            },
            onEachFeature: (feature, layer) => {
              const pname = feature.properties?.name || feature.properties?.PROVINCE || feature.properties?.PROV_NM;
              if (pname) {
                layer.bindTooltip(pname, {
                  sticky: true,
                  className: 'custom-dark-tooltip',
                });
              }
            },
          });
          borderGroup.addLayer(border);
          nepalBorderRef.current = border;

          mapInstanceRef.current?.invalidateSize();
        } catch (e) {
          console.error('Failed to render Nepal mask/border:', e);
        }
      })
      .catch(err => console.warn('Failed to load Nepal border:', err));
  }, []);

  // Update outside mask color based on theme
  useEffect(() => {
    const updateMaskForTheme = () => {
      const mask = outsideMaskRef.current;
      if (!mask) return;
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'light') {
        mask.setStyle({ fillColor: '#efefeb', fillOpacity: 1.0 });
      } else {
        mask.setStyle({ fillColor: '#0b1220', fillOpacity: 0.4 });
      }
    };

    updateMaskForTheme();

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateMaskForTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => { observer.disconnect(); };
  }, []);

  // Fade the Nepal border + outside-mask when a route is fixed. The user
  // wants to see only the required length and area — the whole-of-Nepal
  // frame (border outline + the dark/light mask covering everything outside
  // Nepal) is visual noise at route zoom. When a route is active, drop the
  // border to a faint hairline and the mask to near-transparent so the
  // basemap + route lines are the only thing that reads. When the route is
  // cleared, restore the original opacity so the country frame comes back.
  useEffect(() => {
    const mask = outsideMaskRef.current;
    const border = nepalBorderRef.current;
    if (mask) {
      if (activeRoute) {
        mask.setStyle({ fillOpacity: 0.12 });
      } else {
        const theme = document.documentElement.getAttribute('data-theme');
        mask.setStyle({ fillOpacity: theme === 'light' ? 1.0 : 0.4 });
      }
    }
    if (border) {
      if (activeRoute) {
        border.setStyle({ opacity: 0.18, fillOpacity: 0.0, weight: 1 });
      } else {
        border.setStyle({ opacity: 0.9, fillOpacity: 0.08, weight: 2.5 });
      }
    }
  }, [activeRoute]);

  // Render Province Boundaries (always visible)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const provincesGroup = layersRef.current.provinces;
    provincesGroup.clearLayers();

    fetch('/data/nepal-provinces.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data || !data.features || !data.features.length) {
          console.warn('No province data to render');
          return;
        }
        try {
          const geoJsonLayer = L.geoJSON(data, {
            style: {
              color: '#22d3ee',
              weight: 1.5,
              opacity: 0.5,
              fill: false,
              dashArray: '4, 4',
            },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name || feature.properties?.ADM1_EN || 'Province';
              layer.bindTooltip(name, {
                sticky: true,
                className: 'custom-dark-tooltip',
              });
            },
          });
          provincesGroup.addLayer(geoJsonLayer);
        } catch (e) {
          console.error('Failed to render provinces:', e);
        }
      })
      .catch(err => console.warn('Failed to load provinces:', err));
  }, []);

  // Render Incidents & Road Hazards Layer (shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const incidentsGroup = layersRef.current.incidents;
    incidentsGroup.clearLayers();

    if (activeLayer !== 'incidents') return;

    // No seed fallback: with no live feed the incidents layer is simply empty
    // rather than showing sample reports as if they were real pins.
    const incidentsList = liveIncidents ?? [];

    incidentsList.forEach((inc) => {
      const isCritical = inc.severity === 'critical' || inc.severity === 'severe';
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <div class="absolute w-10 h-10 ${
            isCritical ? 'bg-rose-500/50 animate-ping' : 'bg-amber-500/40 animate-pulse'
          } rounded-full duration-1000"></div>
          <div class="absolute w-14 h-14 ${
            isCritical ? 'bg-rose-600/25' : 'bg-amber-600/25'
          } rounded-full animate-pulse"></div>
          <div class="relative w-8 h-8 ${
            isCritical ? 'bg-rose-600 border-rose-200 text-white shadow-rose-500/60' : 'bg-amber-600 border-amber-200 text-white shadow-amber-500/60'
          } rounded-full flex items-center justify-center shadow-xl border-2 text-[14px] font-bold">
            ${isCritical ? '🚨' : '⚠️'}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-incident-marker',
        html: markerHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([inc.lat, inc.lng], { icon });

      incidentsGroup.addLayer(marker);
    });
  }, [activeLayer, liveIncidents]);




  const highwayTouchCities = useMemo(
    () => filterCitiesNearHighways(expandedCities, highwaysList, CITY_HIGHWAY_TOUCH_DISTANCE_KM),
    [expandedCities, highwaysList]
  );

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const citiesGroup = layersRef.current.cities;
    citiesGroup.clearLayers();

    if (activeLayer !== 'cities') return;

    const routeCityIds = new Set<string>();
    const routeCoordinates = activeRoute?.pathCoordinates || [];
    if (activeRoute) {
      routeCityIds.add(activeRoute.origin.id);
      routeCityIds.add(activeRoute.destination.id);
    }

    highwayTouchCities.forEach((city) => {
      const isRouteCity = routeCityIds.has(city.id) || routeCoordinates.some(
        (coordinate) => Math.abs(coordinate[0] - city.lat) < 0.12 && Math.abs(coordinate[1] - city.lng) < 0.12
      );
      const isHub = city.isMajorHub || isRouteCity;
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <div class="${
            isHub ? 'w-3.5 h-3.5 bg-emerald-500 ring-4 ring-emerald-500/20' : 'w-2.5 h-2.5 bg-slate-400 ring-2 ring-slate-600'
          } rounded-full shadow-md"></div>
          ${isHub ? `
            <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-slate-800 whitespace-nowrap pointer-events-none">
              ${escapeHtml(city.name)}
            </div>
          ` : ''}
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-city-marker',
        html: markerHtml,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([city.lat, city.lng], { icon, riseOnHover: true });
      const location = [city.district, city.province].filter(Boolean).join(' · ');
      marker.bindTooltip(
        `<div class="p-1.5 text-xs font-sans"><div class="font-bold text-white">${escapeHtml(city.name)}</div>${location ? `<div class="text-slate-300">${escapeHtml(location)}</div>` : ''}</div>`,
        { className: 'custom-dark-tooltip', direction: 'top', offset: [0, -10] }
      );

      marker.on('click', () => {
        if (onSelectCity) onSelectCity(city, 'origin');
      });

      citiesGroup.addLayer(marker);
    });
  }, [activeLayer, highwayTouchCities, activeRoute, onSelectCity]);

  // Render Blackspots Layer (Global Nepal Accident Blackspots)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const blackspotsGroup = layersRef.current.blackspots;
    blackspotsGroup.clearLayers();

    if (!showBlackspots) return;

    NEPAL_HIGHWAY_BLACKSPOTS.forEach((spot) => {
      const isExtreme = spot.riskLevel === 'critical';
      const markerColor = isExtreme ? '#ef4444' : spot.riskLevel === 'high' ? '#f97316' : '#f59e0b';

      const customIcon = L.divIcon({
        className: 'blackspot-marker',
        html: `
          <div style="
            background: ${markerColor};
            border: 2px solid #ffffff;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            box-shadow: 0 0 10px ${markerColor}90;
            cursor: pointer;
            animation: ${isExtreme ? 'pulse 1.8s infinite' : 'none'};
          ">
            ⚠️
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([spot.coordinates[0], spot.coordinates[1]], { icon: customIcon });

      marker.on('click', () => {
        if (onSelectBlackspot) onSelectBlackspot(spot);
      });

      blackspotsGroup.addLayer(marker);
    });
  }, [showBlackspots, onSelectBlackspot]);

  // Render Active and Alternative Routes (With Highway Safety Index Multi-Segment Color Coding)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const routeGroup = layersRef.current.route;
    const altGroup = layersRef.current.alternatives;
    routeGroup.clearLayers();
    altGroup.clearLayers();

    if (!activeRoute || !activeRoute.pathCoordinates || activeRoute.pathCoordinates.length === 0) {
      return;
    }

    const bounds = L.latLngBounds([]);

    // 1. Render Alternative Routes — always shown when a route is fixed and
    //    has alternatives, regardless of the active overlay layer. The user
    //    wants the route lines (with alternatives if any) visible the moment
    //    a route is calculated, without having to toggle a layer.
    if (activeRoute.allRouteOptions && activeRoute.allRouteOptions.length > 1) {
      const altOptions = activeRoute.allRouteOptions.filter((opt) => opt.id !== activeRoute.id);

      altOptions.forEach((altOpt) => {
        if (!altOpt.pathCoordinates || altOpt.pathCoordinates.length === 0) return;

        const color = altOpt.routeColor || '#a855f7';
        altOpt.pathCoordinates.forEach((c) => bounds.extend(c));

        // Soft ambient glow (matches main route styling)
        const altGlow = L.polyline(altOpt.pathCoordinates, {
          color,
          weight: 8,
          opacity: 0.20,
          lineJoin: 'round',
          lineCap: 'round',
        });

        // Dashed alternative polyline
        const altLine = L.polyline(altOpt.pathCoordinates, {
          color,
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 10',
          lineCap: 'round',
          lineJoin: 'round',
        });

        // Hover & Click interaction
        altLine.on('mouseover', () => {
          altLine.setStyle({ weight: 7, opacity: 1 });
        });
        altLine.on('mouseout', () => {
          altLine.setStyle({ weight: 5, opacity: 0.75 });
        });
        altLine.on('click', () => {
          if (onSelectAlternativeRoute) {
            onSelectAlternativeRoute(altOpt);
          }
        });

        altGroup.addLayer(altGlow);
        altGroup.addLayer(altLine);

        // Place on-canvas midpoint badge marker
        if (altOpt.pathCoordinates.length > 4) {
          const midIdx = Math.floor(altOpt.pathCoordinates.length / 2);
          const midCoord = altOpt.pathCoordinates[midIdx];

          const badgeIcon = L.divIcon({
            className: 'route-badge-marker',
            html: `
              <div style="background: rgba(15, 23, 42, 0.92); border: 1px solid ${color}; color: #f8fafc; padding: 1px 6px; border-radius: 999px; font-size: 9px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer; display: flex; align-items: center; gap: 3px;">
                <span>${altOpt.routeBadge || 'Alt'}</span>
                <span style="color: ${color};">${Math.round(altOpt.totalDistanceKm)} km</span>
              </div>
            `,
            iconSize: [72, 18],
            iconAnchor: [36, 9],
          });

          const badgeMarker = L.marker(midCoord, { icon: badgeIcon });
          badgeMarker.on('click', () => {
            if (onSelectAlternativeRoute) {
              onSelectAlternativeRoute(altOpt);
            }
          });
          altGroup.addLayer(badgeMarker);
        }
      });
    }

    // 2. Render Main Active Route — Distance-Calculator style (RouteMapView):
    //    ONE soft glow + ONE solid core drawn straight from the surveyed
    //    pathCoordinates. The previous multi-segment "safety color-coding"
    //    branch silently drew NOTHING because engine steps carry no segment
    //    geometry (no coordinates / from-to lat-lng), so every step was
    //    skipped — the exact "map shows no line, only From/To labels" bug.
    activeRoute.pathCoordinates.forEach((c) => bounds.extend(c));

    // A route with <=2 path points is a straight-line aerial fallback (no surveyed
    // DoR corridor for this origin-destination pair). Render it as a single clean
    // dashed grey approximation line so users do not mistake it for a real
    // highway, and skip the always-on aerial overlay that used to draw a
    // redundant straight line on top of the real curvy corridor.
    const isAerialFallback = activeRoute.pathCoordinates.length <= 2;

    if (isAerialFallback) {
      const approxLine = L.polyline(activeRoute.pathCoordinates, {
        color: '#94a3b8',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 12',
        lineCap: 'round',
        lineJoin: 'round',
      });
      approxLine.bindTooltip(
        `<strong>Straight-line approximation</strong><br/>No surveyed DoR highway corridor for this pair.`,
        { className: 'custom-dark-tooltip', sticky: true }
      );
      routeGroup.addLayer(approxLine);
    } else {
      // Clean glow + core, same visual family as the Distance Calculator's
      // RouteMapView (glow ≈ w8 @ 0.22 halo, core ≈ w4 @ 0.95). The planner's
      // mode color (drive/bike/etc.) is kept for the core stroke.
      const activeColor = activeRoute.routeColor || '#34d399';

      const routeGlow = L.polyline(activeRoute.pathCoordinates, {
        color: activeColor,
        weight: 8,
        opacity: 0.22,
        lineJoin: 'round',
        lineCap: 'round',
      });

      const routePolyline = L.polyline(activeRoute.pathCoordinates, {
        color: activeColor,
        weight: 4,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      });

      routeGroup.addLayer(routeGlow);
      routeGroup.addLayer(routePolyline);
    }

    // 3. Render Active Route Blackspot Danger Badges along the corridor
    if (activeRoute.safetyIndex?.activeBlackspots) {
      activeRoute.safetyIndex.activeBlackspots.forEach((spot) => {
        const isHazard = spot.riskLevel === 'critical';
        const spotColor = isHazard ? '#ef4444' : '#f97316';

        const spotIcon = L.divIcon({
          className: 'active-route-blackspot-marker',
          html: `
            <div style="
              background: ${spotColor};
              border: 2px solid #ffffff;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              box-shadow: 0 0 12px ${spotColor};
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 12px;
              cursor: pointer;
              animation: pulse 1.5s infinite;
            ">
              ⚠️
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const spotMarker = L.marker([spot.coordinates[0], spot.coordinates[1]], { icon: spotIcon });
        spotMarker.bindTooltip(
          `<strong>BLACKSPOT HAZARD: ${spot.name}</strong><br/><span style="color:#ef4444;">${spot.annualAccidentStats} • ${spot.highwayCode}</span>`,
          { className: 'custom-dark-tooltip' }
        );

        routeGroup.addLayer(spotMarker);
      });
    }

    // Start/End markers — identical to the Distance Calculator's RouteMapView:
    // 26px A/B round badges with a white ring; place names appear ONLY on
    // hover (no permanent From/To labels on the map).
    const endpointBadge = (letter: string, color: string, letterColor: string) =>
      L.divIcon({
        className: 'route-endpoint-marker',
        html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:${letterColor};font:900 13px/1 system-ui,sans-serif;">${letter}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

    const startCoord = activeRoute.pathCoordinates[0];
    const startMarker = L.marker(startCoord, { icon: endpointBadge('A', '#10b981', '#022c22') }).bindTooltip(
      activeRoute.origin.name,
      { direction: 'top', className: 'custom-dark-tooltip' }
    );

    const endCoord = activeRoute.pathCoordinates[activeRoute.pathCoordinates.length - 1];
    const endMarker = L.marker(endCoord, { icon: endpointBadge('B', '#f43f5e', '#ffffff') }).bindTooltip(
      activeRoute.destination.name,
      { direction: 'top', className: 'custom-dark-tooltip' }
    );

    routeGroup.addLayer(startMarker);
    routeGroup.addLayer(endMarker);

    // Fit map smoothly to encompass the active route + any alternative paths.
    // The camera now owns "show me the required length and area" — the user
    // sees exactly the route corridor, not the whole of Nepal. maxZoom 14 lets
    // short routes zoom in close; long routes still fit comfortably. Padding
    // 70px keeps the endpoints clear of the card edges.
    if (bounds.isValid()) {
      // Activate the map (load tiles, reveal controls) the moment a route is
      // fixed so the user sees the real area immediately, not a blank canvas.
      if (!mapActive) setMapActive(true);
      if (tileProvider === 'none') setTileProvider('arcgis');
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [70, 70],
        maxZoom: 14,
        animate: true,
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
   }, [activeRoute, activeLayer, onSelectAlternativeRoute, onSelectBlackspot, mapInitialized, mapActive, tileProvider]);

  const hasAlternatives = activeRoute?.allRouteOptions && activeRoute.allRouteOptions.length > 1;

   const handleMyLocation = () => {
    setMapInteracted(true);
    setMapActive(true);
    if (gpsDetected) {
      // Re-engage following and snap to the current fix right now.
      recenterOnMe();
      setIsLocationDropdownOpen((open) => !open);
      if (!isLocationDropdownOpen) {
        setIsToolbarOpen(false);
        setActiveLayer('none');
        setShowLegend(false);
        setShowMapStyle(false);
        layersRef.current.highways.clearLayers();
        layersRef.current.cities.clearLayers();
        layersRef.current.incidents.clearLayers();
        layersRef.current.alternatives.clearLayers();
      }
    } else {
      detectGpsPosition();
    }
  };

  const handleChangeLocation = () => {
    setIsLocationDropdownOpen(false);
    onMyLocationMoreInfo?.();
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/90 shadow-2xl">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        id="nepal-gis-canvas"
        onClick={activateMap}
      />

      {/* Map data unavailable overlay - shows when all tile providers fail */}
      {mapActive && tileError && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-black/50 max-w-sm text-center animate-fadeIn">
            <div className="w-10 h-10 rounded-full bg-rose-900/50 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Map data unavailable</h4>
            <p className="text-[11px] text-slate-400 mb-4">
              Base map tiles could not be loaded. Highway routes, incidents, and
              route lines still work — only the background map is missing.
            </p>
            <button
              onClick={() => {
                arcGisFailRef.current = 0;
                osmFailRef.current = 0;
                setTileProvider('arcgis');
                setTileError(false);
              }}
              className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto max-w-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry map tiles</span>
            </button>
          </div>
        </div>
      )}

      {/* My Location GPS Button - only show when map is active */}
      {mapActive && (
        <div
          ref={locationButtonRef}
          className="absolute top-3 right-3 z-[1000] flex flex-col items-end"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleMyLocation}
            className={`w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-xl border shadow-2xl shadow-black/50 transition ${
              gpsDetected
                ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20 hover:bg-emerald-900/90'
                : 'bg-slate-950/90 hover:bg-slate-900 text-sky-300 border-sky-500/40'
            }`}
            title={gpsDetected
              ? (followMe ? 'Following your live location' : 'My Location — tap to follow again')
              : 'My Location'}
            aria-label={gpsDetected ? 'My Location detected' : 'Detect My Location'}
            aria-expanded={gpsDetected && isLocationDropdownOpen}
            id="btn-my-location-gps"
          >
            {gpsDetected ? <LocateFixed className="w-4 h-4" /> : <Locate className="w-4 h-4" />}
          </button>

          {!gpsDetected && locationError && (
            <div className="absolute top-[52px] right-0 z-[999] max-w-[9rem] rounded-full border border-rose-500/30 bg-rose-950/80 px-2 py-0.5 text-[9px] font-bold text-rose-300 backdrop-blur-xl">
              No GPS fix
            </div>
          )}

          {gpsDetected && isLocationDropdownOpen && (
            <div
              ref={changeDropdownRef}
              className="absolute top-full right-0 mt-2 w-32 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl shadow-black/50 p-1.5 animate-fadeIn"
            >
              <button
                type="button"
                onClick={handleChangeLocation}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-bold text-amber-300 hover:bg-slate-800 border border-transparent hover:border-amber-500/50 transition"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>More Info</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map Style Selector - only show when map is active */}
      {mapActive && showMapStyle && (
        <div ref={mapStyleContainerRef} className="absolute top-14 right-28 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl p-1 shadow-2xl shadow-black/50 animate-fadeIn">
          <button
            type="button"
            onClick={() => { setMapStyle('standard'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'standard' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Standard"
          >
            <MapIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('satellite'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'satellite' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Satellite"
          >
            <Globe className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('terrain'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'terrain' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Terrain"
          >
            <Mountain className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('3d'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === '3d' ? 'bg-accent-bg accent-text accent-border shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="3D Terrain"
          >
            <Box className="w-3 h-3" />
          </button>
</div>
      )}
      {mapActive && (
          <button
            type="button"
            ref={mapStyleToggleRef}
            onClick={handleToggleMapStyle}
            className={`absolute top-3 right-28 z-[1000] w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${showMapStyle ? 'bg-slate-950/90 text-emerald-400 border-emerald-500/50 rotate-90' : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white'}`}
            title="Map Style"
            id="btn-map-style-toggle"
            aria-label="Toggle map style"
          >
            <Globe className="w-3 h-3" />
          </button>
      )}

      {/* Zoom Controls - at top, left of Map Style button - only show when map is active */}
      {mapActive && (
        <>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="absolute top-3 right-[14rem] z-[1000] w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white hover:border-slate-600"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="absolute top-3 right-[16.5rem] z-[1000] w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white hover:border-slate-600"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Layer Toolbar - vertical stack top-to-bottom - only show when map is active */}
      {mapActive && isToolbarOpen && (
        <div ref={toolbarContainerRef} className="absolute top-14 right-16 z-[1000] flex flex-col items-end gap-1.5 w-36 animate-fadeIn">
          <button
            type="button"
            onClick={() => handleToggleLayer('highways')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'highways'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
            }`}
            title="Highways"
            id="toggle-layer-highways"
          >
            <Route className="w-3 h-3" />
              <span className="text-[10px] font-bold">Highways</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('incidents')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'incidents'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/20'
                : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
            }`}
            title="Incidents"
            id="toggle-layer-incidents"
          >
            <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-bold">Incidents</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('cities')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'cities'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
            }`}
            title="Cities"
            id="toggle-layer-cities"
          >
            <Building className="w-3 h-3" />
              <span className="text-[10px] font-bold">Cities</span>
          </button>
          {hasAlternatives && (
            <button
              type="button"
              onClick={() => handleToggleLayer('alternatives')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
                activeLayer === 'alternatives'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-purple-500/20'
                  : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
              }`}
              title="Alternatives"
              id="toggle-layer-alternatives"
            >
              <Repeat className="w-3 h-3" />
              <span className="text-[10px] font-bold">Alternatives</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              showLegend
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20'
                : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
            }`}
            title="Legend"
            id="toggle-map-legend"
          >
            <Info className="w-3 h-3" />
              <span className="text-[10px] font-bold">Legend</span>
          </button>
        </div>
      )}

      {/* Layer toolbar toggle - always available while the map is active */}
      {mapActive && (
      <button
        type="button"
        ref={toolbarToggleRef}
        onClick={handleToggleToolbar}
        className={`absolute top-3 right-16 z-[1000] w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${
          isToolbarOpen
            ? 'bg-accent-bg accent-text accent-border shadow-black/10'
            : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
        }`}
        title="Layers"
        id="toggle-toolbar-collapse"
      >
        <Layers className={`w-4 h-4 ${isToolbarOpen ? 'rotate-90 accent-text' : 'accent-text'} transition-transform`} />
      </button>
      )}

      {/* Map Legend Overlay Component with Smooth Slide-in Fade Animation */}
      <div
        ref={legendRef}
        id="map-legend-card"
        className={`absolute bottom-6 left-6 z-[1400] max-w-xs sm:w-80 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out transform ${
          showLegend
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
      >
        {/* Legend Header */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Highway GIS Legend
              </h4>
              <span className="text-[9px] text-slate-400">Symbology & Safety Tiers</span>
            </div>
          </div>
          <button
            onClick={() => setShowLegend(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Legend"
            id="btn-close-map-legend"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend Content */}
        <div className="p-3.5 space-y-3 max-h-80 overflow-y-auto scrollbar-paddle text-xs">
          {/* Corridor Safety Tiers */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Corridor Safety Scores
            </span>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-200">High Safety</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">≥ 80 / 100</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-500/30 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-200">Moderate Caution</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-bold">60–79 / 100</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-500/30 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-200">Elevated Risk</span>
                </div>
                <span className="text-[10px] font-mono text-rose-400 font-bold">&lt; 60 / 100</span>
              </div>
            </div>
          </div>

          {/* Map Symbology */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Map Symbology
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="text-slate-300">Point A (Start)</span>
              </div>
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                <span className="text-slate-300">Point B (End)</span>
              </div>
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <span className="text-xs shrink-0">⚠️</span>
                <span className="text-slate-300">Blackspot</span>
              </div>

              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <div className="w-4 h-1 rounded bg-emerald-500 shrink-0"></div>
                <span className="text-slate-300 truncate">NH Highway</span>
              </div>
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <span className="text-xs shrink-0">🌤️</span>
                <span className="text-slate-300">Weather Node</span>
              </div>
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <div className="w-4 h-1 border-t-2 border-dashed border-purple-400 shrink-0"></div>
                <span className="text-slate-300 truncate">Alt Route</span>
              </div>
            </div>
          </div>

          {/* DoR Classification Note */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500">
            <span>Nepal Road Standard GIS</span>
            <span className="font-mono text-emerald-500 font-bold">DoR Telemetry</span>
          </div>
        </div>
      </div>

      {/* Active Highway GIS Info Card */}
      {activeHighwayInfo && (
        <div className="absolute bottom-6 left-6 z-[1400] max-w-md w-[calc(100%-3rem)] bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-white animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-600/40 flex flex-col items-center justify-center shrink-0">
                <span className="text-[9px] text-slate-400 font-bold uppercase">NEPAL</span>
                <span className="text-sm font-black text-emerald-400 font-display">{activeHighwayInfo.code}</span>
              </div>
              <div>
                 <div className="flex items-center space-x-2 flex-wrap">
                   <h4 className="font-bold text-white text-sm">{activeHighwayInfo.name}</h4>
                   <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      activeHighwayInfo.overallStatus === 'clear'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {activeHighwayInfo.overallStatus === 'clear' ? '✓ Open' : '⚠️ Caution'}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeHighwayInfo.startPoint} ➔ {activeHighwayInfo.endPoint}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-bold text-emerald-400">{activeHighwayInfo.totalLengthKm} km</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveHighwayInfo(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition text-xs font-bold"
              title="Close card"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-400 text-[11px] truncate max-w-[240px]">
              {activeHighwayInfo.districts && activeHighwayInfo.districts.length > 0 ? (
                <span>Districts: <strong className="text-slate-200">{activeHighwayInfo.districts.slice(0, 3).join(', ')}{activeHighwayInfo.districts.length > 3 ? ` +${activeHighwayInfo.districts.length - 3}` : ''}</strong></span>
              ) : (
                <span>Division: <strong className="text-slate-200">{activeHighwayInfo.dorDivision || 'DoR Nepal'}</strong></span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (onSelectHighway) onSelectHighway(activeHighwayInfo);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
              >
                <Navigation className="w-3 h-3" />
                <span>Plan Route</span>
              </button>
            </div>
          </div>

          {/* Pavement Breakdown */}
          {(() => {
            const enrichment = highwaysList ? getHighwayEnrichment(activeHighwayInfo.code, null, highwaysList) : null;
            const pavement = enrichment?.pavement;
            if (!pavement || pavement.totalKm === 0) return null;
            return (
              <div className="mt-2 pt-2 border-t border-slate-800/50">
                <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1.5">Pavement Breakdown</div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {pavement.BT > 0 && <PavementBadge label="BT" value={pavement.BT} color="emerald" />}
                  {pavement.GR > 0 && <PavementBadge label="GR" value={pavement.GR} color="amber" />}
                  {pavement.ER > 0 && <PavementBadge label="ER" value={pavement.ER} color="red" />}
                  {pavement.UC > 0 && <PavementBadge label="UC" value={pavement.UC} color="orange" />}
                  {pavement.PL > 0 && <PavementBadge label="PL" value={pavement.PL} color="blue" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Total: {pavement.totalKm} km</div>
              </div>
            );
          })()}

          {/* Key Passes & Junctions */}
          {activeHighwayInfo.keyPassesAndJunctions && activeHighwayInfo.keyPassesAndJunctions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/50">
              <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1.5">Key Passes & Junctions ({activeHighwayInfo.keyPassesAndJunctions.length})</div>
              <div className="flex flex-wrap gap-1">
                {activeHighwayInfo.keyPassesAndJunctions.map((pass, i) => (
                  <span key={i} className="text-[10px] text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded">
                    {pass}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
