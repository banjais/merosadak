import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Highway,
  CityNode,
  RoadIncident,
  RoutePlanResult,
  HighwayPOI,
  TrafficCorridor,
  KnownBlackspot,
  SegmentSafetyData,
  HighwayWeatherNode,
} from '../types';
import {
  NEPAL_HIGHWAYS,
  CITIES_AND_JUNCTIONS,
  LIVE_ROAD_INCIDENTS,
  HIGHWAY_POIS,
  TRAFFIC_CORRIDORS,
  HIGHWAY_WEATHER_NODES,
} from '../data/nepalHighwaysData';
import { loadAll79Highways } from '../utils/nepalHighwayDataLoader';
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
  Fuel,
  Utensils,
  Mountain,
  Ticket,
  ShieldAlert,
  Gauge,
  Map as MapIcon,
  Globe,
  Locate,
  X,
  Info,
  CloudRain,
} from 'lucide-react';

interface InteractiveMapProps {
  activeRoute: RoutePlanResult | null;
  onSelectAlternativeRoute?: (route: RoutePlanResult) => void;
  onSelectCity?: (city: CityNode, type: 'origin' | 'destination') => void;
  onSelectHighway?: (highway: Highway) => void;
  onSelectBlackspot?: (blackspot: KnownBlackspot) => void;
  weatherNodes?: HighwayWeatherNode[];
  onSelectWeatherNode?: (node: HighwayWeatherNode) => void;
  selectedWeatherNodeId?: string | null;
  focusedTarget?: { lat: number; lng: number; title: string; zoom?: number } | null;
  colorMode?: 'safety' | 'preference';
  onToggleColorMode?: (mode: 'safety' | 'preference') => void;
  liveIncidents?: RoadIncident[];
  livePOIs?: HighwayPOI[];
  liveTrafficCorridors?: TrafficCorridor[];
}

export type ActiveMapOverlayLayer =
  | 'none'
  | 'highways'
  | 'weather'
  | 'incidents'
  | 'traffic'
  | 'pois'
  | 'alternatives';

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  activeRoute,
  onSelectAlternativeRoute,
  onSelectCity,
  onSelectHighway,
  onSelectBlackspot,
  weatherNodes,
  onSelectWeatherNode,
  selectedWeatherNodeId,
  focusedTarget,
  colorMode: externalColorMode,
  onToggleColorMode: externalToggleColorMode,
  liveIncidents,
  livePOIs,
  liveTrafficCorridors,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    highways: L.LayerGroup;
    cities: L.LayerGroup;
    incidents: L.LayerGroup;
    pois: L.LayerGroup;
    traffic: L.LayerGroup;
    blackspots: L.LayerGroup;
    weather: L.LayerGroup;
    route: L.LayerGroup;
    alternatives: L.LayerGroup;
    offlineOverlay: L.LayerGroup;
  }>({
    highways: L.layerGroup(),
    cities: L.layerGroup(),
    incidents: L.layerGroup(),
    pois: L.layerGroup(),
    traffic: L.layerGroup(),
    blackspots: L.layerGroup(),
    weather: L.layerGroup(),
    route: L.layerGroup(),
    alternatives: L.layerGroup(),
    offlineOverlay: L.layerGroup(),
  });

  // Mutually Exclusive Overlay Layer Selection
  // Defaults to 'weather' so interactive weather markers for mountain passes are immediately rendered on the map.
  // When another layer toggle is clicked, it switches; toggling the active layer hides it.
  // When the layer toolbar is closed, all showing layers are closed.
  const [activeLayer, setActiveLayer] = useState<ActiveMapOverlayLayer>('weather');
  const [showLegend, setShowLegend] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);

  // Weather markers reference for programmatic open/toggle of detailed weather popups
  const weatherMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const showCities = false;
  const showBlackspots = false;
  const routeColorMode = 'safety' as const;

  // Toggle layer with exclusive selection
  const handleToggleLayer = (layer: ActiveMapOverlayLayer) => {
    setActiveLayer((prev) => (prev === layer ? 'none' : layer));
  };

  // Toggle toolbar: when closed, close all showing layers immediately
  const handleToggleToolbar = () => {
    setIsToolbarOpen((prev) => {
      const next = !prev;
      if (!next) {
        // Close all showing layers and legend
        setActiveLayer('none');
        setShowLegend(false);
        layersRef.current.highways.clearLayers();
        layersRef.current.weather.clearLayers();
        layersRef.current.incidents.clearLayers();
        layersRef.current.pois.clearLayers();
        layersRef.current.traffic.clearLayers();
        layersRef.current.alternatives.clearLayers();
      }
      return next;
    });
  };

  // 79 Highways state loaded from GeoJSON dataset
  const [highwaysList, setHighwaysList] = useState<Highway[]>(NEPAL_HIGHWAYS);
  const [activeHighwayInfo, setActiveHighwayInfo] = useState<Highway | null>(null);

  // Load all 79 National Highways
  useEffect(() => {
    let isMounted = true;
    loadAll79Highways().then((data) => {
      if (isMounted && data && data.length > 0) {
        setHighwaysList(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Map Style: Standard, Satellite, Terrain
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [27.95, 84.6],
      zoom: 7,
      minZoom: 6,
      maxZoom: 17,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    layersRef.current.highways.addTo(map);
    layersRef.current.weather.addTo(map);
    layersRef.current.incidents.addTo(map);
    layersRef.current.pois.addTo(map);
    layersRef.current.traffic.addTo(map);
    layersRef.current.alternatives.addTo(map);
    layersRef.current.route.addTo(map);
    layersRef.current.offlineOverlay.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tile layer based on mapStyle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    let attribution = '&copy; <a href="https://carto.com/">CARTO</a> | DOR Nepal Highway GIS';
    let maxZoom = 19;

    if (mapStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (mapStyle === 'terrain') {
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)';
      maxZoom = 17;
    }

    const newLayer = L.tileLayer(url, {
      attribution,
      subdomains: mapStyle === 'standard' ? 'abcd' : 'abc',
      maxZoom,
    });

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

    if (activeLayer !== 'highways') return;

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

  // Render Cached Offline Geographical Bounds Overlay
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const offlineGroup = layersRef.current.offlineOverlay;
    offlineGroup.clearLayers();

    // Nepal Bounding Box covered by cached offline pack (Lat: 26.3 to 30.5, Lng: 80.0 to 88.3)
    // Plus key mountain corridor buffers
    const nepalOfflineBounds: [number, number][] = [
      [26.3, 80.0],
      [26.3, 88.3],
      [30.5, 88.3],
      [30.5, 80.0],
    ];

    // Semi-transparent emerald offline availability polygon
    const offlinePolygon = L.polygon(nepalOfflineBounds, {
      color: '#10b981',
      weight: 2,
      opacity: 0.6,
      fillColor: '#10b981',
      fillOpacity: 0.12,
      dashArray: '6, 6',
    });

    offlineGroup.addLayer(offlinePolygon);
  }, []);

  // Render Live Traffic Corridors Layer (shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const trafficGroup = layersRef.current.traffic;
    trafficGroup.clearLayers();

    if (activeLayer !== 'traffic') return;

    const corridorsList =
      liveTrafficCorridors && liveTrafficCorridors.length > 0
        ? liveTrafficCorridors
        : TRAFFIC_CORRIDORS;

    corridorsList.forEach((corridor) => {
      const color =
        corridor.level === 'smooth'
          ? '#10b981'
          : corridor.level === 'moderate'
          ? '#f59e0b'
          : corridor.level === 'heavy'
          ? '#f97316'
          : '#ef4444';

      const polyline = L.polyline([corridor.startCoord, corridor.endCoord], {
        color,
        weight: 8,
        opacity: 0.6,
        dashArray: corridor.level === 'standstill' ? '5, 10' : undefined,
      });

      polyline.bindPopup(`
        <div class="space-y-1.5 text-xs font-sans">
          <div class="flex items-center justify-between font-bold border-b border-slate-700 pb-1">
            <span class="text-amber-400 font-bold">${corridor.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono">${corridor.highwayCode}</span>
          </div>
          <div class="text-slate-300 font-medium">${corridor.section}</div>
          <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-900 p-2 rounded mt-1 border border-slate-800">
            <div>Avg Speed: <strong class="text-cyan-400">${corridor.avgSpeedKmh} km/h</strong></div>
            <div>Delay: <strong class="text-rose-400">+${corridor.delayMinutes} mins</strong></div>
          </div>
          <p class="text-slate-400 text-[11px] mt-1">${corridor.cause}</p>
        </div>
      `);

      trafficGroup.addLayer(polyline);
    });
  }, [activeLayer, liveTrafficCorridors]);

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

      marker.bindPopup(`
        <div class="space-y-1.5 text-xs font-sans">
          <div class="flex items-center justify-between font-bold border-b border-slate-700 pb-1">
            <span class="text-rose-400 font-bold">${inc.title}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 uppercase font-mono">${inc.severity}</span>
          </div>
          <div class="text-slate-200 font-medium">${inc.locationName} (${inc.highwayCode})</div>
          <p class="text-slate-300 text-[11px]">${inc.description}</p>
          <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
            <span>Status: <strong class="text-amber-400 capitalize">${inc.status}</strong></span>
            <span class="font-mono text-slate-400">${inc.reportedAt}</span>
          </div>
        </div>
      `);

      incidentsGroup.addLayer(marker);
    });
  }, [activeLayer, liveIncidents]);



  // Render POIs Layer (shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const poisGroup = layersRef.current.pois;
    poisGroup.clearLayers();

    if (activeLayer !== 'pois') return;

    const poisList = livePOIs && livePOIs.length > 0 ? livePOIs : HIGHWAY_POIS;

    poisList.forEach((poi) => {
      let iconEmoji = '📍';
      let bgColor = 'bg-cyan-600 border-cyan-300';
      if (poi.category === 'ev_charger') {
        iconEmoji = '⚡';
        bgColor = 'bg-cyan-600 border-cyan-300';
      } else if (poi.category === 'food_rest') {
        iconEmoji = '🍲';
        bgColor = 'bg-amber-600 border-amber-300';
      } else if (poi.category === 'fuel_station') {
        iconEmoji = '⛽';
        bgColor = 'bg-emerald-600 border-emerald-300';
      } else if (poi.category === 'scenic_pass') {
        iconEmoji = '🏔️';
        bgColor = 'bg-purple-600 border-purple-300';
      } else if (poi.category === 'emergency_dor') {
        iconEmoji = '🚨';
        bgColor = 'bg-rose-600 border-rose-300';
      } else if (poi.category === 'toll_plaza') {
        iconEmoji = '🎟️';
        bgColor = 'bg-blue-600 border-blue-300';
      }

      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer">
          <div class="w-6 h-6 ${bgColor} rounded-full flex items-center justify-center shadow-md border text-[11px]">
            ${iconEmoji}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-poi-marker',
        html: markerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([poi.lat, poi.lng], { icon });

      marker.bindPopup(`
        <div class="space-y-1.5 text-xs font-sans">
          <div class="flex items-center justify-between font-bold border-b border-slate-700 pb-1">
            <span class="text-teal-400 font-bold">${poi.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono">${poi.highwayCode}</span>
          </div>
          <div class="text-slate-300 text-[11px]">${poi.locationName}</div>
          <div class="text-[10px] text-slate-400">Category: <strong class="text-amber-300 capitalize">${poi.category.replace('_', ' ')}</strong></div>
          ${poi.details ? `<p class="text-slate-300 text-[10px] mt-1">${poi.details}</p>` : ''}
        </div>
      `);

      poisGroup.addLayer(marker);
    });
  }, [activeLayer, livePOIs]);

  // Render Cities Layer (Only cities lying on Nepal highways or chosen route)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const citiesGroup = layersRef.current.cities;
    citiesGroup.clearLayers();

    if (!showCities) return;

    CITIES_AND_JUNCTIONS.forEach((city) => {
      // Check if city lies on any highway segment or has connected highways
      const liesOnHighway = NEPAL_HIGHWAYS.some((highway) =>
        highway.segments.some(
          (seg) =>
            seg.from.toLowerCase().includes(city.name.toLowerCase()) ||
            seg.to.toLowerCase().includes(city.name.toLowerCase()) ||
            city.name.toLowerCase().includes(seg.from.toLowerCase()) ||
            city.name.toLowerCase().includes(seg.to.toLowerCase())
        ) ||
        (city.connectedHighways && city.connectedHighways.length > 0)
      );

      const isInRoute = activeRoute && (
        activeRoute.originCityId === city.id ||
        activeRoute.destCityId === city.id ||
        (activeRoute.routePath && activeRoute.routePath.some(pt => Math.abs(pt.lat - city.lat) < 0.12 && Math.abs(pt.lng - city.lng) < 0.12)) ||
        (activeRoute.pathCoordinates && activeRoute.pathCoordinates.some(coord => Math.abs(coord[0] - city.lat) < 0.15 && Math.abs(coord[1] - city.lng) < 0.15)) ||
        (activeRoute.steps && activeRoute.steps.some(step => 
          (step.from && step.from.id === city.id) ||
          (step.to && step.to.id === city.id) ||
          (step.from && Math.abs(step.from.lat - city.lat) < 0.15 && Math.abs(step.from.lng - city.lng) < 0.15) ||
          (step.to && Math.abs(step.to.lat - city.lat) < 0.15 && Math.abs(step.to.lng - city.lng) < 0.15)
        ))
      );

      // Only display city if it lies on a highway network or is part of the user's chosen route
      if (activeRoute) {
        if (!isInRoute) return;
      } else {
        if (!liesOnHighway) return;
      }

      const isHub = city.isMajorHub;
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <div class="${
            isHub ? 'w-3.5 h-3.5 bg-emerald-500 ring-4 ring-emerald-500/20' : 'w-2.5 h-2.5 bg-slate-400 ring-2 ring-slate-600'
          } rounded-full shadow-md"></div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-slate-800 whitespace-nowrap pointer-events-none">
            ${city.name}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-city-marker',
        html: markerHtml,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([city.lat, city.lng], { icon });

      marker.on('click', () => {
        if (onSelectCity) onSelectCity(city, 'origin');
      });

      citiesGroup.addLayer(marker);
    });
  }, [showCities, activeRoute, onSelectCity]);

  // Render Weather Nodes Layer (Mountain Passes & Highway Met Nodes - shows everywhere across Nepal when selected)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const weatherGroup = layersRef.current.weather;
    weatherGroup.clearLayers();
    weatherMarkersRef.current.clear();

    if (activeLayer !== 'weather') return;

    const nodesToRender =
      weatherNodes && weatherNodes.length > 0 ? weatherNodes : HIGHWAY_WEATHER_NODES;

    nodesToRender.forEach((node) => {
      const isSelected = selectedWeatherNodeId === node.id;

      // Determine condition emoji & styling
      let conditionEmoji = '🌤️';
      let conditionName = 'Partly Cloudy';
      let badgeBorderColor = '#38bdf8';
      let badgeBg = 'rgba(15, 23, 42, 0.95)';

      switch (node.condition) {
        case 'thunderstorm':
          conditionEmoji = '⛈️';
          conditionName = 'Severe Thunderstorm';
          badgeBorderColor = '#ef4444';
          badgeBg = 'rgba(69, 10, 10, 0.95)';
          break;
        case 'rain_monsoon':
          conditionEmoji = '🌧️';
          conditionName = 'Monsoon Downpour';
          badgeBorderColor = '#3b82f6';
          badgeBg = 'rgba(15, 23, 42, 0.95)';
          break;
        case 'mountain_shower':
          conditionEmoji = '🌦️';
          conditionName = 'Mountain Shower';
          badgeBorderColor = '#06b6d4';
          badgeBg = 'rgba(15, 23, 42, 0.95)';
          break;
        case 'dense_fog':
          conditionEmoji = '🌫️';
          conditionName = 'Dense Mountain Fog';
          badgeBorderColor = '#f59e0b';
          badgeBg = 'rgba(69, 26, 3, 0.95)';
          break;
        case 'cloudy':
          conditionEmoji = '⛅';
          conditionName = 'Overcast / Cloudy';
          badgeBorderColor = '#94a3b8';
          badgeBg = 'rgba(15, 23, 42, 0.95)';
          break;
        case 'sunny':
        default:
          conditionEmoji = '☀️';
          conditionName = 'Sunny & Clear';
          badgeBorderColor = '#10b981';
          badgeBg = 'rgba(6, 78, 59, 0.95)';
          break;
      }

      if (node.landslideRisk === 'severe' || node.landslideRisk === 'high') {
        badgeBorderColor = '#ef4444';
      }

      // Format Road Grip Badge
      let gripBadge = { text: 'DRY ROAD (EXCELLENT)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      if (node.roadGrip === 'mud_slippery') {
        gripBadge = { text: 'MUD SLIPPERY (4WD REC)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      } else if (node.roadGrip === 'fog_low_visibility') {
        gripBadge = { text: 'FOG / LOW TRACTION', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      } else if (node.roadGrip === 'wet_caution') {
        gripBadge = { text: 'WET ASPHALT (CAUTION)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
      }

      // Format Landslide Risk Badge
      let landslideBadge = { text: 'LOW RISK', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      if (node.landslideRisk === 'severe') {
        landslideBadge = { text: 'SEVERE HAZARD', color: 'bg-rose-600/30 text-rose-300 border-rose-500/60' };
      } else if (node.landslideRisk === 'high') {
        landslideBadge = { text: 'HIGH HAZARD', color: 'bg-orange-500/20 text-orange-300 border-orange-500/50' };
      } else if (node.landslideRisk === 'moderate') {
        landslideBadge = { text: 'MODERATE RISK', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      }

      const iconHtml = `
        <div class="relative flex flex-col items-center group cursor-pointer transition-transform" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));">
          ${
            isSelected
              ? '<div class="absolute -inset-2 rounded-2xl bg-cyan-400/40 animate-ping pointer-events-none"></div>'
              : ''
          }
          <div style="background-color: ${badgeBg}; border-color: ${badgeBorderColor};"
            class="px-2.5 py-1 rounded-xl border-2 backdrop-blur-md flex items-center space-x-1.5 transition-transform transform group-hover:scale-110 shadow-lg ${
              isSelected ? 'ring-2 ring-cyan-300 scale-105' : ''
            }">
            <span class="text-xs leading-none">${conditionEmoji}</span>
            <span class="text-[11px] font-black text-white leading-none">${node.tempC}°C</span>
            <span class="text-[9px] font-mono text-cyan-300 bg-slate-900/90 px-1.5 py-0.5 rounded leading-none border border-slate-700/80 font-bold">${node.elevationM}m</span>
          </div>
          <div class="w-1.5 h-1.5 rounded-full mt-0.5 shadow-sm" style="background-color: ${badgeBorderColor};"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-weather-marker',
        iconSize: [92, 38],
        iconAnchor: [46, 38],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });

      // Interactive Quick Tooltip
      marker.bindTooltip(
        `<div class="p-2 text-xs font-sans max-w-xs">
          <div class="font-bold text-white flex items-center justify-between gap-2">
            <span class="text-sm font-black">${node.name}</span>
            <span class="text-[10px] text-cyan-300 font-mono font-bold px-1.5 py-0.5 bg-slate-900 rounded border border-slate-700">⛰️ ${node.elevationM}m ASL</span>
          </div>
          <div class="text-slate-300 text-[11px] mt-0.5">${node.nepaliName} &bull; <span class="text-emerald-400 font-semibold">${node.highwayCode}</span></div>
          <div class="mt-2 flex items-center gap-2 text-[10px] flex-wrap">
            <span class="text-amber-300 font-bold px-1.5 py-0.5 bg-amber-500/10 rounded">${conditionEmoji} ${node.tempC}°C (${conditionName})</span>
            <span class="text-sky-300 font-medium px-1.5 py-0.5 bg-sky-500/10 rounded">💧 ${node.rainProbabilityPercent}% Rain</span>
            <span class="px-1.5 py-0.5 rounded font-bold uppercase ${
              node.landslideRisk === 'severe' || node.landslideRisk === 'high'
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                : 'bg-amber-500/20 text-amber-300'
            }">${node.landslideRisk} Hazard</span>
          </div>
          <div class="text-[10px] text-sky-400 mt-2 font-bold flex items-center space-x-1">
            <span>👉 Click to toggle detailed pass weather popup</span>
          </div>
        </div>`,
        { sticky: true, className: 'custom-dark-tooltip', direction: 'top' }
      );

      // Detailed Interactive Weather Report Popup for Mountain Passes
      const popupContent = `
        <div class="p-3.5 text-slate-100 font-sans max-w-[310px] text-xs space-y-2.5">
          <!-- Pass Identification Header -->
          <div class="flex items-start justify-between border-b border-slate-700/80 pb-2.5 gap-2">
            <div>
              <div class="flex items-center space-x-1.5 flex-wrap gap-1 mb-1">
                <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40">
                  ${node.highwayCode}
                </span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                  ⛰️ ${node.elevationM}m ASL
                </span>
              </div>
              <h4 class="font-black text-sm text-white leading-tight">${node.name}</h4>
              <div class="text-[11px] text-slate-400 mt-0.5">${node.nepaliName}</div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-2xl leading-none block">${conditionEmoji}</span>
              <div class="text-base font-black text-white leading-tight mt-0.5">${node.tempC}°C</div>
              <div class="text-[9px] text-slate-400 font-medium">${conditionName}</div>
            </div>
          </div>

          <!-- Safety & Grip Badges -->
          <div class="grid grid-cols-2 gap-1.5 text-[10px]">
            <div class="p-1.5 rounded-lg border ${landslideBadge.color} flex flex-col justify-center">
              <span class="text-[9px] text-slate-400 uppercase font-semibold">Landslide Hazard</span>
              <span class="font-black tracking-wide">${landslideBadge.text}</span>
            </div>
            <div class="p-1.5 rounded-lg border ${gripBadge.color} flex flex-col justify-center">
              <span class="text-[9px] text-slate-400 uppercase font-semibold">Road Surface Grip</span>
              <span class="font-black tracking-wide">${gripBadge.text}</span>
            </div>
          </div>

          <!-- Meteorological Telemetry 4-Card Grid -->
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
              <div>
                <div class="text-[10px] text-slate-400">🌧️ Rain Prob.</div>
                <div class="font-black text-sky-300 text-xs mt-0.5">${node.rainProbabilityPercent}%</div>
              </div>
              <div class="w-1.5 h-6 rounded-full bg-slate-700 overflow-hidden">
                <div class="bg-sky-400 h-full" style="height: ${node.rainProbabilityPercent}%;"></div>
              </div>
            </div>
            <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div class="text-[10px] text-slate-400">💧 Humidity</div>
              <div class="font-black text-slate-200 text-xs mt-0.5">${node.humidityPercent}%</div>
            </div>
            <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div class="text-[10px] text-slate-400">💨 Wind Speed</div>
              <div class="font-black text-slate-200 text-xs mt-0.5">${node.windSpeedKmh} km/h</div>
            </div>
            <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div class="text-[10px] text-slate-400">👁️ Visibility</div>
              <div class="font-black ${node.visibilityKm <= 2.0 ? 'text-amber-400' : 'text-slate-200'} text-xs mt-0.5">
                ${node.visibilityKm} km ${node.visibilityKm <= 2.0 ? '⚠️' : ''}
              </div>
            </div>
          </div>

          <!-- Field Pass Condition Advisory -->
          <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] leading-relaxed text-slate-300">
            <div class="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <span>⚠️ Field Pass Advisory:</span>
            </div>
            <p class="italic text-slate-200">"${node.summary}"</p>
          </div>

          <!-- Origin / Destination Quick Route Buttons -->
          <div class="flex items-center space-x-1.5 pt-1">
            <button
              type="button"
              class="wx-popup-set-origin flex-1 py-1.5 px-2 bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 rounded-lg text-[10px] font-bold border border-slate-700 hover:border-emerald-500/50 transition text-center cursor-pointer"
              title="Set this mountain pass as route departure"
            >
              📍 Set Origin
            </button>
            <button
              type="button"
              class="wx-popup-set-dest flex-1 py-1.5 px-2 bg-slate-800 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 rounded-lg text-[10px] font-bold border border-slate-700 hover:border-rose-500/50 transition text-center cursor-pointer"
              title="Set this mountain pass as route destination"
            >
              🏁 Set Dest
            </button>
            <button
              type="button"
              class="wx-popup-close-btn px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold border border-slate-700 transition cursor-pointer"
              title="Close weather popup"
            >
              ✕
            </button>
          </div>

          <!-- Telemetry Footer -->
          <div class="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>⏱️ Updated ${node.lastUpdated}</span>
            <span class="text-cyan-400 font-semibold">Nepal DoHM Telemetry</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'custom-weather-popup',
        autoClose: true,
        closeOnClick: false,
        closeButton: true,
        maxWidth: 320,
        minWidth: 280,
      });

      // Hook up toggle on click:
      // Leaflet's default bindPopup click handler always calls _openPopup without closing if open.
      // We detach Leaflet's internal _openPopup click listener and implement clean toggle:
      marker.off('click', (marker as any)._openPopup);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (marker.isPopupOpen()) {
          marker.closePopup();
        } else {
          marker.openPopup();
        }
        if (onSelectWeatherNode) {
          onSelectWeatherNode(node);
        }
      });

      // Bind interactive button listeners once popup opens in DOM
      marker.on('popupopen', (e) => {
        const popupEl = e.popup.getElement();
        if (popupEl) {
          const closeBtn = popupEl.querySelector('.wx-popup-close-btn');
          if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              marker.closePopup();
            });
          }

          const originBtn = popupEl.querySelector('.wx-popup-set-origin');
          if (originBtn && onSelectCity) {
            originBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              onSelectCity(
                {
                  id: node.id,
                  name: node.name,
                  nepaliName: node.nepaliName,
                  lat: node.lat,
                  lng: node.lng,
                  elevationM: node.elevationM,
                  highwayCode: node.highwayCode,
                },
                'origin'
              );
              marker.closePopup();
            });
          }

          const destBtn = popupEl.querySelector('.wx-popup-set-dest');
          if (destBtn && onSelectCity) {
            destBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              onSelectCity(
                {
                  id: node.id,
                  name: node.name,
                  nepaliName: node.nepaliName,
                  lat: node.lat,
                  lng: node.lng,
                  elevationM: node.elevationM,
                  highwayCode: node.highwayCode,
                },
                'destination'
              );
              marker.closePopup();
            });
          }
        }
      });

      weatherMarkersRef.current.set(node.id, marker);
      weatherGroup.addLayer(marker);
    });
  }, [activeLayer, weatherNodes, selectedWeatherNodeId, onSelectWeatherNode, onSelectCity]);

  // Programmatically open/toggle popup when a mountain pass is selected externally (e.g. sidebar or route plan)
  useEffect(() => {
    if (!selectedWeatherNodeId) return;
    if (activeLayer !== 'weather') {
      setActiveLayer('weather');
    }
    const targetMarker = weatherMarkersRef.current.get(selectedWeatherNodeId);
    if (targetMarker && mapInstanceRef.current) {
      if (!targetMarker.isPopupOpen()) {
        targetMarker.openPopup();
      }
    }
  }, [selectedWeatherNodeId, activeLayer]);

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
              <div style="background: rgba(15, 23, 42, 0.9); border: 1.5px solid ${color}; color: #ffffff; padding: 2px 7px; border-radius: 8px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); cursor: pointer; display: flex; items-center; gap: 4px;">
                <span>${altOpt.routeBadge || 'Alt'}</span>
                <span style="color: #94a3b8; font-weight: 600;">•</span>
                <span style="color: ${color};">${altOpt.totalDistanceKm} km</span>
              </div>
            `,
            iconSize: [110, 24],
            iconAnchor: [55, 12],
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

        // Detailed Segment Popup
        const segPopupContent = `
          <div style="font-family: system-ui, sans-serif; color: #f8fafc; padding: 2px; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 800; background: ${segmentColor}25; color: ${segmentColor}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${segmentColor}60; text-transform: uppercase;">
                ${safetyTier.replace('_', ' ')}
              </span>
              <span style="font-size: 12px; font-weight: 900; color: ${segmentColor};">
                Safety Score: ${safetyScore}/100
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #ffffff;">
              ${step.from.name} ➔ ${step.to.name}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
              ${step.highway.name} (${step.highway.code}) • ${step.distanceKm} km • ~${step.estimatedMinutes} mins
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; font-size: 11px; background: rgba(15,23,42,0.85); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155;">
              <div>
                <div style="color: #64748b; font-size: 9px; font-weight: 700;">ROAD QUALITY</div>
                <strong style="color: #38bdf8;">${safetyData?.roadQualityScore ?? step.roadConditionScore}/100</strong>
              </div>
              <div>
                <div style="color: #64748b; font-size: 9px; font-weight: 700;">ACCIDENT CRASH RATE</div>
                <strong style="color: #f59e0b;">~${safetyData?.annualAccidentIncidents ?? 25}/yr</strong>
              </div>
              <div>
                <div style="color: #64748b; font-size: 9px; font-weight: 700;">SAFE ADVISORY SPEED</div>
                <strong style="color: #10b981;">${safetyData?.recommendedSpeedKmh ?? 50} km/h</strong>
              </div>
              <div>
                <div style="color: #64748b; font-size: 9px; font-weight: 700;">RISK LEVEL</div>
                <strong style="color: ${segmentColor}; text-transform: uppercase;">${safetyData?.accidentRiskLevel ?? 'moderate'}</strong>
              </div>
            </div>

            ${safetyData?.hazardFactors && safetyData.hazardFactors.length > 0 ? `
              <div style="margin-top: 6px; font-size: 10px; color: #cbd5e1; background: rgba(30,41,59,0.7); padding: 5px 7px; border-radius: 6px;">
                <strong style="color: #fbbf24;">Hazard Factors:</strong> ${safetyData.hazardFactors.join('; ')}
              </div>
            ` : ''}
          </div>
        `;

        segLine.bindPopup(segPopupContent, { className: 'custom-dark-popup', closeButton: false });

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
        <div style="background: #10b981; border: 2px solid #ffffff; width: 20px; height: 20px; border-radius: 50%; box-shadow: 0 0 14px #10b981; display: flex; align-items: center; justify-content: center; color: #020617; font-size: 11px; font-weight: 900;">
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
        <div style="background: #f43f5e; border: 2px solid #ffffff; width: 20px; height: 20px; border-radius: 50%; box-shadow: 0 0 14px #f43f5e; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; font-weight: 900;">
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

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/90 shadow-2xl bg-slate-950">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" id="nepal-gis-canvas" />

      {/* Top-Left Quick Weather Layer Toggle Chip */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center space-x-2">
        <button
          type="button"
          onClick={() => handleToggleLayer('weather')}
          className={`px-3 py-2 rounded-xl backdrop-blur-md border text-xs font-bold transition flex items-center space-x-2 shadow-2xl ${
            activeLayer === 'weather'
              ? 'bg-slate-950/90 text-sky-400 border-sky-500/60 ring-1 ring-sky-500/40'
              : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-900'
          }`}
          id="btn-quick-weather-layer-toggle"
          title="Toggle Mountain Pass Weather Markers on Map"
        >
          <CloudRain className="w-4 h-4 text-sky-400" />
          <span>Mountain Passes Weather</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-400/30">
            {HIGHWAY_WEATHER_NODES.length}
          </span>
          {activeLayer === 'weather' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Professional Right-Aligned Vertical Icon Layer Toolbar */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end space-y-2">
        <button
          onClick={handleToggleToolbar}
          className={`w-10 h-10 backdrop-blur-md rounded-xl shadow-2xl flex items-center justify-center transition border ${
            isToolbarOpen
              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10'
              : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:bg-slate-900'
          }`}
          title={isToolbarOpen ? "Close Map Layers (Hides all showing layers)" : "Open Map Layers Toolbar"}
          id="toggle-toolbar-collapse"
        >
          <Layers className={`w-5 h-5 ${isToolbarOpen ? 'rotate-90 text-emerald-400' : 'text-slate-300'} transition-transform`} />
        </button>

        {isToolbarOpen && (
          <div className="bg-slate-950/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-2xl flex flex-col space-y-1.5 animate-fadeIn">
            {/* Highways Toggle (Show Everywhere) */}
            <button
              onClick={() => handleToggleLayer('highways')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                activeLayer === 'highways'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-layer-highways"
              title="National Highways (Show Everywhere)"
            >
              <span>🛣️</span>
              {activeLayer === 'highways' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* Weather Passes & Nodes Toggle (Show Everywhere) */}
            <button
              onClick={() => handleToggleLayer('weather')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                activeLayer === 'weather'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50 ring-1 ring-sky-400 shadow-md shadow-sky-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-layer-weather"
              title="Weather Passes & Met Nodes (Show Everywhere)"
            >
              <CloudRain className="w-4 h-4 text-sky-400" />
              {activeLayer === 'weather' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sky-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* Road Hazards & Incidents Toggle (Show Everywhere) */}
            <button
              onClick={() => handleToggleLayer('incidents')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                activeLayer === 'incidents'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 ring-1 ring-rose-400 shadow-md shadow-rose-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-layer-incidents"
              title="Road Hazards & Incidents (Show Everywhere)"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              {activeLayer === 'incidents' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* Traffic Corridors Toggle (Show Everywhere) */}
            <button
              onClick={() => handleToggleLayer('traffic')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                activeLayer === 'traffic'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 ring-1 ring-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-layer-traffic"
              title="Live Traffic Corridors (Show Everywhere)"
            >
              <Gauge className="w-4 h-4 text-amber-400" />
              {activeLayer === 'traffic' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* POIs, Fuel & EV Fast Chargers Toggle (Show Everywhere) */}
            <button
              onClick={() => handleToggleLayer('pois')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                activeLayer === 'pois'
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 ring-1 ring-teal-400 shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-layer-pois"
              title="POIs, Fuel & EV Chargers (Show Everywhere)"
            >
              <Fuel className="w-4 h-4 text-teal-400" />
              {activeLayer === 'pois' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-teal-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* Alternatives Toggle (Show Everywhere) */}
            {hasAlternatives && (
              <button
                onClick={() => handleToggleLayer('alternatives')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                  activeLayer === 'alternatives'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 ring-1 ring-purple-400 shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
                id="toggle-layer-alternatives"
                title="Alternative Routes (Show Everywhere)"
              >
                <span>🔄</span>
                {activeLayer === 'alternatives' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full ring-1 ring-slate-950" />
                )}
              </button>
            )}

            {/* Map Symbology & Safety Legend Toggle */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition relative ${
                showLegend
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
              id="toggle-map-legend"
              title={showLegend ? "Hide Map Legend" : "Show Map Legend"}
            >
              <Info className="w-4 h-4" />
              {showLegend && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full ring-1 ring-slate-950" />
              )}
            </button>

            {/* Map Style Selector: Standard, Satellite, Terrain */}
            <div className="pt-2 pb-1 border-t border-slate-800 flex flex-col space-y-1.5">
              <button
                onClick={() => setMapStyle('standard')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  mapStyle === 'standard'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
                title="Standard Map View"
                id="btn-map-style-standard"
              >
                <MapIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMapStyle('satellite')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  mapStyle === 'satellite'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
                title="Satellite Map View"
                id="btn-map-style-satellite"
              >
                <Globe className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMapStyle('terrain')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  mapStyle === 'terrain'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
                title="Terrain Topo Map View"
                id="btn-map-style-terrain"
              >
                <Mountain className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend Overlay Component with Smooth Slide-in Fade Animation */}
      <div
        id="map-legend-card"
        className={`absolute bottom-6 left-6 z-[1000] max-w-xs sm:w-80 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out transform ${
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
        <div className="absolute bottom-6 left-6 z-[1000] max-w-md w-[calc(100%-3rem)] bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-white animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-600/40 flex flex-col items-center justify-center shrink-0">
                <span className="text-[9px] text-slate-400 font-bold uppercase">NEPAL</span>
                <span className="text-sm font-black text-emerald-400 font-display">{activeHighwayInfo.code}</span>
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h4 className="font-bold text-white text-sm">{activeHighwayInfo.name}</h4>
                  {activeHighwayInfo.nepaliName && (
                    <span className="text-xs text-slate-400">({activeHighwayInfo.nepaliName})</span>
                  )}
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
        </div>
      )}

    </div>
  );
};
