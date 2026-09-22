import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Highway,
  CityNode,
  RoadIncident,
  RoutePlanResult,
  KnownBlackspot,
  SegmentSafetyData,
} from '../types';
import {
  NEPAL_HIGHWAYS,
  LIVE_ROAD_INCIDENTS,
} from '../data/nepalHighwaysData';
import { loadAll79Highways } from '../utils/nepalHighwayDataLoader';
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
) {
  const LayerClass = L.GridLayer.extend({
    options: { url, attribution, maxZoom, subdomains },

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
        img.src = tileUrl;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        img.onload = () => { img.style.opacity = '1'; };
        img.onerror = () => { img.style.opacity = '0'; };
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
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    highways: L.LayerGroup;
    cities: L.LayerGroup;
    incidents: L.LayerGroup;
    blackspots: L.LayerGroup;
    route: L.LayerGroup;
    alternatives: L.LayerGroup;
    nepalBorder: L.LayerGroup;
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

  const showBlackspots = false;
  const routeColorMode = 'safety' as const;
  const toolbarToggleRef = useRef<HTMLButtonElement>(null);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const mapStyleToggleRef = useRef<HTMLButtonElement>(null);
  const mapStyleContainerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationButtonRef = useRef<HTMLDivElement>(null);
  const changeDropdownRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Toggle layer with exclusive selection
  const handleToggleLayer = (layer: ActiveMapOverlayLayer) => {
    setActiveLayer((prev) => (prev === layer ? 'none' : layer));
  };

  const closeLayerToolbar = () => {
    setIsToolbarOpen(false);
    setActiveLayer('none');
    setShowLegend(false);
    layersRef.current.highways.clearLayers();
    layersRef.current.incidents.clearLayers();
    layersRef.current.alternatives.clearLayers();
  };

   const handleToggleToolbar = () => {
    if (isToolbarOpen) {
      closeLayerToolbar();
      return;
    }

    setIsToolbarOpen(true);
    setShowMapStyle(false);
    setIsLocationDropdownOpen(false);
  };

   const handleToggleMapStyle = () => {
    if (showMapStyle) {
      setShowMapStyle(false);
      return;
    }

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
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain' | 'territorial' | '3d'>('standard');
  const tileLayerRef = useRef<L.GridLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [27.95, 84.6],
      zoom: 7,
      minZoom: 6,
      maxZoom: 17,
      maxBounds: NEPAL_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      // Hide bottom-right “© OpenStreetMap contributors” label on the map
      attributionControl: false,
    });

    map.fitBounds(NEPAL_BOUNDS, { padding: [0, 0], maxZoom: 8 });

    layersRef.current.highways.addTo(map);
    layersRef.current.cities.addTo(map);
    layersRef.current.incidents.addTo(map);
    layersRef.current.alternatives.addTo(map);
    layersRef.current.route.addTo(map);
    layersRef.current.outsideMask.addTo(map);
    layersRef.current.nepalBorder.addTo(map);
    layersRef.current.provinces.addTo(map);

    mapInstanceRef.current = map;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 500);

    const splashTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 4500);

    const resizeObs = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObs.observe(mapContainerRef.current);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(splashTimer);
      resizeObs.disconnect();
      window.removeEventListener('resize', handleResize);
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
    map.invalidateSize();
    const timer = window.setTimeout(() => {
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

  const detectGpsPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsCoords(null);
      setGpsDetected(false);
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setGpsCoords(null);
        setGpsDetected(false);
        return;
      }

      setGpsCoords({ lat: latitude, lng: longitude });
      setGpsDetected(true);
      placeGpsMarker([latitude, longitude]);
      mapInstanceRef.current?.flyTo([latitude, longitude], 14, { duration: 1.5 });
      setTimeout(() => {
        mapInstanceRef.current?.fitBounds(NEPAL_BOUNDS, { padding: [20, 20], maxZoom: 8 });
      }, 2000);
    };

    const handleError = () => {
      setGpsCoords(null);
      setGpsDetected(false);
      if (markerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };

    const geoOptions: PositionOptions = {
      timeout: 8000,
      maximumAge: 60000,
      enableHighAccuracy: true,
    };

    // Check permission status explicitly.
    // If "granted" — auto-detect silently.
    // If "prompt" — getCurrentPosition shows the browser permission dialog.
    // If "denied" — skip to avoid redundant error.
    if (typeof navigator.permissions !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
          } else if (permissionStatus.state === 'prompt') {
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
          }
          // 'denied': no action — user previously denied.

          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
            }
          };
        })
        .catch(() => {
          // Permissions API not supported — fall back to direct call which will
          // trigger the browser prompt on first use.
          navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
        });
    } else {
      // No Permissions API — direct call triggers browser prompt.
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    }
  }, [placeGpsMarker]);

  useEffect(() => {
    detectGpsPosition();
  }, [detectGpsPosition]);

  // Update tile layer based on mapStyle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    // No CARTO (requires API key). No tile.openstreetmap.org (403 in production).
    // Esri public ArcGIS Online tiles — no API key for standard basemap use.
    let url =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    let attribution = '';
    let maxZoom = 16;
    let subdomains = '';

    if (mapStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
    } else if (mapStyle === 'terrain') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
    } else if (mapStyle === 'territorial') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 16;
    } else if (mapStyle === '3d') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 14;
    }

    const newLayer = createNepalTileLayer(url, attribution, maxZoom, subdomains);

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

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
    mapInstanceRef.current.flyTo([focusedTarget.lat, focusedTarget.lng], focusedTarget.zoom || 11, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [focusedTarget]);

  // Render All 79 Highways Layer (shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const highwaysGroup = layersRef.current.highways;
    highwaysGroup.clearLayers();

    if (activeLayer === 'none') return;

    highwaysList.forEach((highway) => {
      const isSelected = activeHighwayInfo?.code === highway.code;
      const color = isSelected
        ? '#38bdf8'
        : highway.overallStatus === 'clear'
        ? '#10b981'
        : highway.overallStatus === 'caution'
        ? '#f59e0b'
        : '#ef4444';
      const weight = isSelected ? 6 : 3.5;
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
          this.setStyle({ weight: weight + 2.5, opacity: 1.0 });
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
            color,
            weight,
            opacity,
            lineJoin: 'round',
            lineCap: 'round',
          });
          bindHighwayEvents(polyline);
          highwaysGroup.addLayer(polyline);
        });
      } else if (highway.segments && highway.segments.length > 0) {
        highway.segments.forEach((seg) => {
          const segColor = isSelected
            ? '#38bdf8'
            : seg.status === 'clear'
            ? '#10b981'
            : seg.status === 'caution'
            ? '#f59e0b'
            : '#ef4444';
          const polyline = L.polyline(seg.coordinates, {
            color: segColor,
            weight: isSelected ? 6 : seg.lanes >= 4 ? 5 : 3.5,
            opacity,
            lineJoin: 'round',
            lineCap: 'round',
          });
          bindHighwayEvents(polyline);
          highwaysGroup.addLayer(polyline);
        });
      }
    });
  }, [activeLayer, highwaysList, activeHighwayInfo, onSelectHighway]);

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

          const mask = L.polygon(
            [worldCorners, ...holes] as unknown as L.LatLngExpression[][],
            {
              fillColor: '#ffffff',
              fillOpacity: 1.0,
              color: 'transparent',
              weight: 0,
              interactive: false,
            },
          );
          maskGroup.addLayer(mask);
          mask.bringToBack();
          outsideMaskRef.current = mask;

          const border = L.geoJSON(data, {
            style: {
              color: '#b91c1c',
              weight: 2.5,
              opacity: 0.9,
              fillColor: '#7f1d1d',
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
              color: '#f59e0b',
              weight: 1.5,
              opacity: 0.6,
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

    const incidentsList =
      liveIncidents && liveIncidents.length > 0 ? liveIncidents : LIVE_ROAD_INCIDENTS;

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
    if (activeLayer !== 'cities') return;
    const citiesGroup = layersRef.current.cities;
    citiesGroup.clearLayers();

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

    // 1. Render Alternative Routes (if enabled and present)
    if (activeLayer === 'alternatives' && activeRoute.allRouteOptions && activeRoute.allRouteOptions.length > 1) {
      const altOptions = activeRoute.allRouteOptions.filter((opt) => opt.id !== activeRoute.id);

      altOptions.forEach((altOpt) => {
        if (!altOpt.pathCoordinates || altOpt.pathCoordinates.length === 0) return;

        const color = altOpt.routeColor || '#a855f7';
        altOpt.pathCoordinates.forEach((c) => bounds.extend(c));

        // Soft ambient glow
        const altGlow = L.polyline(altOpt.pathCoordinates, {
          color,
          weight: 8,
          opacity: 0.25,
        });

        // Dashed alternative polyline
        const altLine = L.polyline(altOpt.pathCoordinates, {
          color,
          weight: 5,
          opacity: 0.75,
          dashArray: '8, 8',
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
                <span style="color: ${color};">${altOpt.totalDistanceKm} km</span>
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

    // 2. Render Main Active Route (Multi-Segment Safety Color-Coded or Single Preference)
    activeRoute.pathCoordinates.forEach((c) => bounds.extend(c));

    const isSafetyMode = routeColorMode === 'safety';
    const hasStepsSafety = activeRoute.steps && activeRoute.steps.length > 0;

    if (isSafetyMode && hasStepsSafety) {
      // Multi-segment Highway Safety Index Color-Coding
      activeRoute.steps.forEach((step, idx) => {
        const stepCoords: [number, number][] = step.coordinates && step.coordinates.length > 1
          ? step.coordinates
          : (step.from && step.to && typeof step.from.lat === 'number' && typeof step.to.lat === 'number')
          ? [
              [step.from.lat, step.from.lng] as [number, number],
              [step.to.lat, step.to.lng] as [number, number],
            ]
          : [];

        if (stepCoords.length < 2) return;

        const safetyData = step.safetyData;
        const segmentColor = safetyData?.color || (step.roadConditionScore >= 80 ? '#10b981' : step.roadConditionScore >= 60 ? '#f59e0b' : '#ef4444');
        const safetyScore = safetyData?.safetyScore ?? step.roadConditionScore;
        const safetyTier = safetyData?.safetyTier ?? (safetyScore >= 80 ? 'high_safety' : safetyScore >= 60 ? 'moderate_caution' : 'elevated_risk');

        // Segment glow
        const segGlow = L.polyline(stepCoords, {
          color: segmentColor,
          weight: 14,
          opacity: 0.35,
          lineJoin: 'round',
          lineCap: 'round',
        });

        // Core polyline
        const segLine = L.polyline(stepCoords, {
          color: segmentColor,
          weight: 7,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
        });

        // Interactive Segment Tooltip
        segLine.bindTooltip(
          `<strong>${step.from.name} ➔ ${step.to.name}</strong><br/><span style="color:${segmentColor}">Safety Index: ${safetyScore}/100 (${safetyTier.replace('_', ' ')})</span>`,
          { className: 'custom-dark-tooltip', sticky: true }
        );

        segLine.on('mouseover', () => {
          segLine.setStyle({ weight: 9, opacity: 1 });
        });
        segLine.on('mouseout', () => {
          segLine.setStyle({ weight: 7, opacity: 0.95 });
        });

        routeGroup.addLayer(segGlow);
        routeGroup.addLayer(segLine);
      });

      // Subtle animated dash-offset flow line representing movement along the route
      const animatedFlow = L.polyline(activeRoute.pathCoordinates, {
        color: '#ffffff',
        weight: 3.5,
        opacity: 0.8,
        dashArray: '10, 14',
        className: 'animated-route-flow',
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      });
      routeGroup.addLayer(animatedFlow);
    } else {
      // Single unified route polyline
      const activeColor = activeRoute.routeColor || '#38bdf8';

      const routeGlow = L.polyline(activeRoute.pathCoordinates, {
        color: activeColor,
        weight: 14,
        opacity: 0.35,
        lineJoin: 'round',
        lineCap: 'round',
      });

      const routePolyline = L.polyline(activeRoute.pathCoordinates, {
        color: activeColor,
        weight: 7,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      });

      // Subtle animated dash-offset flow line representing movement along the route
      const animatedFlow = L.polyline(activeRoute.pathCoordinates, {
        color: '#ffffff',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '10, 14',
        className: 'animated-route-flow',
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      });

      routeGroup.addLayer(routeGlow);
      routeGroup.addLayer(routePolyline);
      routeGroup.addLayer(animatedFlow);
    }

    // Subtle aerial direct line connecting origin to destination
    if (activeRoute.origin && activeRoute.destination) {
      const aerialLine = L.polyline(
        [[activeRoute.origin.lat, activeRoute.origin.lng], [activeRoute.destination.lat, activeRoute.destination.lng]],
        {
          color: '#94a3b8',
          weight: 2,
          opacity: 0.45,
          dashArray: '6, 10',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      );
      routeGroup.addLayer(aerialLine);
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

    // Start Origin Marker
    const startCoord = activeRoute.pathCoordinates[0];
    const startIcon = L.divIcon({
      className: 'route-start-marker',
      html: `
        <div style="background: #10b981; border: 2px solid #ffffff; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 8px #10b981; display: flex; align-items: center; justify-content: center; color: #020617; font-size: 11px; font-weight: 900;">
          A
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const startMarker = L.marker(startCoord, { icon: startIcon }).bindTooltip(
      `<strong>Start:</strong> ${activeRoute.origin.name}`,
      { direction: 'top', className: 'custom-dark-tooltip' }
    );

    // End Destination Marker
    const endCoord = activeRoute.pathCoordinates[activeRoute.pathCoordinates.length - 1];
    const endIcon = L.divIcon({
      className: 'route-end-marker',
      html: `
        <div style="background: #f43f5e; border: 2px solid #ffffff; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 8px #f43f5e; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; font-weight: 900;">
          B
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const endMarker = L.marker(endCoord, { icon: endIcon }).bindTooltip(
      `<strong>Destination:</strong> ${activeRoute.destination.name}`,
      { direction: 'top', className: 'custom-dark-tooltip' }
    );

    routeGroup.addLayer(startMarker);
    routeGroup.addLayer(endMarker);

    // Fit map smoothly to encompass active and alternative route paths
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 11.5,
        animate: true,
        duration: 1.2,
      });
    }
  }, [activeRoute, activeLayer, routeColorMode, onSelectAlternativeRoute, onSelectBlackspot]);

  const hasAlternatives = activeRoute?.allRouteOptions && activeRoute.allRouteOptions.length > 1;

   const handleMyLocation = () => {
    if (gpsDetected) {
      setIsLocationDropdownOpen((open) => !open);
      if (!isLocationDropdownOpen) {
        setIsToolbarOpen(false);
        setActiveLayer('none');
        setShowLegend(false);
        setShowMapStyle(false);
        layersRef.current.highways.clearLayers();
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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/90 shadow-2xl bg-slate-950">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" id="nepal-gis-canvas" />

      {/* Dimming overlay when no route */}
      {isDimmed && (
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] z-[500] pointer-events-none" />
      )}

      {/* My Location GPS Button */}
      <div
        ref={locationButtonRef}
        className="absolute top-3 right-3 z-[1000] flex flex-col items-end"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleMyLocation}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-2xl shadow-black/50 transition ${
            gpsDetected
              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20 hover:bg-emerald-900/90'
              : 'bg-slate-950/90 hover:bg-slate-900 text-sky-300 border-sky-500/40'
          }`}
          title={gpsDetected ? 'My Location detected' : 'My Location'}
          aria-label={gpsDetected ? 'My Location detected' : 'Detect My Location'}
          aria-expanded={gpsDetected && isLocationDropdownOpen}
          id="btn-my-location-gps"
        >
          {gpsDetected ? <LocateFixed className="w-4 h-4" /> : <Locate className="w-4 h-4" />}
        </button>

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

      {/* Map Style Selector */}
      {showMapStyle && (
        <div ref={mapStyleContainerRef} className="absolute top-3 right-28 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl p-1 shadow-2xl shadow-black/50 animate-fadeIn">
          <button
            type="button"
            onClick={() => { setMapStyle('standard'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'standard' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Standard"
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('satellite'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'satellite' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Satellite"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('terrain'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === 'terrain' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Terrain"
          >
            <Mountain className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('3d'); setShowMapStyle(false); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${mapStyle === '3d' ? 'bg-accent-bg accent-text accent-border shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="3D Terrain"
          >
            <Box className="w-4 h-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        ref={mapStyleToggleRef}
        onClick={handleToggleMapStyle}
        className={`absolute top-3 right-28 z-[1000] w-9 h-9 rounded-full flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${showMapStyle ? 'bg-slate-950/90 text-emerald-400 border-emerald-500/50 rotate-90' : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white'}`}
        title="Map Style"
        id="btn-map-style-toggle"
      >
        <Globe className="w-4 h-4" />
      </button>

      {/* Layer Toolbar - vertical stack top-to-bottom */}
      {isToolbarOpen && (
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
            <Route className="w-4 h-4" />
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
            <AlertTriangle className="w-4 h-4" />
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
            <Building className="w-4 h-4" />
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
              <Repeat className="w-4 h-4" />
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
            <Info className="w-4 h-4" />
              <span className="text-[10px] font-bold">Legend</span>
          </button>
        </div>
      )}

      {/* Toolbar toggle button */}
      <button
        type="button"
        ref={toolbarToggleRef}
        onClick={handleToggleToolbar}
        className={`absolute top-3 right-16 z-[1000] w-9 h-9 rounded-full flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${
          isToolbarOpen
            ? 'bg-accent-bg accent-text accent-border shadow-black/10'
            : 'bg-slate-950/90 accent-text border-slate-800 hover:border-slate-600'
        }`}
        title="Layers"
        id="toggle-toolbar-collapse"
      >
        <Layers className={`w-4 h-4 ${isToolbarOpen ? 'rotate-90 accent-text' : 'accent-text'} transition-transform`} />
      </button>

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
        <div className="p-3.5 space-y-3 max-h-80 overflow-y-auto custom-scrollbar text-xs">
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

      {/* Custom Zoom Controls — bottom-right column, horizontal, right-to-left */}
      <div className="absolute bottom-4 right-16 z-[1000] flex flex-row-reverse items-center rounded-lg border border-slate-700/60 bg-slate-950/80 overflow-hidden shadow-lg shadow-black/30">
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="px-3 py-1.5 text-xs text-white hover:bg-slate-700/80 transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          +
        </button>
        <div className="w-px h-5 bg-slate-700/60" />
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="px-3 py-1.5 text-xs text-white hover:bg-slate-700/80 transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          −
        </button>
      </div>

    </div>
  );
};
