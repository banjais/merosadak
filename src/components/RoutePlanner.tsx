import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlannerDeck } from './PlannerDeck';
import { usePlannerSections } from '../hooks/usePlannerSections';
import {
  CityNode,
  RoutePlanResult,
  VehicleType,
  RoutePreference,
  TerrainFilterOptions,
  RouteSimulationControls,
  Highway,
  RoadIncident,
} from '../types';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { loadExpandedCities, getCachedExpandedCities } from '../utils/cityDataLoader';
import { findOptimizedRoute, pickVerifiedRoute } from '../utils/routeOptimizer';
import { FuelCostEstimator } from './FuelCostEstimator';
import { FuelPriceCard } from './FuelPriceCard';
import { TripAssistantPanel } from './TripAssistantPanel';
import { RouteTerrainAndTrafficAnalysis } from './RouteTerrainAndTrafficAnalysis';
import { RouteOptionsSelector } from './RouteOptionsSelector';
import { CarbonFootprintCard } from './CarbonFootprintCard';
import { RouteComparisonView } from './RouteComparisonView';
import { RouteJunctionTimeline } from './RouteJunctionTimeline';
import { RouteHighwayInfoPanel } from './RouteHighwayInfoPanel';
import { RouteAheadFeed } from './RouteAheadFeed';
import { ErrorBoundary } from './ErrorBoundary';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Mountain,
  Clock,
  Sparkles,
  MapPin,
  Bike,
  Truck,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
  Receipt,
  Scale,
  Milestone,
  Route,
   Award,
   Users,
   User,
   Activity,
   Edit3,
   Info,
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
  EV_KM_PER_KWH,
} from '../utils/vehicleConfigs';
import { fetchJson } from '../utils/apiConfig';
import { NOC_FUEL_RATES_AS_OF } from '../utils/vehicleConfigs';
import type { ReportFuelBasis } from './UnifiedRouteReport';
import { fetchFuelPrices, getFuelPriceMetadata, getMinutesSinceLastCheck, formatLastChecked, isPriceStale, getEffectiveFuelRate } from '../utils/fuelPriceService';
import { filterCities, countCityMatches, citySuggestionLimit } from '../utils/citySearch';
import { CitySuggestionDropdown } from './CityResultRow';
import { HighwayBrowser } from './HighwayBrowser';
import {
  isHighwayQuery,
  getHighwayPlaces,
  highwayPlaceToCityNode,
  searchHighways,
  preloadHighwayCatalogue,
  getHighwayCatalogue,
} from '../utils/highwayCatalogue';
import { getDistanceKm, findNearestHighwayJunction, findNearestHighwayFromCoords } from '../utils/geoUtils';
import { readFreshCachedGps, writeCachedGps } from '../utils/gpsLocation';
import { useDeviceLocation } from '../hooks/useDeviceLocation';

/**
 * How many place suggestions a picker shows. A focused list beats a long one:
 * ranked matches land in the first few rows, and anything deeper is reachable
 * by typing more characters. The window widens for 1-2 character queries, which
 * are prefix scans over the whole corpus — shared with the distance calculator
 * so the two surfaces cannot drift apart.
 */
const CITY_SUGGESTION_LIMIT = 8;

/** How many corridor places a highway code query previews. */
const CORRIDOR_PREVIEW_LIMIT = 6;

interface CorridorGroup {
  code: string;
  name: string;
  route: string;
  placeCount: number;
  places: CityNode[];
}

/**
 * Expands a highway-code query into the "places on this highway" block. Empty
 * for anything that is not a highway code, so ordinary name search is
 * unaffected. Kept beside the planner so both pickers behave identically.
 */
function buildCorridorGroups(query: string): CorridorGroup[] {
  if (!isHighwayQuery(query)) return [];
  return searchHighways(query).map((highway) => ({
    code: highway.code,
    name: highway.name,
    route: highway.route,
    placeCount: highway.placeCount,
    places: getHighwayPlaces(highway.code)
      .slice(0, CORRIDOR_PREVIEW_LIMIT)
      .map((place, index) => highwayPlaceToCityNode(place, index)),
  }));
}

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
  /** Parent-owned share modal (avoid double-mounting ShareTripModal here). */
  onShareTrip?: () => void;
  /** Parent-owned pre-trip checklist modal. */
  onOpenPreTrip?: () => void;
  /** App language for speech recognition and labels. */
  uiLanguage?: 'EN' | 'NE';
  /**
   * Incidents from the live feed. Routes are never decorated with placeholder
   * reports: with no feed, the planner simply plans against the road network.
   */
  liveIncidents?: RoadIncident[];
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

/**
 * City types that name a real settlement you can route *from*. The expanded
 * corpus also carries temples, tourist places, airports and bus stations; those
 * are destinations, so snapping a GPS fix to "Kathmandu Durbar Square" produced
 * a place the user was not actually standing in. Curated junctions have no
 * cityType, so an unset type counts as a settlement.
 */
const SETTLEMENT_CITY_TYPES = new Set([
  'metropolitan city',
  'sub-metropolitan',
  'sub metropolitan',
  'municipality',
  'rural municipality',
  'highway town',
  'city',
  'town',
  'village',
]);

const isSettlementCity = (city: CityNode): boolean => {
  if (!city.cityType) return true;
  return SETTLEMENT_CITY_TYPES.has(city.cityType.trim().toLowerCase());
};

/**
 * Nearest entry in `cities` to a fix, optionally restricted to settlements.
 * Returns null when the list is empty or nothing qualifies.
 */
const findNearestCity = (
  lat: number,
  lng: number,
  cities: CityNode[],
  predicate?: (city: CityNode) => boolean
): { city: CityNode; distanceKm: number } | null => {
  let closestCity: CityNode | null = null;
  let minDistKm = Infinity;
  for (const city of cities) {
    if (predicate && !predicate(city)) continue;
    const d = getDistanceKm(city.lat, city.lng, lat, lng);
    if (d < minDistKm) {
      minDistKm = d;
      closestCity = city;
    }
  }
  return closestCity ? { city: closestCity, distanceKm: minDistKm } : null;
};

/**
 * The place a GPS fix should read as. Prefers the nearest real settlement, then
 * the nearest surveyed highway junction, and only then anything else. This keeps
 * the planner's "My Location" describing where the user is instead of whichever
 * attraction happens to sit closest.
 */
const findClosestCityFromCoords = (lat: number, lng: number, cities: CityNode[]): { city: CityNode; distanceKm: number } | null => {
  if (!cities || cities.length === 0) {
    return null;
  }
  return (
    findNearestCity(lat, lng, cities, isSettlementCity) ||
    findNearestCity(lat, lng, cities)
  );
};

type DetailModuleTab =
  | 'none'
  | 'travel_plan'
  | 'fuel_tolls'
  | 'ai_advisory'
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
  onShareTrip,
  onOpenPreTrip,
  uiLanguage = 'EN',
  liveIncidents = [],
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
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  // Bumped once the corridor catalogue lands so highway-code queries recompute
  // against real data rather than the empty pre-load state.
  const [corridorVersion, setCorridorVersion] = useState(0);
  const [highwayCount, setHighwayCount] = useState(0);
  useEffect(() => {
    preloadHighwayCatalogue().then(() => {
      setCorridorVersion((version) => version + 1);
      setHighwayCount(getHighwayCatalogue().length);
    });
  }, []);

  useEffect(() => {
    if (!isBrowserOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsBrowserOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isBrowserOpen]);
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
  // Live values read inside applyGpsFix, which must stay stable (it is a
  // dependency of the fix effect) while still seeing the current inputs.
  const locationModeRef = useRef(locationMode);
  /** Name the last GPS fix resolved to, so a follow-up fix can refresh it. */
  const previousGpsNameRef = useRef<string>('');

  // Modern stepper: origin -> destination -> vehicle -> results
  type RoutePlannerStep = 'origin' | 'destination' | 'vehicle' | 'results';
  const [routePlannerStep, setRoutePlannerStep] = useState<RoutePlannerStep>(() => {
    if (initialOriginId && initialDestId) return 'vehicle';
    if (initialOriginId || detectedLocation) return 'destination';
    return 'origin';
  });

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

  // How many places a search can actually return. Read from the live corpus so
  // the hint under the search bar states a real number instead of a claim that
  // may drift as data files are added.
  const searchablePlaceCount = useMemo(
    () => allCities.filter((city) => city.id && city.name).length,
    [allCities],
  );

  // Mirrors of the fields applyGpsFix writes into, so it can tell a field the
  // user typed in from one it filled itself. Kept in refs because applyGpsFix is
  // a dependency of the fix effect and must not change identity per keystroke.
  const originSearchQueryRef = useRef(originSearchQuery);
  const singleSearchQueryRef = useRef(singleSearchQuery);
  useEffect(() => {
    locationModeRef.current = locationMode;
    originSearchQueryRef.current = originSearchQuery;
    singleSearchQueryRef.current = singleSearchQuery;
  }, [locationMode, originSearchQuery, singleSearchQuery]);

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
      : EV_KM_PER_KWH;
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
        : EV_KM_PER_KWH;
    setCustomMileageKmL(defaultVal);
  }, [vehicle]);

  // Who is using this trip plan: drives which tools/services are surfaced after a route is found.
  // 'driver' shows vehicle-operating tools (fuel/toll cost, eco footprint, pre-trip checklist).
  // 'passenger' hides those and keeps only what someone riding along actually needs.
  const [travelerMode, setTravelerMode] = useState<'driver' | 'passenger'>('driver');

  const estimatedTripCostNpr = useMemo(() => {
    if (!routePlan) return 0;
    const effKmL = Math.max(1.0, customMileageKmL);
    const unitsReq = Math.round((routePlan.totalDistanceKm / effKmL) * 10) / 10;
    const price = fuelPrices ? getEffectiveFuelRate(vehicle, fuelPrices) : getNOCFuelRate(vehicle);
    return Math.round(unitsReq * price) + (routePlan.totalTollCostNpr || 0);
  }, [routePlan, customMileageKmL, fuelPrices, vehicle]);

  // Highway codes covered by the route, used to look up the toll plazas the
  // route actually passes. Without this the fuel estimator showed Rs 0 in tolls
  // because it had no codes to search with.
  const routeHighwayCodes = useMemo(() => {
    if (!routePlan) return [];
    const codes = new Set<string>();
    for (const step of routePlan.steps ?? []) {
      const code = step.highwayCode;
      if (code && code !== 'AERIAL' && code !== 'undefined') codes.add(code);
    }
    return Array.from(codes);
  }, [routePlan]);


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

  // Toast Feedback (share modal owned by App — no local ShareTripModal)
  const [trafficSyncedNotification, setTrafficSyncedNotification] = useState<boolean>(false);

  // Telemetry data for embedded option tabs (if opened)

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

  // Signed-in user, printed on the report letterhead
  const { user } = useAuth();

  // Collapsible / reorderable planner sections (order + state persist)
  const PLANNER_SECTION_IDS = ['search', 'results'] as string[];
  const sections = usePlannerSections(PLANNER_SECTION_IDS, ['search']);
  const sectionIndex = (id: string) => sections.state.order.indexOf(id);
  const sectionMoveUp = (id: string) => (sectionIndex(id) > 0 ? () => sections.move(id, -1) : undefined);
  const sectionMoveDown = (id: string) =>
    sectionIndex(id) >= 0 && sectionIndex(id) < sections.state.order.length - 1
      ? () => sections.move(id, 1)
      : undefined;

  // Reels-style deck: which planner card is in front
  const [deckActive, setDeckActive] = useState<'search' | 'results' | 'vehicle'>('search');
  // Keep the deck pointing at something that actually exists
  useEffect(() => {
    if (hasCalculated && deckActive === 'search') setDeckActive('results');
    if (!hasCalculated && deckActive !== 'search') setDeckActive('search');
  }, [hasCalculated, deckActive]);

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

  // Update stepper when origin/destination/calculated state changes
  useEffect(() => {
    if (hasCalculated && routePlan) {
      setRoutePlannerStep('results');
    } else if (originId && destId) {
      setRoutePlannerStep('vehicle');
    } else if (originId || detectedLocation) {
      setRoutePlannerStep('destination');
    } else {
      setRoutePlannerStep('origin');
    }
  }, [originId, destId, hasCalculated, routePlan, detectedLocation]);

  // Auto-focus inputs based on current step
  useEffect(() => {
    if (routePlannerStep === 'origin' && !originId && !detectedLocation) {
      setTimeout(() => originInputRef.current?.focus(), 150);
    } else if (routePlannerStep === 'destination' && originId && !destId) {
      setTimeout(() => {
        if (locationMode === 'my_location') {
          singleSearchInputRef.current?.focus();
        } else {
          destInputRef.current?.focus();
        }
      }, 150);
    }
  }, [routePlannerStep, originId, destId, detectedLocation, locationMode]);

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

  // Filter cities for search dropdowns. Memoized because this scans the whole
  // merged corpus; each picker excludes the place already chosen in the other
  // field so the user cannot plan Kathmandu -> Kathmandu. The limit widens for
  // 1-2 character queries, and the totals let the dropdown say what it hid.
  const filteredOriginCities = useMemo(
    () => filterCities(allCities, originSearchQuery, citySuggestionLimit(originSearchQuery), {
      excludeIds: destId ? new Set([destId]) : undefined,
    }),
    [allCities, originSearchQuery, destId]
  );
  const filteredDestCities = useMemo(
    () => filterCities(allCities, destSearchQuery, citySuggestionLimit(destSearchQuery), {
      excludeIds: originId ? new Set([originId]) : undefined,
    }),
    [allCities, destSearchQuery, originId]
  );
  const filteredSingleCities = useMemo(
    () => filterCities(allCities, singleSearchQuery, citySuggestionLimit(singleSearchQuery), {
      excludeIds: originId ? new Set([originId]) : undefined,
    }),
    [allCities, singleSearchQuery, originId]
  );
  const originMatchCount = useMemo(
    () => countCityMatches(allCities, originSearchQuery, { excludeIds: destId ? new Set([destId]) : undefined }),
    [allCities, originSearchQuery, destId]
  );
  const destMatchCount = useMemo(
    () => countCityMatches(allCities, destSearchQuery, { excludeIds: originId ? new Set([originId]) : undefined }),
    [allCities, destSearchQuery, originId]
  );
  const singleMatchCount = useMemo(
    () => countCityMatches(allCities, singleSearchQuery, { excludeIds: originId ? new Set([originId]) : undefined }),
    [allCities, singleSearchQuery, originId]
  );

  /**
   * A highway code ("NH01", "NH44") is answered from the corridor catalogue
   * rather than the place list, so a user who knows the road but not the towns
   * on it is not stuck.
   */
  const originHighwayGroups = useMemo(() => buildCorridorGroups(originSearchQuery), [originSearchQuery, corridorVersion]);
  const destHighwayGroups = useMemo(() => buildCorridorGroups(destSearchQuery), [destSearchQuery, corridorVersion]);

  /**
   * A place picked from the highway browser fills the destination when the
   * origin is already settled, and the origin otherwise, so browsing a corridor
   * still ends in a usable pair.
   */
  const handleBrowserSelectPlace = (city: CityNode) => {
    if (originId && originId !== city.id) {
      setDestId(city.id);
      setDestSearchQuery(city.name);
      setSingleSearchQuery(city.name);
      setUserPickedDestination(true);
    } else {
      setOriginId(city.id);
      setOriginSearchQuery(city.name);
      setOriginSelected(true);
    }
    setIsBrowserOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
  };

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
      const plan = findOptimizedRoute(fromId, toId, pref, veh, terrainFilters, originCity || undefined, destCity || undefined, liveIncidents);
      // Respect the chosen preference, but never present a straight-line
      // approximation as a road distance.
      const resolved = plan ? pickVerifiedRoute(plan) : null;
      if (resolved && fuelPrices) {
        const updatedPlan = applyLiveFuelPrices(resolved, veh, fuelPrices);
        setRoutePlan(updatedPlan);
        onRouteCalculated(updatedPlan);
      } else if (resolved) {
        setRoutePlan(resolved);
        onRouteCalculated(resolved);
      }
      setHasCalculated(true);
      setActiveModuleTab('ahead');

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
      setIsReportExpanded(false);
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

  // One shared device watcher, for the whole app. Every fix re-resolves the
  // "from" place, so the planner follows the user as they walk or drive instead
  // of holding the position captured when the page opened.
  const {
    fix: liveFix,
    watching: liveTracking,
    accuracyLabel: liveAccuracy,
    error: liveLocationError,
    restart: restartTracking,
    refresh: refreshTracking,
    stop: stopTracking,
  } = useDeviceLocation();

  /**
   * Apply one GPS fix to the planner: the raw coordinates, the nearest real
   * settlement as the "from" place, and the nearest surveyed highway junction.
   * Used by the auto-detect effect, by the cached fix it reuses, and by an
   * explicit refresh, so all three paths resolve the same way.
   *
   * Fixes arrive continuously now, so anything that writes into a text field has
   * to be guarded: the search boxes belong to the user once they start typing,
   * and a fix arriving every second must not erase what they typed. The origin
   * fields also stay untouched in custom mode, where the user picked the "from"
   * place by hand.
   */
  const applyGpsFix = useCallback((latitude: number, lng: number) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(lng) || (latitude === 0 && lng === 0)) return;
    setDetectedLocation({ lat: latitude, lng });

    const result = findClosestCityFromCoords(latitude, lng, allCitiesRef.current);
    const myLocationMode = locationModeRef.current === 'my_location';
    const resolvedName = result?.city.name ?? '';

    if (result) {
      if (myLocationMode) setOriginId(result.city.id);
      setGpsOriginCityId(result.city.id);
      setGpsOriginDistanceKm(result.distanceKm);
      // Only seed the boxes while they are empty (or still hold the previously
      // resolved name), so a live fix never fights the user's typing.
      if (myLocationMode && originSearchQueryRef.current.trim() === '') {
        setOriginSearchQuery(resolvedName);
      } else if (originSearchQueryRef.current === previousGpsNameRef.current) {
        setOriginSearchQuery(resolvedName);
      }
      // The destination box is the user's to type into. A live GPS fix must
      // never seed it, otherwise the dropdown's "start typing" hint and the
      // clear button both appear before the user has done anything.
      previousGpsNameRef.current = resolvedName;

      const nearestJunction = findNearestHighwayJunction(latitude, lng);
      if (nearestJunction.city && nearestJunction.distanceKm != null) {
        setGpsNearestJunction({
          name: nearestJunction.city.name,
          distanceKm: nearestJunction.distanceKm,
          connectedHighways: nearestJunction.city.connectedHighways,
        });
      }

      const nearestHighway = findNearestHighwayFromCoords(latitude, lng);
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
      setGpsOriginCityId('');
      setGpsOriginDistanceKm(null);
      if (myLocationMode) setOriginId('');
    }
    setOriginSelected(true);
  }, []);

  /**
   * Ask for a fresh fix. The shared watcher delivers it through the effect that
   * calls applyGpsFix, so the planner, the map and My Location all update from
   * the same fix rather than each requesting its own.
   * keepMenuOpen: when true (My Location card click), refresh GPS but leave the
   * "Change Origin" dropdown visible so the user can still switch origin.
   */
  const handleDetectDeviceLocation = useCallback(async (keepMenuOpen: boolean = false) => {
    if (!navigator.geolocation) {
      setLocationPermissionDenied(true);
      if (!keepMenuOpen) setIsLocationMenuOpen(false);
      return;
    }

    let denied = false;
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      denied = status.state === 'denied';
    } catch {
      // Permissions API unsupported — let the geolocation call itself prompt.
    }

    setLocationPermissionDenied(denied);
    if (denied) {
      if (!keepMenuOpen) setIsLocationMenuOpen(false);
      return;
    }

    restartTracking();
    refreshTracking();
    if (!keepMenuOpen) setIsLocationMenuOpen(false);
  }, [restartTracking, refreshTracking]);

  // Auto-detect GPS on mount: ask permission if not yet decided.
  // Once detected, the GPS location is a permanent "fact" — it is not
  // cleared or overridden when the user picks a different "from" city.
  //
  // The watcher is shared with the map and My Location, so all three surfaces
  // describe the same position.
  useEffect(() => {
    // Wait for expanded cities (palikas, POIs, etc.) to load before GPS detection
    // so we match against the full dataset for better accuracy.
    let cancelled = false;
    loadExpandedCities()
      .then((cities) => {
        if (cancelled) return;
        allCitiesRef.current = cities;
        setAllCities(cities);
      })
      .catch(() => {
        // Fallback to cached cities
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-resolve on every fix, so the planner follows the user as they move. The
  // search boxes are only seeded while empty, so continuous fixes never erase
  // what the user typed. Keyed on the fix timestamp so the same position is not
  // re-applied when an unrelated state change re-runs this effect.
  useEffect(() => {
    if (liveFix) {
      applyGpsFix(liveFix.lat, liveFix.lng);
      return;
    }
    // No fix yet — reuse the last known one so the card is not blank.
    const cached = readFreshCachedGps();
    if (cached) applyGpsFix(cached.lat, cached.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFix?.timestamp, applyGpsFix]);

  // Voice Speech Recognition Handler
  const startVoiceRecognition = (target: 'single' | 'origin' | 'dest' | 'ai') => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSpeechTranscriptNotice('Speech Recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      setTimeout(() => {
        setListeningTarget(null);
        setSpeechTranscriptNotice(null);
      }, 3000);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = uiLanguage === 'NE' ? 'ne-NP' : 'en-US';
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

  const handleShowLocationOnMap = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (locationMode === 'my_location' && detectedLocation) {
      onViewOnMap?.({
        lat: detectedLocation.lat,
        lng: detectedLocation.lng,
        title: gpsOriginCity?.name || 'My Location',
        zoom: 14,
      });
    } else if (originCity) {
      onViewOnMap?.({
        lat: originCity.lat,
        lng: originCity.lng,
        title: originCity.name,
        zoom: 14,
      });
    } else if (detectedLocation) {
      onViewOnMap?.({
        lat: detectedLocation.lat,
        lng: detectedLocation.lng,
        title: 'My Location',
        zoom: 14,
      });
    } else {
      handleDetectDeviceLocation(false);
    }
  };

  const handleSwitchToGps = () => {
    setLocationMode('my_location');
    setIsLocationMenuOpen(false);
    if (hasCalculated) {
      setHasCalculated(false);
      setDeckActive('search');
      setRoutePlan(null);
      onRouteClear?.();
    }
    handleDetectDeviceLocation(false);
    setRoutePlannerStep('destination');
    setTimeout(() => {
      singleSearchInputRef.current?.focus();
      setIsSingleDropdownOpen(true);
    }, 150);
  };

  const handleSwitchToCustomOrigin = () => {
    setLocationMode('custom_from_to');
    setIsLocationMenuOpen(false);
    if (hasCalculated) {
      setHasCalculated(false);
      setDeckActive('search');
      setRoutePlan(null);
      onRouteClear?.();
    }
    setRoutePlannerStep('origin');
    setOriginId('');
    setOriginSearchQuery('');
    setTimeout(() => {
      originInputRef.current?.focus();
      setIsOriginDropdownOpen(true);
    }, 150);
  };

  const handleReturnToDefault = () => {
    setLocationMode('my_location');
    setIsLocationMenuOpen(false);
    if (hasCalculated) {
      setHasCalculated(false);
      setDeckActive('search');
      setRoutePlan(null);
      setActiveModuleTab('none');
      onRouteClear?.();
    }
    setRoutePlannerStep('destination');
    handleDetectDeviceLocation(false);
    setTimeout(() => {
      singleSearchInputRef.current?.focus();
      setIsSingleDropdownOpen(true);
    }, 150);
  };

  const handleEditLocations = () => {
    setHasCalculated(false);
    setDeckActive('search');
    setLocationMode('custom_from_to');
    if (routePlan) {
      setOriginId(routePlan.origin.id);
      setOriginSearchQuery(routePlan.origin.name);
      setDestId(routePlan.destination.id);
      setDestSearchQuery(routePlan.destination.name);
    }
    setRoutePlannerStep('destination');
    setTimeout(() => {
      destInputRef.current?.focus();
    }, 150);
  };

  const handleNewRoute = () => {
    setRoutePlannerStep('origin');
    setHasCalculated(false);
    setRoutePlan(null);
    setDeckActive('search');
    setLocationMode('custom_from_to');
    setOriginId('');
    setOriginSearchQuery('');
    setDestId('');
    setDestSearchQuery('');
    setSingleSearchQuery('');
    setActiveModuleTab('none');
    onRouteClear?.();
    setTimeout(() => {
      originInputRef.current?.focus();
      setIsOriginDropdownOpen(true);
    }, 150);
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

  // What the report's fuel/energy figure was priced with, so the report can state it.
  const buildFuelBasis = (): ReportFuelBasis => {
    const isEv = vehicle === 'electric_vehicle';
    const usingDefaults = !fuelPrices || !fuelPriceMetadata;
    return {
      fuelName: isEv ? 'Electricity' : vehicle === 'suv_4wd' || vehicle === 'bus_truck' ? 'Diesel' : 'Petrol',
      ratePerUnit: getEffectiveFuelRate(vehicle, fuelPrices),
      unit: isEv ? 'kWh' : 'L',
      sourceLabel: fuelPriceMetadata?.sourceLabel || fuelPriceMetadata?.source,
      lastUpdated: fuelPriceMetadata?.lastUpdated,
      usingDefaults,
      fallbackAsOf: NOC_FUEL_RATES_AS_OF,
    };
  };

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
      {isBrowserOpen && (
        <HighwayBrowser
          cities={allCities}
          onSelectPlace={handleBrowserSelectPlace}
          onClose={() => setIsBrowserOpen(false)}
        />
      )}
      {/* Main Clean Route Planner Box — Reels-style 3D deck of separate cards */}
      <PlannerDeck
        items={[
          { id: 'search', label: 'Search' },
          ...(hasCalculated && routePlan
            ? [{ id: 'results', label: 'Route' }, { id: 'vehicle', label: 'Vehicle & route' }]
            : []),
        ]}
        activeId={deckActive}
        onChange={(id) => setDeckActive(id as 'search' | 'results' | 'vehicle')}
      >
        {(deckId) => (
      <div className="space-y-3">
      {/* 1. MY LOCATION CARD - Always visible */}
      <div ref={locationMenuRef} className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-4 sm:p-5">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              onClick={() => {
                if (locationMode === 'custom_from_to') {
                  handleReturnToDefault();
                } else {
                  setIsLocationMenuOpen((prev) => !prev);
                }
              }}
              id="btn-my-location-toggle"
              className="flex items-center space-x-3 group select-none rounded-2xl px-3 py-2.5 border transition min-w-0 flex-1 cursor-pointer bg-slate-950/60 hover:bg-slate-950 border-slate-800 hover:border-emerald-500/50 shadow-inner"
              title={locationMode === 'custom_from_to' ? 'Return to default' : 'Change Location'}
              role="button"
              aria-expanded={isLocationMenuOpen}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (locationMode === 'my_location') {
                    if (liveTracking) stopTracking();
                    else restartTracking();
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition ${
                  (locationMode === 'my_location' && detectedLocation) || (locationMode === 'custom_from_to' && originCity)
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title={locationMode === 'my_location'
                  ? (liveTracking ? 'Stop following your position (saves battery)' : 'Start following your position')
                  : 'Open location options'}
                id="btn-my-location-icon"
              >
                {locationMode === 'my_location' && detectedLocation ? (
                  <MapPin className="w-5 h-5 text-emerald-400" />
                ) : originCity ? (
                  <MapPin className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Crosshair className="w-5 h-5 text-slate-400" />
                )}
</button>
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">
                  {locationMode === 'my_location'
                    ? (detectedLocation
                        ? (gpsOriginCity ? gpsOriginCity.name : 'GPS Location Acquired')
                        : 'My Location (GPS)')
                    : (originCity ? originCity.name : 'My Location')}
                </span>
              </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {locationMode === 'my_location'
                    ? (detectedLocation
                        ? (gpsOriginCity
                            ? (gpsOriginCity.district || gpsOriginCity.province
                                ? `${gpsOriginCity.district || ''}${gpsOriginCity.district && gpsOriginCity.province ? ' · ' : ''}${gpsOriginCity.province || ''}`
                                : 'Nearest surveyed place')
                            : 'Off the surveyed network')
                        : 'Waiting for a GPS fix — your origin updates automatically')
                    : 'Back to the current location'}
                </div>
              {detectedLocation && locationMode === 'my_location' && (
                <div className="text-[10px] text-emerald-400/80 font-mono truncate mt-0.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${
                    liveTracking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`} />
                  {liveTracking ? 'LIVE' : 'FIXED'}{' '}
                  {detectedLocation.lat.toFixed(5)}, {detectedLocation.lng.toFixed(5)}
                  {liveAccuracy && (
                    <span className="text-slate-500"> · {liveAccuracy}</span>
                  )}
                  {gpsNearestJunction?.name && (
                    <span className="text-slate-500"> · near {gpsNearestJunction.name}</span>
                  )}
                </div>
              )}
              {locationMode === 'my_location' && !detectedLocation && (
                <div className={`text-[10px] font-medium truncate mt-0.5 ${
                  liveLocationError ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {liveLocationError
                    ? 'Location blocked — allow GPS access, or pick an origin below'
                    : 'Looking for a GPS signal…'}
                </div>
              )}
              {detectedLocation && gpsNearestHighway && locationMode === 'my_location' && (
                <div className="text-[10px] text-cyan-400 font-medium truncate mt-0.5">
                  {gpsNearestHighway.code} ({gpsNearestHighway.name}) · {gpsNearestHighway.distanceKm.toFixed(1)} km away
                </div>
              )}
            </div>
            {locationMode === 'custom_from_to' ? (
              <ArrowLeft
                onClick={(e) => {
                  e.stopPropagation();
                  handleReturnToDefault();
                }}
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 cursor-pointer group-hover:text-emerald-400`}
              />
            ) : (
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 cursor-pointer ${isLocationMenuOpen ? 'rotate-180 text-emerald-400' : ''}`} />
            )}
          </div>

          {/* Quick Action Buttons on Location Card */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {!hasCalculated && (
              <button
                type="button"
                onClick={handleShowLocationOnMap}
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                title="Show location on map"
                id="btn-show-location-map"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span>Show on Map</span>
              </button>
            )}
          </div>
        </div>

        {/* Location Dropdown Options Menu — only shown in my_location mode.
           In custom_from_to mode, the card shows a return icon instead. */}
        {locationMode === 'my_location' && isLocationMenuOpen && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSwitchToGps();
              }}
              className={`flex items-center space-x-3 p-3 rounded-xl border transition text-left border-emerald-500/50 bg-emerald-950/30 text-white`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                locationPermissionDenied ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <ArrowUpDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Use Device GPS</span>
                  {locationMode === 'my_location' && (
                    <span className="text-[10px] text-emerald-400 font-normal">(Active)</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {locationPermissionDenied
                    ? 'GPS blocked — allow it in your browser, then tap to retry'
                    : 'Follows your live position as the origin'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSwitchToCustomOrigin();
              }}
              className={`flex items-center space-x-3 p-3 rounded-xl border transition text-left border-slate-800 hover:border-sky-500/30 bg-slate-950/80 hover:bg-slate-800/80`}
            >
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <ArrowUpDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Change Origin City / Hub</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Type origin &amp; destination manually
                </div>
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
         {deckId === 'search' && !hasCalculated && (
            locationMode === 'my_location' ? (
              /* SINGLE SEARCH BAR with functional Mic and AI icons */
              <div className="space-y-2 relative" ref={singleSearchRef}>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4 text-emerald-400" />
              </div>

              <input
                ref={singleSearchInputRef}
                type="text"
                name="merosadak-single-dest"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                inputMode="text"
                onChange={(e) => {
                  setSingleSearchQuery(e.target.value);
                  closeAllMenus('single');
                  setIsSingleDropdownOpen(true);
                }}
                onFocus={() => {
                  closeAllMenus('single');
                  setIsSingleDropdownOpen(true);
                }}
                placeholder='Where to?'
                className={`w-full rounded-xl pl-10 pr-24 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium ${
                  destId
                    ? 'bg-slate-950 border-2 border-emerald-500/60 focus:border-emerald-400'
                    : 'bg-slate-950 border border-slate-800 focus:border-emerald-500'
                }`}
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
                  title="Voice search"
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
                  title="AI assistant"
                  id="btn-ai-prompt-single"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </button>

                {/* Browse by Highway Button — same round style as the Voice and AI icons */}
                {highwayCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBrowserOpen(true)}
                    className="p-1.5 rounded-lg border text-xs transition bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700"
                    title="Browse by highway"
                    id="btn-browse-highway-single"
                  >
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Destination Autocomplete Suggestions Dropdown */}
              {isSingleDropdownOpen && (
                <CitySuggestionDropdown
                  query={singleSearchQuery}
                  results={filteredSingleCities}
                  searchablePlaceCount={searchablePlaceCount}
                  onSelect={(city) => {
                    setDestId(city.id);
                    setSingleSearchQuery(city.name);
                    setDestSearchQuery(city.name);
                    setIsSingleDropdownOpen(false);
                    setUserPickedDestination(true);
                    if (hasCalculated) setNeedsRecalculation(true);
                  }}
                  totalMatches={singleMatchCount}
                />
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
                   name="merosadak-origin"
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
                   placeholder='From where?'
                   autoComplete="off"
                   autoCorrect="off"
                   autoCapitalize="off"
                   spellCheck="false"
                   inputMode="text"
                   className={`w-full rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium ${
                     originId
                       ? 'bg-slate-950 border-2 border-emerald-500/60 focus:border-emerald-400'
                       : 'bg-slate-950 border border-slate-800 focus:border-emerald-500'
                   }`}
                />
<button
                   onClick={() => startVoiceRecognition('origin')}
                   className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md transition touch-target ${
                     listeningTarget === 'origin'
                       ? 'bg-rose-500 text-white animate-pulse'
                       : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                   }`}
                   title="Voice input for Origin"
                   aria-label="Voice input for origin"
                 >
                   <Mic className="w-4 h-4" />
                 </button>
               </div>

              {isOriginDropdownOpen && (
                <CitySuggestionDropdown
                  query={originSearchQuery}
                  results={filteredOriginCities}
                  searchablePlaceCount={searchablePlaceCount}
                  onSelect={handleSelectOrigin}
                  totalMatches={originMatchCount}
                  showTouchLegend
                  highwayGroups={originHighwayGroups}
                />
              )}
             </div>

             {/* SWAP BUTTON */}
            <div className="md:col-span-2 flex justify-center pt-1 md:pt-4">
              <button
                onClick={handleSwapLocations}
                title="Swap Origin and Destination"
                className="touch-target rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow active:scale-95"
                aria-label="Swap origin and destination"
              >
                <ArrowUpDown className="w-5 h-5" />
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
                  name="merosadak-dest"
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
                      placeholder='Where to?'
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      inputMode="text"
                      className={`w-full rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium ${
                        destId
                          ? 'bg-slate-950 border-2 border-cyan-500/60 focus:border-cyan-400'
                          : 'bg-slate-950 border border-slate-800 focus:border-cyan-500'
                      }`}
                />
                <button
                  onClick={() => startVoiceRecognition('dest')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md transition touch-target ${
                    listeningTarget === 'dest'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Voice input for Destination"
                  aria-label="Voice input for destination"
                >
                  <Mic className="w-4 h-4" />
                </button>
                {(destSearchQuery || destId) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearDestination(); }}
                    className="absolute right-11 top-1/2 -translate-y-1/2 p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition touch-target"
                    title="Clear destination"
                    aria-label="Clear destination"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

{isDestDropdownOpen && (
                <CitySuggestionDropdown
                  query={destSearchQuery}
                  results={filteredDestCities}
                  searchablePlaceCount={searchablePlaceCount}
                  onSelect={handleSelectDestination}
                  totalMatches={destMatchCount}
                  showTouchLegend
                  highwayGroups={destHighwayGroups}
                />
              )}
              </div>
            </div>
          ))}

      {/* Search coverage banner — continuous full-width marquee, one line at a time,
          shared by every dropdown so the count is seen once and never repeated. */}
      {deckId === 'search' && !hasCalculated && (
        <div className="w-full bg-slate-900/40 border-b border-slate-800 py-1.5 overflow-hidden">
          <div className="flex items-center justify-center gap-8 px-4 animate-marquee">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              Search {searchablePlaceCount.toLocaleString('en-US')} places — cities and palikas. Just one letter is enough to start.
            </span>
          </div>
        </div>
      )}

      {/* The "Searching N places …" banner and the "Start typing a place
              name, or a highway code like NH01" hint live inside each dropdown
              (CitySuggestionDropdown), so they appear with the search bar and
              disappear together when a selection is made. */}

          {/* AI Prompt Input Bar (If user clicks AI icon) - Hidden after calculation */}
          {deckId === 'search' && !hasCalculated && isAiPromptOpen && (
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
                name="merosadak-ai-prompt"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={aiPromptText}
                onChange={(e) => setAiPromptText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteAiPrompt()}
                placeholder="Describe your route, e.g. scenic ride avoiding steep climbs"
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
       {deckId === 'results' && hasCalculated && routePlan && !sections.isExpanded('results') && (
         <>
         <div className="rounded-2xl overflow-hidden">
          <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                const willExpand = !sections.isExpanded('results');
                sections.toggle('results');
                setIsReportExpanded(willExpand);
              }}
              aria-expanded={sections.isExpanded('results')}
              className="flex min-w-0 flex-1 items-center gap-2 text-left group"
            >
              <Compass className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="shrink-0 text-xs font-black text-white font-display">Results</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400 font-mono">
                {routePlan.totalDistanceKm} km · {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m · {routePlan.origin.name} → {routePlan.destination.name}
              </span>
              <span className={`shrink-0 text-slate-400 transition group-hover:text-slate-200 ${sections.isExpanded('results') ? 'rotate-180' : ''}`}>
                <ChevronDown className="h-4 w-4" />
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {sectionMoveUp('results') && (
                <button type="button" onClick={sectionMoveUp('results')} title="Move results up" aria-label="Move results up"
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              )}
              {sectionMoveDown('results') && (
                <button type="button" onClick={sectionMoveDown('results')} title="Move results down" aria-label="Move results down"
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </header>
          {/* Reduced view: keep the key numbers visible without expanding */}
          {!sections.isExpanded('results') && (
            <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300 animate-fadeIn">
              <span className="flex items-center gap-1 text-white font-bold">
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                {routePlan.totalDistanceKm} km
              </span>
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m
              </span>
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                <Fuel className="h-3.5 w-3.5 text-amber-400" />
                Rs {estimatedTripCostNpr.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                {routePlan.roadConditionScore}
              </span>
              <button
                type="button"
                onClick={() => { sections.setExpanded('results', true); setIsReportExpanded(true); }}
                className="ml-auto text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
              >
                <span>Expand</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
{sections.isExpanded('results') && (
          <div
            id="route-results-panel"
            key={`route-results-panel-${calcKey}-${routePlan.id}`}
            className="p-3 sm:p-4 space-y-3 animate-fade-in-smooth transition-all duration-500 ease-out max-w-full"
         >
            {/* 1. ROUTE HEADER */}
            <div className="flex items-center justify-between gap-3 px-3 py-3 border border-slate-800/50 bg-slate-900/30 rounded-2xl">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">From</span>
                <span className="text-sm font-bold text-white truncate leading-tight">
                  {routePlan.origin.name || routePlan.origin.id}
                </span>
              </div>
              <span className="text-[10px] text-slate-600 shrink-0 self-start sm:self-center">→</span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">To</span>
                <span className="text-sm font-bold text-white truncate leading-tight">
                  {routePlan.destination.name || routePlan.destination.id}
                </span>
              </div>
              <button
                type="button"
                onClick={handleEditLocations}
                className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold shrink-0 px-2 py-1 rounded-md hover:bg-emerald-500/10 transition"
                title="Change origin or destination"
              >
                Change
              </button>
            </div>

            {/* 2. KEY METRICS — one compact line */}
            <div className="px-3 py-2 border-b border-slate-800/50 bg-slate-900/20 rounded-b-2xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 gap-y-2 text-xs font-mono">
                <span className="flex items-center space-x-1 text-white font-bold" title="Distance">
                  <Compass className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{routePlan.totalDistanceKm} km</span>
                </span>
                <span className="flex items-center space-x-1 text-cyan-400 font-bold" title="Time">
                  <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>
                    {Math.floor(routePlan.estimatedTimeMinutes / 60)}h{' '}
                    {routePlan.estimatedTimeMinutes % 60}m
                  </span>
                </span>
                <span className="flex items-center space-x-1 text-amber-300 font-bold" title="Est. Cost">
                  <Fuel className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Rs {estimatedTripCostNpr.toLocaleString()}</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-400 font-bold" title="Safety">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{routePlan.roadConditionScore}</span>
                </span>
                <span className="flex items-center space-x-1 text-purple-400 font-bold" title="Peak Elevation">
                  <Mountain className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>{routePlan.maxElevationM}m peak</span>
                </span>
              </div>
            </div>

            {/* 3. PRIMARY ACTION */}
            <div className="px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  setTravelPlanView('steps');
                  setActiveModuleTab('travel_plan');
                }}
                className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/25 transition"
                id="btn-start-trip"
              >
                <Navigation className="w-4 h-4" />
                <span>Start Trip</span>
              </button>
            </div>

            {/* 4. SECONDARY ACTIONS */}
            <div className="px-3 py-1 flex flex-wrap gap-2 text-[10px]">
              <button
                type="button"
                onClick={handleEditLocations}
                className="px-3 py-1.5 bg-slate-900/40 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Change origin or destination"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span className="ml-1">Change Location</span>
              </button>
              <button
                type="button"
                onClick={handleNewRoute}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Plan a new route"
              >
                <ArrowUpDown className="w-3 h-3 shrink-0" />
                <span className="ml-1 hidden sm:inline">New Route</span>
              </button>
              <button
                type="button"
                onClick={() => onShareTrip?.()}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
                title="Share this trip"
              >
                <Share2 className="w-3 h-3 text-emerald-400 shrink-0" />
              </button>
            </div>

            {/* 5. EXPAND / REDUCE */}
            <button
              type="button"
              onClick={() => {
                setIsReportExpanded(false);
                sections.setExpanded('results', false);
              }}
              className="w-full px-3 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
            >
              <ChevronDown className="w-3 h-3 text-emerald-400" />
              <span>Collapse results</span>
            </button>

            {/* 6. EXPANDED FULL REPORT CONTENT (one view at a time) */}
            {isReportExpanded && (
              <>
                {routePlan.allRouteOptions && routePlan.allRouteOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setResultsViewMode(resultsViewMode === 'overview' ? 'comparison' : 'overview')
                    }
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1 ${
                      resultsViewMode === 'comparison'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                    }`}
                    title="Toggle route alternatives comparison"
                  >
                    <Layers className="w-3 h-3" />
                    <span>{resultsViewMode === 'overview' ? 'Compare' : 'Overview'}</span>
                    <span className="text-[10px] opacity-60">
                      ({routePlan.allRouteOptions.length} routes)
                    </span>
                  </button>
                )}

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

                {resultsViewMode === 'overview' && (
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
                    onShare={() => onShareTrip?.()}
                    userIdentity={{
                      name: user?.displayName || undefined,
                      email: user?.email || undefined,
                    }}
                    fuelBasis={buildFuelBasis()}
                    embedded
                    showElevationProfile
                    simulationControls={simulationControls}
                    onViewOnMap={onViewOnMap}
                  />
                )}
              </>
            )}

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-950 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setTravelerMode('driver')}
                  aria-pressed={travelerMode === 'driver'}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition ${
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
                  className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition ${
                    travelerMode === 'passenger'
                      ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Passenger</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" id="route-detail-actions">
              {([
                { tab: 'ahead', label: 'Ahead', Icon: Navigation, show: true, tone: 'emerald' },
                { tab: 'travel_plan', label: 'Trip plan', Icon: Milestone, show: true, tone: 'emerald' },
                { tab: 'highway_info', label: 'Highways', Icon: Route, show: true, tone: 'cyan' },
                { tab: 'fuel_tolls', label: 'Cost & eco', Icon: Flame, show: travelerMode === 'driver', tone: 'amber' },
                { tab: 'checklist', label: 'Checklist', Icon: Wrench, show: travelerMode === 'driver', tone: 'amber' },
                { tab: 'ai_advisory', label: 'AI', Icon: Sparkles, show: true, tone: 'cyan' },
                { tab: 'sos', label: 'SOS', Icon: PhoneCall, show: true, tone: 'red' },
              ] as Array<{ tab: DetailModuleTab; label: string; Icon: React.ComponentType<{ className?: string }>; show: boolean; tone: string }>)
                .filter((a) => a.show)
                .map(({ tab, label, Icon, tone }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      if (tab === 'highway_info') {
                        onOpenHighwayDirectory?.();
                      } else {
                        handleToggleModuleTab(tab);
                      }
                    }}
                    aria-pressed={activeModuleTab === tab}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition inline-flex items-center gap-1 ${
                      activeModuleTab === tab
                        ? tone === 'red'
                          ? 'bg-red-600/30 text-red-300 border-red-500'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                        : tone === 'red'
                        ? 'bg-slate-950 hover:bg-slate-900 text-red-400 border-slate-800'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
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
                  {activeModuleTab === 'travel_plan' && <span>Trip plan</span>}
                  {activeModuleTab === 'fuel_tolls' && <span>Cost &amp; eco</span>}
                  {activeModuleTab === 'ai_advisory' && <span>AI advisory</span>}
                  {activeModuleTab === 'sos' && <span>Emergency SOS</span>}
                  {activeModuleTab === 'checklist' && <span>Vehicle checklist</span>}
                  {activeModuleTab === 'highway_info' && <span>Route highways</span>}
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

                  {/* Terrain, gradient & time-of-day traffic analysis — folded in here
                      (rather than its own tab) since it's part of planning the trip,
                      and its live weather/POI/corridor/safety-score equivalents are
                      already covered by the "Ahead" tab and the summary card above. */}
                  <RouteTerrainAndTrafficAnalysis routePlan={routePlan} vehicle={vehicle} />
                </div>
              )}

              {/* MODULE CONTENT: 6. Fuel & Tolls */}
              {activeModuleTab === 'fuel_tolls' && (
                <div className="space-y-4">
                  <FuelPriceCard
                    fuelPrices={fuelPrices}
                    metadata={fuelPriceMetadata}
                    isLoading={isLoadingPrices}
                    onRefresh={async () => {
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
                      }
                    }}
                    minutesSinceLastCheck={getMinutesSinceLastCheck()}
                    isStale={isPriceStale()}
                  />
                  <FuelCostEstimator
                    distanceKm={routePlan.totalDistanceKm}
                    vehicleType={vehicle}
                    elevationGainM={routePlan.elevationGainM}
                    origin={routePlan.origin}
                    destination={routePlan.destination}
                    defaultTollCost={routePlan.totalTollCostNpr}
                    highwayCodes={routeHighwayCodes}
                    fuelPrices={fuelPrices}
                    fuelPriceMetadata={fuelPriceMetadata}
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
                     <span>Emergency Hotlines</span>
                   </div>
                   <div className="grid grid-cols-3 gap-2.5">
                     <a href="tel:100" className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1 hover:border-rose-500/50 transition">
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Police</div>
                       <div className="text-xl font-black text-rose-400 font-mono">100</div>
                     </a>
                     <a href="tel:103" className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1 hover:border-amber-500/50 transition">
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Traffic</div>
                       <div className="text-xl font-black text-amber-400 font-mono">103</div>
                     </a>
                     <a href="tel:1114" className="bg-slate-900/90 p-3 rounded-xl border border-red-900/40 text-center space-y-1 hover:border-cyan-500/50 transition">
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">APF Rescue</div>
                       <div className="text-xl font-black text-cyan-400 font-mono">1114</div>
                     </a>
                   </div>
                 </div>
               )}

              {/* MODULE CONTENT: 10. Checklist */}
              {activeModuleTab === 'checklist' && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <p className="text-xs text-slate-300">
                    Pre-trip vehicle checklist opens in one place so it is not duplicated on this screen.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenPreTrip?.()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/50 transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Open full checklist
                  </button>
                </div>
              )}

              {/* MODULE CONTENT: 11. Highway Info */}
              {activeModuleTab === 'highway_info' && (
                <div className="space-y-3">
                  <RouteHighwayInfoPanel
                    routeHighwayCodes={routePlan.steps.map((s) => s.highwayCode).filter(Boolean)}
                    incidents={routePlan.incidentsOnRoute}
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
                      extraIncidents={liveIncidents}
                      onViewOnMap={onViewOnMap}
                    />
                  </ErrorBoundary>
                </div>
              )}
              </div>
            )}
          </div>
        )}
        </div>
        </>
       )}


         {deckId === 'vehicle' && hasCalculated && (
          <div className="space-y-3">
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
    </div>
        )}
      </PlannerDeck>
    </div>
  );
};
