import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CityNode,
  RoutePlanResult,
  VehicleType,
  RoutePreference,
  TerrainFilterOptions,
  HighwayWeatherNode,
  HighwayPOI,
  TrafficCorridor,
  RouteSimulationControls,
  Highway,
  RoadIncident,
} from '../types';
import { NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS } from '../data/nepalHighwaysData';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { loadExpandedCities, getCachedExpandedCities } from '../utils/cityDataLoader';
import { findOptimizedRoute } from '../utils/routeOptimizer';
import { FuelCostEstimator } from './FuelCostEstimator';
import { FuelPriceCard } from './FuelPriceCard';
import { ShareTripModal } from './ShareTripModal';
import { TripAssistantPanel } from './TripAssistantPanel';
import { RouteTerrainAndTrafficAnalysis } from './RouteTerrainAndTrafficAnalysis';
import { PreTripChecklist } from './PreTripChecklist';
import { RouteOptionsSelector } from './RouteOptionsSelector';
import { HighwaySafetyIndexCard } from './HighwaySafetyIndexCard';
import { CarbonFootprintCard } from './CarbonFootprintCard';
import { WeatherPassesPanel } from './WeatherPassesPanel';
import { HighwayPOIsPanel } from './HighwayPOIsPanel';
import { TrafficCorridorPanel } from './TrafficCorridorPanel';
import { RouteComparisonView } from './RouteComparisonView';
import { RouteJunctionTimeline } from './RouteJunctionTimeline';
import { RouteHighwayInfoPanel } from './RouteHighwayInfoPanel';
import { RouteAheadFeed } from './RouteAheadFeed';
import { ErrorBoundary } from './ErrorBoundary';
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Mountain,
  Clock,
  Sparkles,
  MapPin,
  Car,
  Bike,
  Truck,
  Layers,
  ArrowUpDown,
  Navigation,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Share2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  Fuel,
  Mic,
  SlidersHorizontal,
  Search,
  Crosshair,
  ChevronDown,
  ChevronUp,
  X,
  Radio,
  FileText,
  CloudSun,
  Flame,
  Wrench,
  Leaf,
  Shield,
  LocateFixed,
  Receipt,
  Scale,
  Milestone,
  Route,
   Award,
   Users,
   User,
   Activity,
 } from 'lucide-react';
import { DataAttribution } from './DataAttribution';
import { UnifiedRouteReport } from './UnifiedRouteReport';
import {
  VEHICLE_CONFIGS,
  FuelRateConfig,
  getNOCFuelRate,
  getFuelRateLabel,
  getFuelName,
  FUEL_RATE_LABELS,
  getVehicleUIConfig,
  formatPreference,
  PREFERENCE_CONFIGS,
} from '../utils/vehicleConfigs';
import { fetchJson } from '../utils/apiConfig';
import { fetchFuelPrices, getFuelPriceMetadata, getMinutesSinceLastCheck, isPriceStale, getEffectiveFuelRate } from '../utils/fuelPriceService';
import { filterCities } from '../utils/citySearch';
import { getDistanceKm, findNearestHighwayJunction, findNearestHighwayFromCoords } from '../utils/geoUtils';

interface RoutePlannerProps {
  initialOriginId?: string;
  initialDestId?: string;
  initialVehicle?: VehicleType;
  initialPreference?: RoutePreference;
  onRouteCalculated: (route: RoutePlanResult) => void;
  onRouteClear?: () => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
  simulationControls: RouteSimulationControls;
  onToggleMapFull?: () => void;
  isMapFull?: boolean;
  onOpenHighwayDirectory?: () => void;
  onViewHighwayOnMap?: (highway: Highway) => void;
  onOpenMyLocation?: () => void;
}

const METRO_CITY_NAME_FRAGMENTS = ['kathmandu', 'pokhara', 'bharatpur', 'biratnagar', 'birgunj', 'bhaktapur', 'lalitpur'];
const SUB_METRO_CITY_NAME_FRAGMENTS = ['hetauda', 'butwal', 'dhangadhi', 'nepalgunj', 'birendranagar', 'dharan', 'janakpur', 'gauraha', 'birgunj'];

const getCityType = (city: CityNode): string => {
  if (city.cityType) return city.cityType;
  const lower = city.name.toLowerCase();
  if (METRO_CITY_NAME_FRAGMENTS.some((m) => lower.includes(m))) return 'Metropolitan City';
  if (SUB_METRO_CITY_NAME_FRAGMENTS.some((m) => lower.includes(m))) return 'Sub-metropolitan City';
  return city.isMajorHub ? 'Municipality' : 'Rural Municipality';
};

const findClosestCityFromCoords = (lat: number, lng: number, cities: CityNode[]): { city: CityNode; distanceKm: number } | null => {
  if (!cities || cities.length === 0) {
    return null;
  }
  let closestCity = cities[0];
  let minDistKm = Infinity;
  cities.forEach((city) => {
    const d = getDistanceKm(city.lat, city.lng, lat, lng);
    if (d < minDistKm) {
      minDistKm = d;
      closestCity = city;
    }
  });
  return { city: closestCity, distanceKm: minDistKm };
};

type DetailModuleTab =
  | 'timeline'
  | 'comparison'
  | 'travel_plan'
  | 'elevation'
  | 'weather'
  | 'pois'
  | 'traffic'
  | 'safety'
  | 'fuel_tolls'
  | 'ai_advisory'
  | 'eco'
  | 'sos'
  | 'checklist'
  | 'highway_info'
  | 'ahead';

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  initialOriginId = '',
  initialDestId = '',
  initialVehicle = 'car',
  initialPreference = 'fastest',
  onRouteCalculated,
  onRouteClear,
  onViewOnMap,
  simulationControls,
  onToggleMapFull,
  isMapFull = false,
  onOpenHighwayDirectory,
  onViewHighwayOnMap,
  onOpenMyLocation,
}) => {
  // Routing states
  const [originId, setOriginId] = useState<string>(initialOriginId);
  const [destId, setDestId] = useState<string>(initialDestId);
  const [userPickedDestination, setUserPickedDestination] = useState<boolean>(false);
  const [needsRecalculation, setNeedsRecalculation] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<VehicleType>(initialVehicle);
  const [preference, setPreference] = useState<RoutePreference>(initialPreference);
  const [showVehicleOptions, setShowVehicleOptions] = useState<boolean>(false);
  const [isReportExpanded, setIsReportExpanded] = useState<boolean>(false);
  const [showVehiclePerformance, setShowVehiclePerformance] = useState<boolean>(false);
  const [terrainFilters, setTerrainFilters] = useState<TerrainFilterOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        return {
          avoidHighPasses: params.get('avoidPasses') === '1',
          requirePavedOnly: params.get('pavedOnly') === '1',
          avoidSteepGrades: params.get('avoidSteep') === '1',
          avoidActiveLandslideZones: params.get('avoidHazards') === '1',
          maxElevationM: params.get('maxElev') ? Number(params.get('maxElev')) : undefined,
        };
      } catch {
        // Fallback
      }
    }
    return {
      avoidHighPasses: false,
      requirePavedOnly: false,
      avoidSteepGrades: false,
      avoidActiveLandslideZones: false,
      maxElevationM: undefined,
    };
  });

   // UI Modes & Location Options
  // mode: 'my_location' (single destination search bar) vs 'custom_from_to' (From & To inputs)
  const [locationMode, setLocationMode] = useState<'my_location' | 'custom_from_to'>('my_location');
  const isCustomLocationMode = locationMode === 'custom_from_to';
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState<boolean>(false);
  const [originSelected, setOriginSelected] = useState<boolean>(false);
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsOriginCityId, setGpsOriginCityId] = useState<string>('');
  const [gpsOriginDistanceKm, setGpsOriginDistanceKm] = useState<number | null>(null);
  const [gpsNearestJunction, setGpsNearestJunction] = useState<{
    name: string;
    distanceKm: number;
    connectedHighways: string[];
  } | null>(null);
  const [gpsNearestHighway, setGpsNearestHighway] = useState<{
    code: string;
    name: string;
    from: string;
    to: string;
    distanceKm: number;
  } | null>(null);
  const [allCities, setAllCities] = useState<CityNode[]>([...CITIES_AND_JUNCTIONS, ...getCachedExpandedCities()]);
  const allCitiesRef = useRef(allCities);
  const gpsAutoDetectAttemptedRef = useRef(false);

  useEffect(() => {
    allCitiesRef.current = allCities;
  }, [allCities]);

  // Auto-focus "Where to" input after origin is selected
  const prevOriginId = useRef<string>('');
  useEffect(() => {
    if (originId && prevOriginId.current === '') {
      prevOriginId.current = originId;
      setTimeout(() => {
        if (locationMode === 'my_location') {
          singleSearchInputRef.current?.focus();
        } else {
          destInputRef.current?.focus();
        }
      }, 100);
    } else if (originId) {
      prevOriginId.current = originId;
    }
  }, [originId, locationMode]);

  // Search queries & Autocompletions
  const [singleSearchQuery, setSingleSearchQuery] = useState<string>('');
  const [originSearchQuery, setOriginSearchQuery] = useState<string>('');
  const [destSearchQuery, setDestSearchQuery] = useState<string>('');
  const [isSingleDropdownOpen, setIsSingleDropdownOpen] = useState<boolean>(false);
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState<boolean>(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const [showSearchPanel, setShowSearchPanel] = useState<boolean>(false);

  // AI Prompt Bar State
  const [isAiPromptOpen, setIsAiPromptOpen] = useState<boolean>(false);
  const [aiPromptText, setAiPromptText] = useState<string>('');
  const [isParsingAiPrompt, setIsParsingAiPrompt] = useState<boolean>(false);
  const [aiParseMessage, setAiParseMessage] = useState<string | null>(null);

  // Voice Speech Recognition
  const [listeningTarget, setListeningTarget] = useState<'single' | 'origin' | 'dest' | 'ai' | null>(null);
  const [speechTranscriptNotice, setSpeechTranscriptNotice] = useState<string | null>(null);

  // Calculations & Output State
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState<boolean>(false);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  // Fuel price state
  const [fuelPrices, setFuelPrices] = useState<FuelRateConfig | null>(null);
  const [fuelPriceMetadata, setFuelPriceMetadata] = useState<any>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [priceFetchError, setPriceFetchError] = useState<string | null>(null);

  // Custom Fuel Efficiency Override States
  const [customMileageKmL, setCustomMileageKmL] = useState<number>(() => {
    return initialVehicle === 'car'
      ? 14.0
      : initialVehicle === 'suv_4wd'
      ? 10.0
      : initialVehicle === 'motorbike'
      ? 35.0
      : initialVehicle === 'bus_truck'
      ? 4.5
      : 6.2; // km/kWh for EV
  });
  const [efficiencyUnit, setEfficiencyUnit] = useState<'km_l' | 'mpg' | 'l_100km'>('km_l');

  // Update default efficiency when vehicle type switches if user hasn't heavily modified it or reset
  useEffect(() => {
    const defaultVal =
      vehicle === 'car'
        ? 14.0
        : vehicle === 'suv_4wd'
        ? 10.0
        : vehicle === 'motorbike'
        ? 35.0
        : vehicle === 'bus_truck'
        ? 4.5
        : 6.2;
    setCustomMileageKmL(defaultVal);
  }, [vehicle]);

  // Who is using this trip plan: drives which tools/services are surfaced after a route is found.
  // 'driver' shows vehicle-operating tools (fuel/toll cost, eco footprint, pre-trip checklist).
  // 'passenger' hides those and keeps only what someone riding along actually needs.
  const [travelerMode, setTravelerMode] = useState<'driver' | 'passenger'>('driver');

  // Active Option Button / Module Expansion (Default: none - don't show contents if user hasn't clicked!)
  const [activeModuleTab, setActiveModuleTab] = useState<DetailModuleTab>('none');
  const [resultsViewMode, setResultsViewMode] = useState<'overview' | 'comparison'>('overview');
  const [travelPlanView, setTravelPlanView] = useState<'timeline' | 'steps'>('timeline');
  // Calculation animation key for smooth CSS fade-in transitions
  const [calcKey, setCalcKey] = useState<number>(0);

  // Toggle for advanced fuel/efficiency settings
  const [showAdvancedFuel, setShowAdvancedFuel] = useState<boolean>(false);

  // AI Custom Advisory states
  const [loadingAiAdvisory, setLoadingAiAdvisory] = useState<boolean>(false);
  const [aiCustomAdvisory, setAiCustomAdvisory] = useState<any | null>(null);

  // Share Modal & Toast Feedback
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [trafficSyncedNotification, setTrafficSyncedNotification] = useState<boolean>(false);

  // Telemetry data for embedded option tabs (if opened)
  const [weatherNodes, setWeatherNodes] = useState<HighwayWeatherNode[]>([]);
  const [poisList, setPoisList] = useState<HighwayPOI[]>([]);
  const [corridorsList, setTrafficCorridorsList] = useState<TrafficCorridor[]>([]);

  const singleSearchRef = useRef<HTMLDivElement>(null);
  const originSearchRef = useRef<HTMLDivElement>(null);
  const destSearchRef = useRef<HTMLDivElement>(null);
  const singleSearchInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const aiPromptRef = useRef<HTMLDivElement>(null);

  // Close all dropdown menus, optionally keeping one open
  const closeAllMenus = useCallback((keepOpen: 'location' | 'single' | 'origin' | 'dest' | 'ai' | 'vehicle' | null = null) => {
    if (keepOpen !== 'location') setIsLocationMenuOpen(false);
    if (keepOpen !== 'single') setIsSingleDropdownOpen(false);
    if (keepOpen !== 'origin') setIsOriginDropdownOpen(false);
    if (keepOpen !== 'dest') setIsDestDropdownOpen(false);
    if (keepOpen !== 'ai') setIsAiPromptOpen(false);
    if (keepOpen !== 'vehicle') setShowVehicleOptions(false);
  }, []);

  // Get current city objects
  const originCity = useMemo(() => allCities.find((c) => c.id === originId), [originId, allCities]);
  const destCity = useMemo(() => allCities.find((c) => c.id === destId), [destId, allCities]);
  const gpsOriginCity = useMemo(() => allCities.find((c) => c.id === gpsOriginCityId), [gpsOriginCityId, allCities]);

  // Sync search boxes with selected city name — only when the city NAME
  // changes, not when the allCities array refreshes (which would overwrite
  // user-typed text).
  useEffect(() => {
    if (destCity) {
      setDestSearchQuery(destCity.name);
    }
  }, [destCity?.name]);

  useEffect(() => {
    if (originCity) {
      setOriginSearchQuery(originCity.name);
    }
  }, [originCity?.name]);

  // Fetch optional telemetry data when respective tabs are clicked
  useEffect(() => {
    if (activeModuleTab === 'weather' && weatherNodes.length === 0) {
      fetchJson<Record<string, any>>('/api/weather')
        .then((data) => data.weatherNodes && setWeatherNodes(data.weatherNodes))
        .catch(() => {});
    }
    if (activeModuleTab === 'pois' && poisList.length === 0) {
      fetchJson<Record<string, any>>('/api/pois')
        .then((data) => data.pois && setPoisList(data.pois))
        .catch(() => {});
    }
    if (activeModuleTab === 'traffic' && corridorsList.length === 0) {
      fetchJson<Record<string, any>>('/api/traffic')
        .then((data) => data.corridors && setTrafficCorridorsList(data.corridors))
        .catch(() => {});
    }
  }, [activeModuleTab]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (singleSearchRef.current && !singleSearchRef.current.contains(e.target as Node)) {
        setIsSingleDropdownOpen(false);
      }
      if (originSearchRef.current && !originSearchRef.current.contains(e.target as Node)) {
        setIsOriginDropdownOpen(false);
      }
      if (destSearchRef.current && !destSearchRef.current.contains(e.target as Node)) {
        setIsDestDropdownOpen(false);
      }
       if (locationMenuRef.current && !locationMenuRef.current.contains(e.target as Node)) {
         setIsLocationMenuOpen(false);
       }
       if (aiPromptRef.current && !aiPromptRef.current.contains(e.target as Node)) {
         setIsAiPromptOpen(false);
       }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [originCity?.name, destCity?.name]);

  // Filter cities for search dropdowns
  const filteredOriginCities = filterCities(allCities, originSearchQuery);
  const filteredDestCities = filterCities(allCities, destSearchQuery);

  const handleSelectOrigin = (city: CityNode) => {
    setOriginId(city.id);
    setOriginSearchQuery(city.name);
    setOriginSelected(false);
    setIsOriginDropdownOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
    setTimeout(() => destInputRef.current?.focus(), 100);
  };

  const handleSelectDestination = (city: CityNode) => {
    setDestId(city.id);
    setDestSearchQuery(city.name);
    setSingleSearchQuery(city.name);
    setUserPickedDestination(true);
    setIsDestDropdownOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
  };

  // Perform Route Calculation
  const handleCalculateRoute = (overrideOrigin?: string, overrideDest?: string, overrideVehicle?: VehicleType, overridePref?: RoutePreference) => {
    const fromId = overrideOrigin || originId;
    const toId = overrideDest || destId;
    const veh = overrideVehicle || vehicle;
    const pref = overridePref || preference;

    if (!fromId || !toId || fromId === toId) {
      setSpeechTranscriptNotice('Please select two different cities to calculate a route.');
      setTimeout(() => setSpeechTranscriptNotice(null), 3000);
      return;
    }

    setIsCalculating(true);
    setTimeout(() => {
      const plan = findOptimizedRoute(fromId, toId, pref, veh, terrainFilters, originCity || undefined, destCity || undefined);
      if (plan && fuelPrices) {
        const updatedPlan = applyLiveFuelPrices(plan, veh, fuelPrices);
        setRoutePlan(updatedPlan);
        onRouteCalculated(updatedPlan);
      } else if (plan) {
        setRoutePlan(plan);
        onRouteCalculated(plan);
      }
      setHasCalculated(true);

      // User requirement 3: clean previous search From & To in the search bar and show my location default
      setSingleSearchQuery('');
      setDestSearchQuery('');
      setOriginSearchQuery('');
      setIsSingleDropdownOpen(false);
      setIsOriginDropdownOpen(false);
      setIsDestDropdownOpen(false);
      setIsLocationMenuOpen(false);
      setIsAiPromptOpen(false);
      setLocationMode('my_location');
      setShowSearchPanel(false);
      setNeedsRecalculation(false);
      setIsReportExpanded(true);
      setCalcKey((k) => k + 1);
      setAiCustomAdvisory(null);
      setIsCalculating(false);
    }, 200);
  };

  // Switch vehicle or preference and re-calculate in-place
  const handleQuickVehicleSwitch = (newVehicle: VehicleType) => {
    setVehicle(newVehicle);
    if (originId && destId && originId !== destId) {
      handleCalculateRoute(originId, destId, newVehicle, preference);
    }
  };

  const handleQuickPrefSwitch = (newPref: RoutePreference) => {
    setPreference(newPref);
    if (originId && destId && originId !== destId) {
      handleCalculateRoute(originId, destId, vehicle, newPref);
    }
  };

  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // Device Geolocation Auto-Detection
  const handleDetectDeviceLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setOriginSelected(false);
      setOriginId('');
      setDetectedLocation(null);
      setIsLocationMenuOpen(false);
      return;
    }

    let permissionState: string | null = null;
    if (typeof navigator.permissions !== 'undefined' && navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        permissionState = permissionStatus.state;

        if (permissionStatus.state === 'granted') {
          setLocationPermissionDenied(false);
        } else if (permissionStatus.state === 'prompt') {
          setLocationPermissionDenied(false);
        } else if (permissionStatus.state === 'denied') {
          setLocationPermissionDenied(true);
          alert(
            'GPS location access is blocked. Please enable location permissions in your browser settings, then tap "Use GPS" again.\n\n' +
            'On Chrome: Settings → Privacy → Site Settings → Location → Allow\n' +
            'On Safari: Settings → Safari → Location → merosadak.com → While Using\n' +
            'On Firefox: Options → Privacy → Permissions → Settings → Location → Allow'
          );
          return;
        }

        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted' && locationPermissionDenied) {
            setLocationPermissionDenied(false);
          }
        };
      } catch {
        // Permissions API not supported
      }
    }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setDetectedLocation({ lat: latitude, lng: longitude });
          const result = findClosestCityFromCoords(latitude, longitude, allCitiesRef.current);
          if (result) {
            setOriginId(result.city.id);
            setGpsOriginCityId(result.city.id);
            setGpsOriginDistanceKm(result.distanceKm);

            const nearestJunction = findNearestHighwayJunction(latitude, longitude);
            if (nearestJunction.city && nearestJunction.distanceKm != null) {
              setGpsNearestJunction({
                name: nearestJunction.city.name,
                distanceKm: nearestJunction.distanceKm,
                connectedHighways: nearestJunction.city.connectedHighways,
              });
            }

            const nearestHighway = findNearestHighwayFromCoords(latitude, longitude);
            if (nearestHighway) {
              setGpsNearestHighway({
                code: nearestHighway.highway!.code,
                name: nearestHighway.highway!.name,
                from: nearestHighway.segment!.from,
                to: nearestHighway.segment!.to,
                distanceKm: nearestHighway.distanceKm!,
              });
            }
          } else {
            setOriginId('');
            setGpsOriginCityId('');
            setGpsOriginDistanceKm(null);
          }
          setOriginSelected(true);
          setIsLocationMenuOpen(false);
          setLocationPermissionDenied(false);
        },
       (err) => {
          setOriginSelected(false);
          setOriginId('');
          setGpsOriginCityId('');
          setGpsOriginDistanceKm(null);
          setGpsNearestJunction(null);
          setGpsNearestHighway(null);
          setDetectedLocation(null);
         setLocationPermissionDenied(true);
         if (err.code === err.PERMISSION_DENIED && permissionState === 'denied') {
           alert(
            'GPS location access is blocked. Please enable location permissions in your browser settings, then tap "Use GPS" again.\n\n' +
            'On Chrome: Settings → Privacy → Site Settings → Location → Allow\n' +
            'On Safari: Settings → Safari → Location → merosadak.com → While Using\n' +
            'On Firefox: Options → Privacy → Permissions → Settings → Location → Allow'
          );
         }
         setIsLocationMenuOpen(false);
       },
       { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, [locationPermissionDenied]);

  // Auto-detect GPS on mount: ask permission if not yet decided.
  // Once detected, the GPS location is a permanent "fact" — it is not
  // cleared or overridden when the user picks a different "from" city.
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (gpsAutoDetectAttemptedRef.current) return;
    if (detectedLocation) return;

    gpsAutoDetectAttemptedRef.current = true;

    const tryAutoDetect = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setDetectedLocation({ lat: latitude, lng: longitude });
          const result = findClosestCityFromCoords(latitude, longitude, allCitiesRef.current);
          if (result) {
            setOriginId(result.city.id);
            setGpsOriginCityId(result.city.id);
            setGpsOriginDistanceKm(result.distanceKm);

            const nearestJunction = findNearestHighwayJunction(latitude, longitude);
            if (nearestJunction.city && nearestJunction.distanceKm != null) {
              setGpsNearestJunction({
                name: nearestJunction.city.name,
                distanceKm: nearestJunction.distanceKm,
                connectedHighways: nearestJunction.city.connectedHighways,
              });
            }

            const nearestHighway = findNearestHighwayFromCoords(latitude, longitude);
            if (nearestHighway) {
              setGpsNearestHighway({
                code: nearestHighway.highway!.code,
                name: nearestHighway.highway!.name,
                from: nearestHighway.segment!.from,
                to: nearestHighway.segment!.to,
                distanceKm: nearestHighway.distanceKm!,
              });
            }
          } else {
            setOriginId('');
            setGpsOriginCityId('');
            setGpsOriginDistanceKm(null);
          }
          setOriginSelected(true);
          setIsLocationMenuOpen(false);
        },
        () => {
          // Permission denied or error — user can still pick manually
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
      );
    };

    // Wait for expanded cities (palikas, POIs, etc.) to load before GPS detection
    // so we match against the full dataset for better accuracy.
    loadExpandedCities()
      .then((cities) => {
        allCitiesRef.current = cities;
        setAllCities(cities);
      })
      .catch(() => {
        // Fallback to cached cities
      })
      .finally(() => {
        // Check existing permission state before prompting
        if (typeof navigator.permissions !== 'undefined' && navigator.permissions) {
          navigator.permissions
            .query({ name: 'geolocation' })
            .then((permissionStatus) => {
              if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
                tryAutoDetect();
              }
              // 'denied' — skip silent detection

              permissionStatus.onchange = () => {
                if (permissionStatus.state === 'granted') {
                  tryAutoDetect();
                }
              };
            })
            .catch(() => {
              tryAutoDetect();
            });
        } else {
          // No Permissions API — direct call triggers browser prompt
          tryAutoDetect();
        }
      });
  }, []);

  // Voice Speech Recognition Handler
  const startVoiceRecognition = (target: 'single' | 'origin' | 'dest' | 'ai') => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert('Speech Recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      setListeningTarget(target);
      setSpeechTranscriptNotice(
        target === 'ai'
          ? 'Listening to your trip request... Speak now.'
          : `Listening for destination name... Speak now.`
      );

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript.toLowerCase().trim();
        setSpeechTranscriptNotice(`Heard: "${spokenText}"`);

        if (target === 'ai') {
          setAiPromptText(spokenText);
          handleExecuteAiPrompt(spokenText);
          return;
        }

        // Match city
        const matched = allCities.find(
          (c) =>
            c.name.toLowerCase().includes(spokenText) ||
            spokenText.includes(c.name.toLowerCase()) ||
            c.district.toLowerCase().includes(spokenText)
        );

        if (matched) {
          if (target === 'single' || target === 'dest') {
            setDestId(matched.id);
            setSingleSearchQuery(matched.name);
            setDestSearchQuery(matched.name);
            setUserPickedDestination(true);
            setIsSingleDropdownOpen(false);
            setIsDestDropdownOpen(false);
            if (hasCalculated) setNeedsRecalculation(true);
          } else if (target === 'origin') {
            setOriginId(matched.id);
            setOriginSearchQuery(matched.name);
            setOriginSelected(false);
            setIsOriginDropdownOpen(false);
          }
          setSpeechTranscriptNotice(`Selected: ${matched.name} (${matched.district})`);
        } else {
          setSpeechTranscriptNotice(`Could not match "${spokenText}" to a Nepal junction. Please select manually.`);
        }

        setTimeout(() => {
          setListeningTarget(null);
          setSpeechTranscriptNotice(null);
        }, 3000);
      };

      recognition.onerror = () => {
        setSpeechTranscriptNotice('Speech recognition ended.');
        setTimeout(() => {
          setListeningTarget(null);
          setSpeechTranscriptNotice(null);
        }, 2000);
      };

      recognition.onend = () => {
        setListeningTarget(null);
      };

      recognition.start();
    } catch (err) {
      setListeningTarget(null);
      setSpeechTranscriptNotice('Microphone access unavailable.');
      setTimeout(() => setSpeechTranscriptNotice(null), 2500);
    }
  };

  // AI Prompt Execution
  const handleExecuteAiPrompt = async (promptQuery?: string) => {
    const textToParse = promptQuery || aiPromptText;
    if (!textToParse || !textToParse.trim()) return;

    setIsParsingAiPrompt(true);
    setAiParseMessage('Gemini AI analyzing request & corridor geometry...');

    try {
      const data = await fetchJson<Record<string, any>>('/api/ai-smart-route-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToParse }),
      });

      if (data && data.destId) {
        if (data.originId) setOriginId(data.originId);
        if (data.destId) {
          setDestId(data.destId);
          setUserPickedDestination(true);
          if (hasCalculated) setNeedsRecalculation(true);
        }
        if (data.vehicle) setVehicle(data.vehicle);
        if (data.preference) setPreference(data.preference);

        const destCityObj = allCities.find((c) => c.id === data.destId);
        if (destCityObj) {
          setSingleSearchQuery(destCityObj.name);
          setDestSearchQuery(destCityObj.name);
        }

        setAiParseMessage(data.summary || `Route planned to ${destCityObj?.name || data.destId}!`);
        setIsAiPromptOpen(false);

        // Calculate right away
        handleCalculateRoute(data.originId || originId, data.destId, data.vehicle || vehicle, data.preference || preference);
      } else {
        setAiParseMessage('Could not parse route. Please choose from dropdown.');
      }
    } catch (err) {
      setAiParseMessage('AI query fallback applied.');
    } finally {
      setIsParsingAiPrompt(false);
      setTimeout(() => setAiParseMessage(null), 4000);
    }
  };

  // Fetch AI Safety Advisory on demand
  const handleFetchAiAdvisory = async () => {
    if (!routePlan) return;
    setLoadingAiAdvisory(true);
    try {
      const data = await fetchJson<Record<string, any>>('/api/ai-route-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: routePlan.origin.name,
          destination: routePlan.destination.name,
          vehicle,
          preference,
          distanceKm: routePlan.totalDistanceKm,
          timeHours: (routePlan.estimatedTimeMinutes / 60).toFixed(1),
          roadConditionScore: routePlan.roadConditionScore,
          incidents: routePlan.incidentsOnRoute,
        }),
      });
      if (data.advisory) {
        setAiCustomAdvisory(data.advisory);
      }
    } catch (err) {
      console.error('Failed to load AI advisory:', err);
    } finally {
      setLoadingAiAdvisory(false);
    }
  };

  // Swap Origin and Destination
  const handleSwapLocations = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
    setOriginSearchQuery(destCity?.name ?? '');
    setDestSearchQuery(originCity?.name ?? '');
    setSingleSearchQuery(destCity?.name ?? '');
    if (hasCalculated) setNeedsRecalculation(true);
  };

  const handleClearOrigin = () => {
    setOriginId('');
    setOriginSearchQuery('');
    setOriginSelected(false);
    setIsOriginDropdownOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
  };

  const handleClearDestination = () => {
    setDestId('');
    setDestSearchQuery('');
    setSingleSearchQuery('');
    setUserPickedDestination(false);
    setIsDestDropdownOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
  };

  // Toggle detail module tabs — click the active tab to close it, click a
   // different tab to switch straight to it.
  const handleToggleModuleTab = (tab: DetailModuleTab) => {
    setActiveModuleTab((prev) => (prev === tab ? 'none' : tab));
  };

  // Ordered list of module tabs, used so mobile swipe-left/right can move
  // between them in the same order they're laid out in the button grid.
  const MODULE_TAB_ORDER: DetailModuleTab[] = [
    'travel_plan', 'highway_info', 'fuel_tolls', 'checklist', 'ai_advisory', 'sos', 'ahead',
  ];
  useEffect(() => {
    if (travelerMode === 'passenger') {
      setActiveModuleTab((prev) => (prev === 'fuel_tolls' || prev === 'checklist' ? 'none' : prev));
    }
  }, [travelerMode]);
  const swipeTouchStartX = useRef<number | null>(null);
  const handleModuleSwipeStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
  };
  const handleModuleSwipeEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - swipeTouchStartX.current;
    swipeTouchStartX.current = null;
    const SWIPE_THRESHOLD_PX = 50;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    // passengers have no vehicle tools, so swiping must not land on them
    const order = MODULE_TAB_ORDER.filter((t) => travelerMode === 'driver' || (t !== 'fuel_tolls' && t !== 'checklist'));
    setActiveModuleTab((prev) => {
      const idx = order.indexOf(prev as DetailModuleTab);
      if (idx === -1) return prev;
      const nextIdx = deltaX < 0
        ? Math.min(idx + 1, order.length - 1) // swipe left -> next
        : Math.max(idx - 1, 0); // swipe right -> previous
      return order[nextIdx];
    });
  };

  // Auto-calculate route when both origin and destination are selected
  // (removes the need to manually click "Calculate Route & Reports")
  useEffect(() => {
    if (isCalculating) return;
    if (!originId || !destId || originId === destId) return;
    if (hasCalculated && !needsRecalculation) return;
    if (!userPickedDestination) return;
    setNeedsRecalculation(false);

    handleCalculateRoute();
  }, [originId, destId, userPickedDestination, hasCalculated, isCalculating, needsRecalculation]);

  // Fetch fuel prices on mount and periodically refresh
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingPrices(true);
      setPriceFetchError(null);
      try {
        const prices = await fetchFuelPrices();
        if (!cancelled) {
          setFuelPrices(prices);
          setFuelPriceMetadata(getFuelPriceMetadata());
        }
      } catch (err: any) {
        if (!cancelled) setPriceFetchError(err?.message || 'Failed to load fuel prices');
      } finally {
        if (!cancelled) setIsLoadingPrices(false);
      }
    };
    load();
    const interval = setInterval(() => {
      if (isPriceStale()) {
        fetchFuelPrices()
          .then((p) => {
            setFuelPrices(p);
            setFuelPriceMetadata(getFuelPriceMetadata());
          })
          .catch(() => {});
      }
    }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Re-apply live fuel prices when they change and we have a route plan
  useEffect(() => {
    if (fuelPrices && routePlan) {
      const updatedPlan = applyLiveFuelPrices(routePlan, vehicle, fuelPrices);
      if (updatedPlan.fuelEstimate.costNpr !== routePlan.fuelEstimate.costNpr) {
        setRoutePlan(updatedPlan);
        onRouteCalculated(updatedPlan);
      }
    }
  }, [fuelPrices, routePlan, vehicle]);

  // Recalculate route fuel costs with fresh prices
  const applyLiveFuelPrices = (plan: RoutePlanResult, vehicleType: VehicleType, prices: FuelRateConfig): RoutePlanResult => {
    const effectiveRate = (v: VehicleType): number => {
      if (v === 'electric_vehicle') return prices.electricity;
      if (v === 'suv_4wd' || v === 'bus_truck') return prices.diesel;
      return prices.petrol;
    };
    const rate = effectiveRate(vehicleType);
    const updatedPlan: RoutePlanResult = {
      ...plan,
      fuelEstimate: {
        ...plan.fuelEstimate,
        costNpr: Math.round(plan.fuelEstimate.liters * rate),
      },
    };
    if (updatedPlan.allRouteOptions) {
      updatedPlan.allRouteOptions = updatedPlan.allRouteOptions.map((opt) => {
        const optRate = effectiveRate(opt.vehicle);
        return {
          ...opt,
          fuelEstimate: {
            ...opt.fuelEstimate,
            costNpr: Math.round(opt.fuelEstimate.liters * optRate),
          },
        };
      });
    }
    return updatedPlan;
  };

  return (
    <div className="space-y-4">
      {/* AI Parsing Message Banner */}
      {aiParseMessage && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-3 rounded-2xl flex items-center space-x-2 text-xs text-cyan-200 animate-fadeIn shadow-lg">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-medium">{aiParseMessage}</span>
        </div>
      )}

      {/* Fuel Price Freshness Indicator */}
      {hasCalculated && routePlan && (
        <div className="flex items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <Fuel className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {isLoadingPrices ? (
              <span className="text-slate-400 animate-pulse">Checking fuel prices…</span>
            ) : fuelPrices ? (
              <span className="text-slate-300 truncate">
                Fuel prices last checked{' '}
                <span className="font-semibold text-emerald-400">
                  {getMinutesSinceLastCheck() < 1 ? 'just now' : `${getMinutesSinceLastCheck()} min ago`}
                </span>
                {isPriceStale() && (
                  <span className="ml-1 text-amber-400">(stale)</span>
                )}
              </span>
            ) : priceFetchError ? (
              <span className="text-rose-400 truncate">Prices unavailable — using NOC defaults</span>
            ) : (
              <span className="text-slate-500">Loading fuel prices…</span>
            )}
          </div>
          <button
            onClick={async () => {
              setIsLoadingPrices(true);
              setPriceFetchError(null);
              try {
                const prices = await fetchFuelPrices();
                setFuelPrices(prices);
                setFuelPriceMetadata(getFuelPriceMetadata());
                if (routePlan) {
                  const updated = applyLiveFuelPrices(routePlan, vehicle, prices);
                  setRoutePlan(updated);
                  onRouteCalculated(updated);
                }
              } catch (err: any) {
                setPriceFetchError(err?.message || 'Refresh failed');
              } finally {
                setIsLoadingPrices(false);
              }
            }}
            disabled={isLoadingPrices}
            className="flex items-center space-x-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition shrink-0"
            title="Refresh fuel prices"
            type="button"
          >
            {isLoadingPrices ? (
              <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Main Clean Route Planner Box */}
      <div className="bg-slate-900/95 border border-slate-800 border-t-0 rounded-t-none sm:rounded-t-none p-4 sm:p-5 space-y-4">
      {/* 1. MY LOCATION CARD - Always visible */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            onClick={() => {
              if (isCustomLocationMode) {
                setLocationMode('my_location');
                closeAllMenus(null);
                return;
              }
              closeAllMenus('location');
              setIsLocationMenuOpen(!isLocationMenuOpen);
            }}
            id="btn-my-location-toggle"
            className={`flex items-center space-x-3 group select-none rounded-xl px-3 py-2 border transition min-w-0 flex-1 cursor-pointer ${
              isCustomLocationMode
                ? 'bg-slate-900/60 border-slate-800 opacity-40'
                : 'bg-slate-950/50 hover:bg-slate-950 border-slate-800 hover:border-emerald-500/50'
            }`}
            aria-disabled={isCustomLocationMode}
            title={isCustomLocationMode ? 'Click to return to My Location' : 'Click to view My Location or Change Origin'}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition ${
              detectedLocation
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              {detectedLocation ? <LocateFixed className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">
                {detectedLocation
                  ? (gpsOriginCity ? gpsOriginCity.name : 'Location acquired')
                  : isCustomLocationMode ? 'Custom origin mode' : 'Select a location'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {detectedLocation
                  ? (gpsOriginCity
                    ? (gpsOriginCity.district || gpsOriginCity.province
                      ? `${gpsOriginCity.district || ''}${gpsOriginCity.district && gpsOriginCity.province ? ' · ' : ''}${gpsOriginCity.province || ''}`
                      : 'Location detected')
                    : 'Coordinates acquired')
                  : isCustomLocationMode ? 'Choose from list' : 'Tap to set origin'}
              </div>
              {detectedLocation && gpsNearestHighway && (
                <div className="text-[10px] text-cyan-400 truncate">
                  {gpsNearestHighway.code} · {gpsNearestHighway.distanceKm.toFixed(1)} km
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenMyLocation?.()}
            className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition shrink-0"
            title="View full Location Info"
          >
            <LocateFixed className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {isLocationMenuOpen && (
          <div className="mt-4 space-y-2 animate-fadeIn">
            {!detectedLocation && (
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-0.5">
                Choose Location:
              </div>
            )}

            {!detectedLocation && (
              <button
                type="button"
                onClick={() => {
                  handleDetectDeviceLocation();
                  setLocationMode('my_location');
                  closeAllMenus(null);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl border transition text-left bg-slate-950/80 hover:bg-slate-800 ${
                  locationPermissionDenied
                    ? 'border-rose-500/30 hover:border-rose-500/50'
                    : 'border-slate-800 hover:border-emerald-500/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  locationPermissionDenied ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  <LocateFixed className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${
                    locationPermissionDenied ? 'text-rose-300' : 'text-white'
                  }`}>
                    Use GPS{locationPermissionDenied && ' (blocked)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {locationPermissionDenied
                      ? 'Tap to re-enable location access'
                      : 'Auto-detects via device sensors'}
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setLocationMode('custom_from_to');
                setOriginSearchQuery('');
                setDestSearchQuery('');
                setSingleSearchQuery('');
                closeAllMenus(null);
                setTimeout(() => {
                  originInputRef.current?.focus();
                  setIsOriginDropdownOpen(true);
                }, 100);
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/30 transition text-left bg-slate-950/80 hover:bg-slate-800"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <ArrowUpDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Change Origin</div>
                <div className="text-[11px] text-slate-400">Specify origin &amp; destination</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {speechTranscriptNotice && (
        <div className="flex items-center space-x-1.5 text-xs text-emerald-300 animate-fadeIn bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2">
          <Mic className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium truncate">{speechTranscriptNotice}</span>
        </div>
      )}

        {/* 2. SEARCH INPUT BARS - Hidden after calculation */}
        {!hasCalculated && (
          <>
            <p className="text-[10px] text-slate-500 px-0.5">
              Trip planner · mixed places (highway nodes + nearby towns). For official km only, use Distance.
            </p>
            {locationMode === 'my_location' ? (
          /* SINGLE SEARCH BAR with functional Mic and AI icons */
          <div className="space-y-2 relative" ref={singleSearchRef}>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4 text-emerald-400" />
              </div>

              <input
                ref={singleSearchInputRef}
                type="text"
                value={singleSearchQuery}
                onChange={(e) => {
                  setSingleSearchQuery(e.target.value);
                  closeAllMenus('single');
                  setIsSingleDropdownOpen(true);
                }}
                onFocus={() => {
                  closeAllMenus('single');
                  setIsSingleDropdownOpen(true);
                }}
                placeholder="Where to?"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-24 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
              />

              {/* Functional Microphone and AI Icon Action Buttons */}
              <div className="absolute right-2 flex items-center space-x-1.5">
                {singleSearchQuery && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSingleSearchQuery(''); }}
                    className="p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                    title="Clear"
                    type="button"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Microphone Button */}
                <button
                  onClick={() => startVoiceRecognition('single')}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    listeningTarget === 'single'
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Voice Search Destination (English / Nepali phonetics)"
                  id="btn-voice-search-single"
                >
                  <Mic className="w-4 h-4 text-emerald-400" />
                </button>

                {/* AI Assistant Button */}
                <button
                  onClick={() => {
                   closeAllMenus('ai');
                   setIsAiPromptOpen(!isAiPromptOpen);
                 }}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    isAiPromptOpen
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="AI Smart Route & Natural Language Query Assistant"
                  id="btn-ai-prompt-single"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            </div>

            {/* Destination Autocomplete Suggestions Dropdown */}
            {isSingleDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto space-y-1">
                {filterCities(allCities, singleSearchQuery).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setDestId(c.id);
                      setSingleSearchQuery(c.name);
                      setDestSearchQuery(c.name);
                      setIsSingleDropdownOpen(false);
                      setUserPickedDestination(true);
                      if (hasCalculated) setNeedsRecalculation(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                        {c.name}
                        {c.cityType && (
                          <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                            {c.cityType}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {c.district} District • {c.province} Province
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* DUAL FROM & TO SEARCH BARS */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
            {/* FROM (Origin) */}
            <div className="md:col-span-5 space-y-1 relative" ref={originSearchRef}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
                 <input
                   id="input-from-origin"
                   type="text"
                   ref={originInputRef}
                   value={originSearchQuery}
                   onChange={(e) => {
                     setOriginSearchQuery(e.target.value);
                     closeAllMenus('origin');
                     setIsOriginDropdownOpen(true);
                   }}
                   onFocus={() => {
                     setOriginSearchQuery('');
                     closeAllMenus('origin');
                     setIsOriginDropdownOpen(true);
                   }}
                  placeholder="From where?"
                  autoComplete="off"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                />
                <button
                  onClick={() => startVoiceRecognition('origin')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition ${
                    listeningTarget === 'origin'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Voice input for Origin"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
                {(originSearchQuery || originId) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearOrigin(); }}
                    className="absolute right-9 top-1/2 -translate-y-1/2 p-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                    title="Clear origin"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isOriginDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto space-y-1">
                  {filteredOriginCities.length > 0 ? (
                    filteredOriginCities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectOrigin(c)}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                            {c.name}
                            {c.cityType && (
                              <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                {c.cityType}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {c.district} District • {c.province} Province
                           </div>
                         </div>
                       </button>
                     ))
                   ) : (
                     <div className="px-4 py-6 text-center text-xs text-slate-500">No matching locations found</div>
                   )}
                 </div>
               )}
             </div>

             {/* SWAP BUTTON */}
            <div className="md:col-span-2 flex justify-center pt-1 md:pt-4">
              <button
                onClick={handleSwapLocations}
                title="Swap Origin and Destination"
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow active:scale-95"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TO (Destination) */}
            <div className="md:col-span-5 space-y-1 relative" ref={destSearchRef}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  ref={destInputRef}
                  id="input-to-dest"
                  type="text"
                  value={destSearchQuery}
                   onChange={(e) => {
                     setDestSearchQuery(e.target.value);
                     closeAllMenus('dest');
                     setIsDestDropdownOpen(true);
                   }}
                   onFocus={() => {
                     setDestSearchQuery('');
                     closeAllMenus('dest');
                     setIsDestDropdownOpen(true);
                   }}
                  placeholder="Where to?"
                  autoComplete="off"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                />
                <button
                  onClick={() => startVoiceRecognition('dest')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition ${
                    listeningTarget === 'dest'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Voice input for Destination"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
                {(destSearchQuery || destId) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearDestination(); }}
                    className="absolute right-9 top-1/2 -translate-y-1/2 p-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                    title="Clear destination"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isDestDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto space-y-1">
                  {filteredDestCities.length > 0 ? (
                    filteredDestCities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectDestination(c)}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                            {c.name}
                            {c.cityType && (
                              <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                {c.cityType}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {c.district} District • {c.province} Province
                           </div>
                         </div>
                       </button>
                     ))
                   ) : (
                     <div className="px-4 py-6 text-center text-xs text-slate-500">No matching locations found</div>
                   )}
                 </div>
               )}
             </div>
           </div>
         )}
       </>)}

         {/* AI Prompt Input Bar (If user clicks AI icon) - Hidden after calculation */}
        {!hasCalculated && isAiPromptOpen && (
          <div ref={aiPromptRef} className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Route Planner</span>
              </div>
              <button
                onClick={() => closeAllMenus(null)}
                className="p-1 rounded hover:bg-cyan-900/50 text-cyan-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiPromptText}
                onChange={(e) => setAiPromptText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteAiPrompt()}
                placeholder="e.g. Scenic motorcycle trip from Kathmandu to Pokhara avoiding steep climbs..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => startVoiceRecognition('ai')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs border border-slate-700"
                title="Speak AI prompt"
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
              </button>
              <button
                onClick={() => handleExecuteAiPrompt()}
                disabled={isParsingAiPrompt || !aiPromptText.trim()}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0"
              >
                {isParsingAiPrompt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Plan</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Route auto-calculates when origin + destination are selected.
            Show a subtle loading indicator while calculating. */}
        {userPickedDestination && isCalculating && !hasCalculated && (
          <div className="pt-2 flex items-center justify-center space-x-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Optimizing Highway Geometry &amp; Telemetry...</span>
          </div>
        )}

       {/* 5. READY REPORTS IN A SHORT PLACE WITH MORE INFO (COMPACT BENTO DASHBOARD) */}
       {hasCalculated && routePlan && (
         <div
           id="route-results-panel"
           key={`route-results-panel-${calcKey}-${routePlan.id}`}
          className="bg-slate-900/95 border border-slate-800 p-3 sm:p-5 rounded-2xl shadow-xl space-y-3.5 sm:space-y-4 animate-fade-in-smooth transition-all duration-500 ease-out max-w-full overflow-x-hidden"
        >
          {/* Header Summary & Expand/Reduce + Map Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-sm sm:text-base font-black text-white font-display truncate">{routePlan.origin.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-sm sm:text-base font-black text-white font-display truncate">{routePlan.destination.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.shortName} •{' '}
                <span className="capitalize">{preference.replace('_', ' ')}</span> priority
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              {/* Expand / Reduce Report Button */}
              <button
                type="button"
                onClick={() => setIsReportExpanded(!isReportExpanded)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                title={isReportExpanded ? "Reduce Report" : "Expand Full Report"}
              >
                {isReportExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px]">Reduce</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px]">Expand</span>
                  </>
                )}
              </button>

                {/* View/Full Map Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onToggleMapFull) {
                      onToggleMapFull();
                    } else if (onViewOnMap) {
                      onViewOnMap();
                    }
                    const mapElem = document.getElementById('nepal-gis-canvas');
                    if (mapElem) {
                      mapElem.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                  title={isMapFull ? "Reduce Map View" : "Full Map View"}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{isMapFull ? 'Reduce Map' : 'Full Map'}</span>
                </button>



            </div>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
                title="Share this trip"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>

          {/* PRIMARY ACTION ROW: the one thing most people want right after a route is found,
              plus who-is-traveling so the tools below can be tailored instead of dumped flat. */}
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
             <button
               type="button"
               onClick={() => {
                 setTravelPlanView('steps');
                 setActiveModuleTab('travel_plan');
               }}
               className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/20 transition"
               id="btn-start-trip"
             >
               <Navigation className="w-4 h-4" />
               <span>Go</span>
             </button>
           </div>

          {/* REDUCED REPORT SUMMARY (When user clicks Reduce Report) */}
          {!isReportExpanded && (
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-fadeIn">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 font-mono text-[11px]">
                <span className="flex items-center space-x-1 text-white font-bold" title="Distance">
                  <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{routePlan.totalDistanceKm} km</span>
                </span>
                <span className="flex items-center space-x-1 text-cyan-400 font-bold" title="Time">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m</span>
                </span>
                <span className="flex items-center space-x-1 text-amber-300 font-bold" title="Est. Cost">
                  <Fuel className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Rs {(() => {
                    const effKmL = Math.max(1.0, customMileageKmL);
                    const unitsReq = Math.round((routePlan.totalDistanceKm / effKmL) * 10) / 10;
                    const price = fuelPrices ? getEffectiveFuelRate(vehicle, fuelPrices) : getNOCFuelRate(vehicle);
                    return (Math.round(unitsReq * price) + (routePlan.totalTollCostNpr || 0)).toLocaleString();
                  })()}</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-400 font-bold" title="Safety">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{routePlan.roadConditionScore}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsReportExpanded(true)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1 transition self-start sm:self-auto"
              >
                <span>Expand Full Report</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* EXPANDED FULL REPORT CONTENT */}
          {isReportExpanded && (
            <>
              {/* DEDICATED COMPARISON VIEW IF ACTIVE */}
              {resultsViewMode === 'comparison' && (
                <RouteComparisonView
                  activePlan={routePlan}
                  allOptions={routePlan.allRouteOptions || [routePlan]}
                  selectedRouteId={routePlan.id}
                  vehicle={vehicle}
                  onSelectRoute={(opt) => {
                    setRoutePlan(opt);
                    setPreference(opt.preference);
                    onRouteCalculated(opt);
                  }}
                  onViewOnMap={onViewOnMap}
                />
              )}

          {/* STANDARD TRIP OVERVIEW CONTENT */}
          {resultsViewMode === 'overview' && (
            <>
               {/* ROUTE CALCULATION SUMMARY & STRUCTURED VEHICLE FUEL COST BREAKDOWN */}
               <UnifiedRouteReport
                  route={routePlan}
                  distanceKm={routePlan.totalDistanceKm}
                  distanceSource="dor_gis_route"
                  distanceEvidence="route_graph"
                  distanceSourceUrl="https://dor.gov.np"
                  distanceSourceDescription="DoR Nepal highway GIS route geometry and certified road network."
                  vehicleLabel={VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label}
                  preferenceLabel={preference.replace('_', ' ')}
                  onPrint={() => window.print()}
                  onShare={() => setIsShareModalOpen(true)}
                  showElevationProfile
                  simulationControls={simulationControls}
                  onViewOnMap={onViewOnMap}
                />

           {/* Multi-Route Alternatives (If available) */}
          {routePlan.allRouteOptions && routePlan.allRouteOptions.length > 1 && (
            <RouteOptionsSelector
              activePlan={routePlan}
              allOptions={routePlan.allRouteOptions}
              selectedRouteId={routePlan.id}
              vehicle={vehicle}
              onSelectRoute={(opt) => {
                setRoutePlan(opt);
                setPreference(opt.preference);
                onRouteCalculated(opt);
              }}
              onViewOnMap={onViewOnMap}
            />
          )}

          {/* 6. ALONG YOUR ROUTE: information first, scoped to THIS route (not the whole
              country), split by who is asking. Detail views stay behind a few buttons. */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex flex-wrap gap-2" id="route-detail-actions">
              {([
                { tab: 'travel_plan', label: 'Timeline', Icon: Milestone, show: true, tone: 'emerald' },
                { tab: 'highway_info', label: 'Highways', Icon: Route, show: true, tone: 'cyan' },
                { tab: 'fuel_tolls', label: 'Cost & eco', Icon: Flame, show: travelerMode === 'driver', tone: 'amber' },
                { tab: 'checklist', label: 'Checklist', Icon: Wrench, show: travelerMode === 'driver', tone: 'amber' },
                { tab: 'ai_advisory', label: 'AI', Icon: Sparkles, show: true, tone: 'cyan' },
                { tab: 'sos', label: 'SOS', Icon: PhoneCall, show: true, tone: 'red' },
                { tab: 'ahead', label: 'Ahead', Icon: Navigation, show: true, tone: 'emerald' },
              ] as Array<{ tab: DetailModuleTab; label: string; Icon: React.ComponentType<{ className?: string }>; show: boolean; tone: string }>)
                .filter((a) => a.show)
                .map(({ tab, label, Icon, tone }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleToggleModuleTab(tab)}
                    aria-pressed={activeModuleTab === tab}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition inline-flex items-center gap-1.5 ${
                      activeModuleTab === tab
                        ? tone === 'red'
                          ? 'bg-red-600/30 text-red-300 border-red-500'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                        : tone === 'red'
                        ? 'bg-slate-950 hover:bg-slate-900 text-red-400 border-slate-800'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* 7. DYNAMIC EXPANDED CONTENT AREA (Rendered ONLY when user clicks an option button!)
              Swipeable on touch devices: swipe left/right to move to the next/previous module. */}
          {activeModuleTab !== 'none' && (
            <div
              className="pt-3 border-t border-slate-800 space-y-4 animate-fadeIn"
              onTouchStart={handleModuleSwipeStart}
              onTouchEnd={handleModuleSwipeEnd}
            >
              {/* Module Header with Close Tab button */}
              <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-bold text-white min-w-0">
                  {activeModuleTab === 'timeline' && <span>🕒 Timeline</span>}
                  {activeModuleTab === 'comparison' && <span>⚖️ Compare routes</span>}
                  {activeModuleTab === 'travel_plan' && <span>📋 Trip plan</span>}
                  {activeModuleTab === 'elevation' && <span>⛰️ Elevation</span>}
                  {activeModuleTab === 'weather' && <span>🌤️ Mountain weather</span>}
                  {activeModuleTab === 'pois' && <span>⛽ POIs &amp; charging</span>}
                  {activeModuleTab === 'traffic' && <span>🚦 Traffic &amp; terrain</span>}
                  {activeModuleTab === 'safety' && <span>🛡️ Safety score</span>}
                  {activeModuleTab === 'fuel_tolls' && <span>💰 Fuel &amp; tolls</span>}
                  {activeModuleTab === 'ai_advisory' && <span>🤖 AI advisory</span>}
                  {activeModuleTab === 'sos' && <span>🚨 Emergency SOS</span>}
                  {activeModuleTab === 'eco' && <span>🌱 Eco &amp; carbon</span>}
                  {activeModuleTab === 'checklist' && <span>🔧 Vehicle checklist</span>}
                  {activeModuleTab === 'highway_info' && <span>🛣️ Route highways</span>}
                  <span className="inline sm:hidden text-slate-500 font-normal shrink-0">· swipe ⇆</span>
                </div>
                <button
                  onClick={() => setActiveModuleTab('none')}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition"
                >
                  <span>Close</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* MODULE CONTENT: Timeline View */}
              {activeModuleTab === 'timeline' && (
                <div className="space-y-4 animate-fadeIn">
                  <RouteJunctionTimeline
                    routePlan={routePlan}
                    vehicle={vehicle}
                    onViewOnMap={onViewOnMap}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 0. Comparison View */}
              {activeModuleTab === 'comparison' && (
                <RouteComparisonView
                  activePlan={routePlan}
                  allOptions={routePlan.allRouteOptions || [routePlan]}
                  selectedRouteId={routePlan.id}
                  vehicle={vehicle}
                  onSelectRoute={(opt) => {
                    setRoutePlan(opt);
                    setPreference(opt.preference);
                    onRouteCalculated(opt);
                  }}
                  onViewOnMap={onViewOnMap}
                />
              )}

              {/* MODULE CONTENT: 1. Travel Plan */}
              {activeModuleTab === 'travel_plan' && (
                <div className="space-y-4">
                  {/* View Mode Toggle: Junction Timeline vs Turn-by-Turn Steps */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800 gap-2">
                    <div className="text-xs font-bold text-slate-300 px-1 flex items-center space-x-1.5">
                      <Milestone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Itinerary Mode:</span>
                    </div>
                    <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTravelPlanView('timeline')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1.5 ${
                          travelPlanView === 'timeline'
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Milestone className="w-3 h-3" />
                        <span>Junction Timeline (ETAs)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTravelPlanView('steps')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1.5 ${
                          travelPlanView === 'steps'
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Turn-by-Turn Steps</span>
                      </button>
                    </div>
                  </div>

                  {travelPlanView === 'timeline' ? (
                    <RouteJunctionTimeline
                      routePlan={routePlan}
                      vehicle={vehicle}
                      onViewOnMap={onViewOnMap}
                    />
                  ) : (
                    <>
                      {/* Turn-by-Turn Sequence */}
                      <div className="space-y-2">
                        {routePlan.steps.map((step, index) => (
                          <div
                            key={index}
                            className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="flex items-start space-x-2.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 border border-emerald-500/40">
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center flex-wrap gap-1.5">
                                  <span>{step.instruction}</span>
                                  {step.highwayCode && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-800 text-cyan-300 rounded border border-slate-700">
                                      {step.highwayCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center flex-wrap gap-2">
                                  <span className="capitalize">{step.surface.replace('_', ' ')}</span>
                                  <span>•</span>
                                  <span>{step.durationMinutes} mins drive</span>
                                  {step.elevationChangeM !== 0 && (
                                    <span className={step.elevationChangeM > 0 ? 'text-purple-400' : 'text-cyan-400'}>
                                      • {step.elevationChangeM > 0 ? `+${step.elevationChangeM}m climb` : `${step.elevationChangeM}m descent`}
                                    </span>
                                  )}
                                </div>
                                {step.warning && (
                                  <div className="text-amber-400 text-[10px] mt-1 flex items-center space-x-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{step.warning}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="font-bold text-slate-200 shrink-0">{step.distanceKm} km</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* MODULE CONTENT: 2. Weather & Mountain Passes */}
              {activeModuleTab === 'weather' && (
                <div className="space-y-3">
                  <WeatherPassesPanel
                    weatherNodes={weatherNodes}
                    routeHighways={routePlan?.steps.map((s) => s.highwayCode).filter(Boolean) as string[] | undefined}
                    onSelectNode={(node) => {
                      if (onViewOnMap) {
                        onViewOnMap({ lat: node.lat, lng: node.lng, title: `${node.name} (${node.elevationM}m)`, zoom: 12 });
                      }
                    }}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 3. POIs & Fuel / EV */}
              {activeModuleTab === 'pois' && (
                <div className="space-y-3">
                  <HighwayPOIsPanel
                    pois={poisList}
                    onSelectPOI={(poi) => {
                      if (onViewOnMap) {
                        onViewOnMap({ lat: poi.lat, lng: poi.lng, title: poi.name, zoom: 13 });
                      }
                    }}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 4. Traffic & Terrain */}
              {activeModuleTab === 'traffic' && (
                <div className="space-y-4">
                  <RouteTerrainAndTrafficAnalysis routePlan={routePlan} vehicle={vehicle} />
                  {corridorsList.length > 0 && (
                    <TrafficCorridorPanel
                      corridors={corridorsList}
                      onSelectCorridor={(corridor) => {
                        if (onViewOnMap && corridor.startCoord && corridor.endCoord) {
                          onViewOnMap({
                            lat: (corridor.startCoord[0] + corridor.endCoord[0]) / 2,
                            lng: (corridor.startCoord[1] + corridor.endCoord[1]) / 2,
                            title: corridor.name,
                            zoom: 11,
                          });
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {/* MODULE CONTENT: 5. Safety & Hazards */}
              {activeModuleTab === 'safety' && (
                <div className="space-y-4">
                  {routePlan.safetyIndex && (
                    <HighwaySafetyIndexCard
                      safetyIndex={routePlan.safetyIndex}
                      onFocusBlackspot={(spot) => {
                        if (onViewOnMap && spot?.coordinates) {
                          onViewOnMap({ lat: spot.coordinates[0], lng: spot.coordinates[1], title: spot.name, zoom: 13 });
                        }
                      }}
                      onFocusSegment={(seg) => {
                        if (onViewOnMap && seg?.coordinates?.[0]) {
                          onViewOnMap({ lat: seg.coordinates[0][0], lng: seg.coordinates[0][1], title: seg.highwayName, zoom: 11 });
                        }
                      }}
                    />
                  )}

                  {/* Active Road Hazards & Incident Warnings along this route */}
                  {routePlan.incidentsOnRoute.length > 0 ? (
                    <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2 text-xs font-bold text-red-400 uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                        <span>Active Road Advisories On Selected Corridor ({routePlan.incidentsOnRoute.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {routePlan.incidentsOnRoute.map((inc) => (
                          <div key={inc.id} className="bg-slate-900/90 p-3 rounded-lg border border-red-900/40 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-white">
                              <span>{inc.title}</span>
                              <span className="text-[10px] text-red-400 uppercase font-semibold px-1.5 py-0.5 bg-red-950 rounded border border-red-800">
                                {inc.severity}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px]">{inc.locationName} • {inc.highwayName}</p>
                            <p className="text-slate-400 text-[11px]">{inc.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-center space-x-3 text-xs text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold">Highway Corridors All Clear</div>
                        <div className="text-[11px] text-slate-400">No active landslides or major roadblocks reported along this path.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODULE CONTENT: 6. Fuel & Tolls */}
              {activeModuleTab === 'fuel_tolls' && (
                <div className="space-y-4">
                  <FuelPriceCard
                    fuelPrices={fuelPrices}
                    metadata={fuelPriceMetadata}
                    isLoading={isLoadingPrices}
                  />
                  <FuelCostEstimator
                    distanceKm={routePlan.totalDistanceKm}
                    vehicleType={vehicle}
                    elevationGainM={routePlan.elevationGainM}
                    origin={routePlan.origin}
                    destination={routePlan.destination}
                    defaultTollCost={routePlan.totalTollCostNpr}
                    fuelPrices={fuelPrices}
                    onVehicleChange={(newV) => setVehicle(newV)}
                  />
                  <CarbonFootprintCard
                    distanceKm={routePlan.totalDistanceKm}
                    vehicleType={vehicle}
                    elevationGainM={routePlan.elevationGainM}
                    onVehicleChange={(v) => setVehicle(v)}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 7. AI Advisory */}
              {activeModuleTab === 'ai_advisory' && (
                <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 rounded-2xl border border-emerald-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Gemini AI Route &amp; Safety Advisory</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Real-time driving counsel for Nepal highways</p>
                    </div>

                    <button
                      onClick={handleFetchAiAdvisory}
                      disabled={loadingAiAdvisory}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow flex items-center space-x-1.5 shrink-0"
                    >
                      {loadingAiAdvisory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{loadingAiAdvisory ? 'Analyzing...' : 'Generate New Advisory'}</span>
                    </button>
                  </div>

                  {aiCustomAdvisory ? (
                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <span className="font-semibold text-emerald-400">Summary: </span>
                        <span className="text-slate-200">{aiCustomAdvisory.summary}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <div className="font-semibold text-slate-300 mb-1">Departure Window:</div>
                          <div className="text-cyan-300 font-bold">{aiCustomAdvisory.bestDepartureWindow}</div>
                          {aiCustomAdvisory.monsoonOrWeatherWarning && (
                            <div className="text-amber-400 text-[11px] mt-1">⚠️ {aiCustomAdvisory.monsoonOrWeatherWarning}</div>
                          )}
                        </div>
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <div className="font-semibold text-slate-300 mb-1">Emergency Contacts:</div>
                          <ul className="text-slate-300 text-[11px] space-y-0.5">
                            {aiCustomAdvisory.emergencyContacts?.map((c: string, i: number) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : routePlan.aiAdvisory ? (
                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-slate-200">
                        {routePlan.aiAdvisory.summary}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                        {routePlan.aiAdvisory.keyRecommendations.map((rec, i) => (
                          <div key={i} className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                            ✓ {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Click &quot;Generate New Advisory&quot; to get specialized Gemini AI recommendations.
                    </div>
                  )}

                  {/* Trip Assistant Stops & Eateries */}
                  <TripAssistantPanel routePlan={routePlan} vehicle={vehicle} preference={preference} />
                </div>
              )}

              {/* MODULE CONTENT: 8. SOS Emergency */}
              {activeModuleTab === 'sos' && (
                <div className="bg-red-950/30 border border-red-900/60 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                    <PhoneCall className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span>Nepal Highway Emergency Dispatch Hotlines</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1">
                      <div className="text-xs text-slate-400 font-bold">Nepal Police Emergency</div>
                      <div className="text-xl font-black text-rose-400 font-mono">100</div>
                      <div className="text-[10px] text-slate-500">Toll-free 24/7 Dispatch</div>
                    </div>
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1">
                      <div className="text-xs text-slate-400 font-bold">Traffic Police Control</div>
                      <div className="text-xl font-black text-amber-400 font-mono">103</div>
                      <div className="text-[10px] text-slate-500">Highway Road Clearance</div>
                    </div>
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1">
                      <div className="text-xs text-slate-400 font-bold">APF Highway Rescue</div>
                      <div className="text-xl font-black text-cyan-400 font-mono">1114</div>
                      <div className="text-[10px] text-slate-500">Disaster &amp; Medical Unit</div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE CONTENT: 9. Eco & Carbon */}
              {activeModuleTab === 'eco' && (
                <div className="space-y-3">
                  <CarbonFootprintCard
                    distanceKm={routePlan.totalDistanceKm}
                    vehicleType={vehicle}
                    elevationGainM={routePlan.elevationGainM}
                    onVehicleChange={(v) => setVehicle(v)}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 10. Checklist */}
              {activeModuleTab === 'checklist' && (
                <div className="space-y-3">
                  <PreTripChecklist routePlan={routePlan} vehicle={vehicle} />
                </div>
              )}

              {/* MODULE CONTENT: 11. Highway Info */}
              {activeModuleTab === 'highway_info' && (
                <div className="space-y-3">
                  <RouteHighwayInfoPanel
                    routeHighwayCodes={routePlan.steps.map((s) => s.highwayCode).filter(Boolean)}
                    incidents={[...routePlan.incidentsOnRoute, ...LIVE_ROAD_INCIDENTS]}
                    onViewHighwayOnMap={onViewHighwayOnMap}
                    onOpenHighwayDirectory={onOpenHighwayDirectory}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 12. Ahead on Route */}
              {activeModuleTab === 'ahead' && (
                <div className="space-y-3">
                  <ErrorBoundary fallback={<div className="text-xs text-slate-500 px-1">Route information is temporarily unavailable.</div>}>
                    <RouteAheadFeed
                      routePlan={routePlan}
                      mode={travelerMode}
                      extraIncidents={LIVE_ROAD_INCIDENTS}
                      onViewOnMap={onViewOnMap}
                    />
                  </ErrorBoundary>
                </div>
              )}
              </div>
            )}
          </>
        )}
      </>
    )}
  </div>
   )}

  {hasCalculated && (
    <div className="inline-flex items-center self-start sm:self-auto rounded-xl border border-slate-800 bg-slate-950 p-1 text-[11px] font-bold">
      <button
        type="button"
        onClick={() => setTravelerMode('driver')}
        aria-pressed={travelerMode === 'driver'}
        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
          travelerMode === 'driver'
            ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span>Driving</span>
      </button>
      <button
        type="button"
        onClick={() => setTravelerMode('passenger')}
        aria-pressed={travelerMode === 'passenger'}
        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
          travelerMode === 'passenger'
            ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Users className="w-3.5 h-3.5" />
        <span>Passenger</span>
      </button>
    </div>
  )}

        {hasCalculated && (
          <div className="mt-3 border-t border-slate-800/60 pt-3">
            <button
              type="button"
              onClick={() => { closeAllMenus('vehicle'); setShowVehicleOptions(!showVehicleOptions); }}
              className="w-full py-2 px-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-between transition group shadow-sm"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-bold text-slate-200 truncate">Vehicle &amp; Route</span>
                <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.shortName} • {preference.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-400 group-hover:text-white shrink-0 ml-2">
                <span className="text-[10px] font-medium">{showVehicleOptions ? 'Hide' : 'Show'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showVehicleOptions ? 'rotate-180 text-emerald-400' : ''}`} />
              </div>
            </button>

            {showVehicleOptions && (
              <div className="mt-2.5 p-2.5 sm:p-3 bg-slate-950/90 border border-slate-800/90 rounded-xl space-y-2.5 animate-fadeIn">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Vehicle</span>
                    <span className="text-emerald-400 text-[9px] font-mono">
                      {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {VEHICLE_CONFIGS.map(({ type, shortName, icon: Icon, desc }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleQuickVehicleSwitch(type)}
                        title={`${shortName} - ${desc}`}
                        className={`py-1.5 px-0.5 rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                          vehicle === type
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-bold shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${vehicle === type ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="text-[8px] sm:text-[9px] font-semibold leading-tight">{shortName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Route type</span>
                    <span className="text-cyan-400 text-[9px] font-mono capitalize">
                      {preference.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {PREFERENCE_CONFIGS.map(({ pref, icon, label, desc }) => (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => handleQuickPrefSwitch(pref)}
                        title={`${label} - ${desc}`}
                        className={`py-1.5 px-0.5 rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                          preference === pref
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-[11px] leading-none">{icon}</span>
                        <span className="text-[8px] sm:text-[9px] font-semibold leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                 </div>
                </div>
              )}
            </div>
          )}
      {routePlan && (
        <ShareTripModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          routePlan={routePlan}
          vehicle={vehicle}
          preference={preference}
        />
      )}
    </div>
    </div>
  );
};
