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
  Route,
  Repeat,
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
  isDimmed?: boolean;
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
  isDimmed,
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
    nepalBorder: L.LayerGroup;
    provinces: L.LayerGroup;
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
    nepalBorder: L.layerGroup(),
    provinces: L.layerGroup(),
  });

  // Mutually Exclusive Overlay Layer Selection
  // Defaults to 'weather' so interactive weather markers for mountain passes are immediately rendered on the map.
  // When another layer toggle is clicked, it switches; toggling the active layer hides it.
  // When the layer toolbar is closed, all showing layers are closed.
  const [activeLayer, setActiveLayer] = useState<ActiveMapOverlayLayer>('none');
  const [showLegend, setShowLegend] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);

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
    layersRef.current.nepalBorder.addTo(map);
    layersRef.current.provinces.addTo(map);

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

    let url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | DoR Nepal Highway GIS';
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
      subdomains: 'abc',
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

  // Render Nepal International Border (always visible)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const borderGroup = layersRef.current.nepalBorder;
    borderGroup.clearLayers();

    fetch('/data/nepal-international-border.geojson')
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
          const geoJsonLayer = L.geoJSON(data, {
            style: {
              color: '#dc2626',
              weight: 3,
              opacity: 0.9,
              fill: false,
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties?.name) {
                layer.bindTooltip(feature.properties.name, {
                  sticky: true,
                  className: 'custom-dark-tooltip',
                });
              }
            },
          });
          borderGroup.addLayer(geoJsonLayer);
        } catch (e) {
          console.error('Failed to render Nepal border:', e);
        }
      })
      .catch(err => console.warn('Failed to load Nepal border:', err));
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
        </div>`,
        { sticky: true, className: 'custom-dark-tooltip', direction: 'top' }
      );

      weatherMarkersRef.current.set(node.id, marker);
      weatherGroup.addLayer(marker);
    });
  }, [activeLayer, weatherNodes, selectedWeatherNodeId, onSelectWeatherNode, onSelectCity]);

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

  const [showMapStyle, setShowMapStyle] = useState(false);

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const marker = L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9,
         }).addTo(mapInstanceRef.current!);
        mapInstanceRef.current!.flyTo([latitude, longitude], 14, { duration: 1.5 });
      },
      () => {},
      { timeout: 8000 }
    );
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
      <button
        type="button"
        onClick={handleMyLocation}
        className="absolute top-3 right-3 z-[1000] w-9 h-9 rounded-full bg-slate-950/90 hover:bg-slate-900 text-sky-300 border border-sky-500/40 shadow-2xl shadow-black/50 flex items-center justify-center backdrop-blur-xl transition"
        title="My Location"
        id="btn-my-location-gps"
      >
        <Locate className="w-4 h-4" />
      </button>

      {/* Map Style Selector */}
      {showMapStyle && (
        <div className="absolute top-3 right-16 z-[1000] flex items-center space-x-1 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-full p-1 shadow-2xl shadow-black/50 animate-fadeIn">
          <button
            type="button"
            onClick={() => { setMapStyle('standard'); setShowMapStyle(false); }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${mapStyle === 'standard' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Standard"
          >
            <MapIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('satellite'); setShowMapStyle(false); }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${mapStyle === 'satellite' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Satellite"
          >
            <Globe className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setMapStyle('terrain'); setShowMapStyle(false); }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${mapStyle === 'terrain' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md' : 'text-slate-400 hover:text-white'}`}
            title="Terrain"
          >
            <Mountain className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowMapStyle(!showMapStyle)}
        className={`absolute top-3 right-16 z-[1000] w-9 h-9 rounded-full flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${showMapStyle ? 'bg-slate-950/90 text-emerald-400 border-emerald-500/50 rotate-90' : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white'}`}
        title="Map Style"
        id="btn-map-style-toggle"
      >
        <Globe className="w-4 h-4" />
      </button>

      {/* Layer Toolbar - vertical stack top-to-bottom */}
      {isToolbarOpen && (
        <div className="absolute top-14 right-2 z-[1000] flex flex-col items-end gap-1.5 w-44 animate-fadeIn">
          <button
            type="button"
            onClick={() => handleToggleLayer('highways')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'highways'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="Highways"
            id="toggle-layer-highways"
          >
            <Route className="w-4 h-4" />
            <span className="text-xs font-bold">Highways</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('weather')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'weather'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sky-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="Weather"
            id="toggle-layer-weather"
          >
            <CloudRain className="w-4 h-4" />
            <span className="text-xs font-bold">Weather</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('incidents')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'incidents'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="Incidents"
            id="toggle-layer-incidents"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold">Incidents</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('traffic')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'traffic'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="Traffic"
            id="toggle-layer-traffic"
          >
            <Gauge className="w-4 h-4" />
            <span className="text-xs font-bold">Traffic</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayer('pois')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              activeLayer === 'pois'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-teal-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="POIs"
            id="toggle-layer-pois"
          >
            <Fuel className="w-4 h-4" />
            <span className="text-xs font-bold">POIs</span>
          </button>
          {hasAlternatives && (
            <button
              type="button"
              onClick={() => handleToggleLayer('alternatives')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
                activeLayer === 'alternatives'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-purple-500/20'
                  : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
              }`}
              title="Alternatives"
              id="toggle-layer-alternatives"
            >
              <Repeat className="w-4 h-4" />
              <span className="text-xs font-bold">Alternatives</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition shadow-2xl shadow-black/50 ${
              showLegend
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20'
                : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-slate-200'
            }`}
            title="Legend"
            id="toggle-map-legend"
          >
            <Info className="w-4 h-4" />
            <span className="text-xs font-bold">Legend</span>
          </button>
        </div>
      )}

      {/* Toolbar toggle button */}
      <button
        type="button"
        onClick={handleToggleToolbar}
        className={`absolute top-3 right-28 z-[1000] w-9 h-9 rounded-full flex items-center justify-center shadow-2xl shadow-black/50 backdrop-blur-xl border transition ${
          isToolbarOpen
            ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10'
            : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white'
        }`}
        title={isToolbarOpen ? "Close layers" : "Open layers"}
        id="toggle-toolbar-collapse"
      >
        <Layers className={`w-4 h-4 ${isToolbarOpen ? 'rotate-90 text-emerald-400' : 'text-slate-300'} transition-transform`} />
      </button>

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
