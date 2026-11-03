import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
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
import { RouteComparisonView } from './RouteComparisonView';
import { ErrorBoundary } from './ErrorBoundary';
import { PlaceField, FieldIconButton } from './planner/PlaceField';
import { TripOptions } from './planner/TripOptions';
import { RouteVerdict } from './planner/RouteVerdict';
import { DetailSection } from './planner/DetailSection';
import { RouteBlocksPanel } from './planner/RouteBlocksPanel';
import { JourneyPanel } from './planner/JourneyPanel';
import { InsightsPanel } from './planner/InsightsPanel';
import { CostsPanel } from './planner/CostsPanel';
import {
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Zap,
  Sparkles,
  MapPin,
  Bike,
  Truck,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LocateFixed,
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
import { reverseGeocode, movedPastLastGeocode, shortLocalityLabel, type ReverseGeocodeAddress } from '../utils/reverseGeocode';
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
  /** Opens the emergency SOS modal. */
  onOpenSos?: () => void;
  /** App language for speech recognition and labels. */
  uiLanguage?: 'EN' | 'NE';
  /**
   * Incidents from the live feed. Routes are never decorated with placeholder
   * reports: with no feed, the planner simply plans against the road network.
   */
  liveIncidents?: RoadIncident[];
  /** Opens the full Mero Sadak AI chat panel (replaces the inline AI prompt). */
  onOpenAiAssistant?: () => void;
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
  onOpenSos,
  uiLanguage = 'EN',
  liveIncidents = [],
  onOpenAiAssistant,
}) => {
  // Routing states
  const [originId, setOriginId] = useState<string>(initialOriginId);
  const [destId, setDestId] = useState<string>(initialDestId);
  const [userPickedDestination, setUserPickedDestination] = useState<boolean>(false);
  const [needsRecalculation, setNeedsRecalculation] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<VehicleType>(initialVehicle);
  const [preference, setPreference] = useState<RoutePreference>(initialPreference);
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
  // The real address for the current fix, resolved by the same reverse geocoder
  // the My Location page uses — so the planner's "My Location" reads as the
  // same place the page reports, not just the nearest dataset settlement.
  const [gpsAddress, setGpsAddress] = useState<ReverseGeocodeAddress | null>(null);
  const gpsAddressRef = useRef<ReverseGeocodeAddress | null>(null);
  /** Last fix position the reverse geocoder was asked about (movement gate). */
  const lastGeocodeRef = useRef<{ lat: number; lng: number } | null>(null);
  /** Generational token: a slow answer for an old position never wins. */
  const geocodeSeqRef = useRef(0);

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

  // The trip's fuel + toll figure, shown by the verdict and the Costs section
  // header. It reads the plan's own fuel estimate — the same number the Costs
  // panel and the printed report use — so every surface quotes one total
  // instead of three parallel calculations that can drift apart.
  const estimatedTripCostNpr = routePlan
    ? routePlan.fuelEstimate.costNpr + (routePlan.totalTollCostNpr || 0)
    : 0;

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
  // Progressive disclosure: which detail sections are open. Defaults are
  // computed per plan — the blocks section opens itself the moment anything on
  // the route is not clear — and a fresh calculation resets every section, so
  // each new search starts with the short verdict, never with stale panels.
  type DetailSectionId = 'blocks' | 'journey' | 'insights' | 'costs' | 'routes' | 'report';
  const [openSections, setOpenSections] = useState<Partial<Record<DetailSectionId, boolean>>>({});
  const isOpen = useCallback((id: DetailSectionId, def: boolean) => openSections[id] ?? def, [openSections]);
  const openSection = useCallback((id: DetailSectionId) => {
    setOpenSections((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);
  const toggleSection = useCallback((id: DetailSectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  // Calculation animation key for smooth CSS fade-in transitions
  const [calcKey, setCalcKey] = useState<number>(0);

  // Toggle for advanced fuel/efficiency settings
  // Once Start Trip is clicked, swap it for Expand and drop secondary actions.
  const [tripStarted, setTripStarted] = useState<boolean>(false);

  // AI Custom Advisory states
  const [loadingAiAdvisory, setLoadingAiAdvisory] = useState<boolean>(false);
  const [aiCustomAdvisory, setAiCustomAdvisory] = useState<any | null>(null);
  const [userEmotion, setUserEmotion] = useState<'calm' | 'urgent' | 'stressed' | 'tired' | 'anxious' | 'excited' | 'relaxed'>('calm');

  // Toast Feedback (share modal owned by App — no local ShareTripModal)
  const [trafficSyncedNotification, setTrafficSyncedNotification] = useState<boolean>(false);

  const singleSearchRef = useRef<HTMLDivElement>(null);
  const originSearchRef = useRef<HTMLDivElement>(null);
  const destSearchRef = useRef<HTMLDivElement>(null);
  const singleSearchInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const aiPromptRef = useRef<HTMLDivElement>(null);

  // Close all dropdown menus, optionally keeping one open
  const closeAllMenus = useCallback((keepOpen: 'location' | 'single' | 'origin' | 'dest' | 'ai' | null = null) => {
    if (keepOpen !== 'location') setIsLocationMenuOpen(false);
    if (keepOpen !== 'single') setIsSingleDropdownOpen(false);
    if (keepOpen !== 'origin') setIsOriginDropdownOpen(false);
    if (keepOpen !== 'dest') setIsDestDropdownOpen(false);
    if (keepOpen !== 'ai') setIsAiPromptOpen(false);
  }, []);

  // Signed-in user, printed on the report letterhead
  const { user } = useAuth();

  // Get current city objects
  const originCity = useMemo(() => allCities.find((c) => c.id === originId), [originId, allCities]);
  const destCity = useMemo(() => allCities.find((c) => c.id === destId), [destId, allCities]);
  const gpsOriginCity = useMemo(() => allCities.find((c) => c.id === gpsOriginCityId), [gpsOriginCityId, allCities]);

  // The planner's "My Location" description, composed exactly like the My
  // Location page headline: street-level area, then municipality, then district
  // (or province when OSM gives no district) — never the same part twice. Null
  // until the shared reverse geocoder resolves, so the card falls back to the
  // nearest surveyed settlement in the meantime.
  const gpsAddressLabel = useMemo(() => {
    if (!gpsAddress) return null;
    const placeParts = [gpsAddress.localArea, gpsAddress.municipality].filter(
      (p): p is string => !!p,
    );
    const place = [...new Set(placeParts)].join(', ');
    if (!place) return null;
    const region = gpsAddress.district && !placeParts.includes(gpsAddress.district)
      ? gpsAddress.district
      : (!gpsAddress.district && gpsAddress.province) || null;
    return region ? `${place} · ${region}` : place;
  }, [gpsAddress]);

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
      // No origin yet → fly the map to the destination so the user sees the
      // actual area they are going to, not a whole-Nepal overview. When both
      // ends are set, handleRouteCalculated already flies to the route.
      if (!originId) {
        onViewOnMap?.({
          lat: city.lat,
          lng: city.lng,
          title: city.name,
          zoom: 11,
        });
      }
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
    // When the destination is picked without an origin, fly the map to it so
    // the user sees the area they are heading to, instead of a static
    // whole-Nepal overview. Once both ends are set, the route calculation
    // re-fits the map to the whole corridor.
    if (!originId) {
      onViewOnMap?.({
        lat: city.lat,
        lng: city.lng,
        title: city.name,
        zoom: 11,
      });
    }
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
      setOpenSections({});
      setTripStarted(false);

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
      // Label the origin with the real address once it has resolved — the same
      // reverse geocode the My Location page reports — falling back to the
      // nearest settlement while no address is available (first seconds,
      // offline). Only seeded while the box still reads like a GPS label
      // (empty, or exactly the label we last wrote), so a live fix never
      // fights the user's typing.
      const label = (myLocationMode && shortLocalityLabel(gpsAddressRef.current)) || resolvedName;
      if (myLocationMode && label &&
          (originSearchQueryRef.current.trim() === '' ||
           originSearchQueryRef.current === previousGpsNameRef.current)) {
        setOriginSearchQuery(label);
        previousGpsNameRef.current = label;
      }

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

    // Describe the fix with the shared reverse geocoder so this card reads as
    // the same place the My Location page reports. Throttled by movement and
    // cached per ~110 m cell inside the module, per OSM usage policy.
    if (movedPastLastGeocode(latitude, lng, lastGeocodeRef.current)) {
      lastGeocodeRef.current = { lat: latitude, lng };
      const seq = ++geocodeSeqRef.current;
      void reverseGeocode(latitude, lng).then((address) => {
        if (!address || seq !== geocodeSeqRef.current) return;
        gpsAddressRef.current = address;
        setGpsAddress(address);
        const name = shortLocalityLabel(address);
        if (name && locationModeRef.current === 'my_location' &&
            (originSearchQueryRef.current.trim() === '' ||
             originSearchQueryRef.current === previousGpsNameRef.current)) {
          setOriginSearchQuery(name);
          previousGpsNameRef.current = name;
        }
      });
    }
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
            // Voice-search destination with no origin yet → fly the map to it,
            // matching the typed-search behaviour.
            if (!originId) {
              onViewOnMap?.({
                lat: matched.lat,
                lng: matched.lng,
                title: matched.name,
                zoom: 11,
              });
            }
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
    setAiParseMessage('Planning your route…');

    try {
      const data = await fetchJson<Record<string, any>>('/api/ai-smart-route-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToParse, userEmotion }),
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
      setAiParseMessage('Could not read that prompt — please choose the place from the list.');
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
          userEmotion,
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
      setRoutePlan(null);
      setOpenSections({});
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
    setRoutePlan(null);
    setHasCalculated(false);
    setLocationMode('custom_from_to');
    setOriginId('');
    setOriginSearchQuery('');
    setDestId('');
    setDestSearchQuery('');
    setSingleSearchQuery('');
    setRoutePlannerStep('origin');
    setOpenSections({});
    setTripStarted(false);
    onRouteClear?.();
    setTimeout(() => {
      destInputRef.current?.focus();
    }, 150);
  };

  const handleNewRoute = () => {
    setRoutePlannerStep('origin');
    setHasCalculated(false);
    setRoutePlan(null);
    setLocationMode('custom_from_to');
    setOriginId('');
    setOriginSearchQuery('');
    setDestId('');
    setDestSearchQuery('');
    setSingleSearchQuery('');
    setOpenSections({});
    onRouteClear?.();
    setTimeout(() => {
      originInputRef.current?.focus();
      setIsOriginDropdownOpen(true);
    }, 150);
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

  const handleRefreshFuelPrices = async () => {
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
  };

  // Short, one-line summaries for the detail section headers. These are what
  // the user reads with every section still collapsed — the "short info" layer
  // of the redesign, derived from the same plan the verdict uses.
  const routeSegmentIssues = useMemo(
    () => (routePlan ? (routePlan.steps ?? []).filter((s) => s.roadStatus && s.roadStatus !== 'clear').length : 0),
    [routePlan],
  );
  const routeIncidentCount = routePlan?.incidentsOnRoute?.length ?? 0;
  const routeHasIssues = routePlan
    ? (routePlan.statusSummary?.obstructedKm ?? 0) > 0 ||
      (routePlan.statusSummary?.cautionKm ?? 0) > 0 ||
      routeSegmentIssues > 0 ||
      routeIncidentCount > 0
    : false;
  const routeBlockHint = !routePlan
    ? undefined
    : routeHasIssues
      ? [
          routeSegmentIssues > 0 ? `${routeSegmentIssues} segment${routeSegmentIssues === 1 ? '' : 's'} not clear` : null,
          routeIncidentCount > 0 ? `${routeIncidentCount} live report${routeIncidentCount === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')
      : 'All segments open · no live reports';
  const viaLabel = useMemo(() => {
    if (!routePlan) return '';
    return (
      // Some stored highlights already read "via X" — strip the prefix so the
      // verdict card never prints "via via".
      routePlan.viaHighlights?.replace(/^via\s+/i, '') ||
      (routeHighwayCodes.length > 0 ? routeHighwayCodes.join(' · ') : '') ||
      routePlan.routeBadge ||
      routePlan.routeName ||
      ''
    );
  }, [routePlan, routeHighwayCodes]);

  // "Start trip" from the verdict: opens the live journey section and the map.
  const handleStartTrip = () => {
    setTripStarted(true);
    openSection('journey');
    onViewOnMap?.();
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
      <div className="space-y-3">
      {/* 1. MY LOCATION CARD - hidden once a route is calculated */}
      {!hasCalculated && (
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
                        ? 'My Location'
                        : 'My Location (GPS)')
                    : (originCity ? originCity.name : 'My Location')}
                </span>
              </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {locationMode === 'my_location'
                    ? (detectedLocation
                        ? (gpsAddressLabel
                            ? gpsAddressLabel
                            : gpsOriginCity
                              ? `${gpsOriginCity.name} · ${gpsOriginCity.district || gpsOriginCity.province || ''}`
                              : `${detectedLocation.lat.toFixed(4)}, ${detectedLocation.lng.toFixed(4)}`)
                        : (liveLocationError ? 'GPS unavailable' : 'Waiting for a GPS fix — your origin updates automatically'))
                    : 'Back to the current location'}
                </div>
              {detectedLocation && locationMode === 'my_location' && (
                <div className="text-[10px] text-emerald-400/80 font-mono truncate mt-0.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${
                    liveTracking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`} />
                  {liveTracking ? 'LIVE GPS' : 'GPS FIX'}{' '}
                  {detectedLocation.lat.toFixed(5)}, {detectedLocation.lng.toFixed(5)}
                  {liveAccuracy && (
                    <span className="text-slate-500"> · {liveAccuracy}</span>
                  )}
                  {gpsNearestJunction?.name && (
                    <span className="text-slate-500"> · {gpsNearestJunction.distanceKm?.toFixed(1)} km to {gpsNearestJunction.name}</span>
                  )}
                </div>
              )}
              {locationMode === 'my_location' && !detectedLocation && liveLocationError && (
                <div className="text-[10px] font-medium truncate mt-0.5 text-rose-400">
                  Location blocked — allow GPS access, or pick an origin below
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
                <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
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
      )}

      {speechTranscriptNotice && (
        <div className="flex items-center space-x-1.5 text-xs text-emerald-300 animate-fadeIn bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2">
          <Mic className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium truncate">{speechTranscriptNotice}</span>
        </div>
      )}

        {!hasCalculated &&
          (locationMode === 'my_location' ? (
            <PlaceField
              id="single-dest"
              containerRef={singleSearchRef}
              inputRef={singleSearchInputRef}
              placeholder="Where to?"
              value={singleSearchQuery}
              resolved={!!destId}
              accent="emerald"
              listening={listeningTarget === 'single'}
              onChange={(v) => {
                setSingleSearchQuery(v);
                closeAllMenus('single');
                setIsSingleDropdownOpen(true);
              }}
              onFocus={() => {
                closeAllMenus('single');
                setIsSingleDropdownOpen(true);
              }}
              onVoice={() => startVoiceRecognition('single')}
              onClear={() => setSingleSearchQuery('')}
              actions={
                <>
                  <FieldIconButton
                    label="AI route planner"
                    active={isAiPromptOpen}
                    onClick={() => {
                      closeAllMenus('ai');
                      // The sparkle now opens the full conversational AI panel;
                      // fall back to the inline prompt only when the parent
                      // has not wired the panel (standalone planner usage).
                      if (onOpenAiAssistant) {
                        onOpenAiAssistant();
                      } else {
                        setIsAiPromptOpen(!isAiPromptOpen);
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                  </FieldIconButton>
                  {highwayCount > 0 && (
                    <FieldIconButton label="Browse by highway" onClick={() => setIsBrowserOpen(true)}>
                      <MapPin className="h-4 w-4 text-amber-400" />
                    </FieldIconButton>
                  )}
                </>
              }
            >
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
                    // Single-field destination pick (no origin yet) → fly the
                    // map to the chosen place so the user sees its area
                    // instead of a static whole-Nepal overview.
                    if (!originId) {
                      onViewOnMap?.({
                        lat: city.lat,
                        lng: city.lng,
                        title: city.name,
                        zoom: 11,
                      });
                    }
                    if (hasCalculated) setNeedsRecalculation(true);
                  }}
                  totalMatches={singleMatchCount}
                />
              )}
            </PlaceField>
          ) : (
            <div className="grid items-start gap-2 md:grid-cols-[1fr_auto_1fr]">
              <PlaceField
                id="from-origin"
                containerRef={originSearchRef}
                inputRef={originInputRef}
                placeholder="From where?"
                value={originSearchQuery}
                resolved={!!originId}
                accent="emerald"
                listening={listeningTarget === 'origin'}
                onChange={(v) => {
                  setOriginSearchQuery(v);
                  closeAllMenus('origin');
                  setIsOriginDropdownOpen(true);
                }}
                onFocus={() => {
                  setOriginSearchQuery('');
                  closeAllMenus('origin');
                  setIsOriginDropdownOpen(true);
                }}
                onVoice={() => startVoiceRecognition('origin')}
                onClear={handleClearOrigin}
              >
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
              </PlaceField>
              <button
                type="button"
                onClick={handleSwapLocations}
                aria-label="Swap origin and destination"
                title="Swap origin and destination"
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                <ArrowUpDown className="h-5 w-5" />
              </button>
              <PlaceField
                id="to-dest"
                containerRef={destSearchRef}
                inputRef={destInputRef}
                placeholder="Where to?"
                value={destSearchQuery}
                resolved={!!destId}
                accent="cyan"
                listening={listeningTarget === 'dest'}
                onChange={(v) => {
                  setDestSearchQuery(v);
                  closeAllMenus('dest');
                  setIsDestDropdownOpen(true);
                }}
                onFocus={() => {
                  setDestSearchQuery('');
                  closeAllMenus('dest');
                  setIsDestDropdownOpen(true);
                }}
                onVoice={() => startVoiceRecognition('dest')}
                onClear={handleClearDestination}
              >
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
              </PlaceField>
            </div>
          ))}

      {/* Search coverage banner — continuous full-width marquee, one line at a time,
          shared by every dropdown so the count is seen once and never repeated. */}
      {!hasCalculated && (
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
            <span>Calculating the route…</span>
          </div>
        )}

        {hasCalculated && routePlan && (
          <div
            key={`trip-${calcKey}-${routePlan.id}`}
            id="route-verdict"
            className="animate-fade-in-smooth space-y-3 p-3 sm:p-4"
          >
            {/* 1. THE VERDICT — can I depart, is the road open? Short by design. */}
            <RouteVerdict
              plan={routePlan}
              totalCostNpr={estimatedTripCostNpr}
              viaLabel={viaLabel}
              tripStarted={tripStarted}
              onStartTrip={handleStartTrip}
              onEdit={handleEditLocations}
            />

            <TripOptions
              vehicle={vehicle}
              preference={preference}
              onVehicleChange={handleQuickVehicleSwitch}
              onPreferenceChange={handleQuickPrefSwitch}
              onShare={onShareTrip}
              onOpenSos={onOpenSos}
            />

            {/* 3. DETAILS ON DEMAND — every section starts collapsed and shows a
               one-line hint; only the blocks section opens itself, and only
               when the route actually has something to warn about. */}
            <div className="space-y-2.5">
              <DetailSection
                id="blocks"
                title="Blocks & alerts on route"
                Icon={AlertTriangle}
                tone="alert"
                badge={routeSegmentIssues + routeIncidentCount}
                hint={routeBlockHint}
                open={isOpen('blocks', routeHasIssues)}
                onToggle={() => toggleSection('blocks')}
              >
                <RouteBlocksPanel plan={routePlan} extraIncidents={liveIncidents} />
              </DetailSection>

              <DetailSection
                id="journey"
                title="Journey"
                Icon={Route}
                hint="Turn-by-turn, live road feed and elevation"
                open={isOpen('journey', false)}
                onToggle={() => toggleSection('journey')}
              >
                <ErrorBoundary
                  fallback={<div className="px-1 text-xs text-slate-500">Route information is temporarily unavailable.</div>}
                >
                  <JourneyPanel
                    route={routePlan}
                    vehicle={vehicle}
                    mode="driver"
                    extraIncidents={liveIncidents}
                    onViewOnMap={onViewOnMap}
                    hideStatusSummary
                  />
                </ErrorBoundary>
              </DetailSection>

              <DetailSection
                id="insights"
                title="Insights"
                Icon={Sparkles}
                hint={`Road score ${routePlan.roadConditionScore} · high point ${routePlan.maxElevationM.toLocaleString()} m`}
                open={isOpen('insights', false)}
                onToggle={() => toggleSection('insights')}
              >
                <InsightsPanel
                  route={routePlan}
                  vehicle={vehicle}
                  preference={preference}
                  aiAdvisory={aiCustomAdvisory}
                  loadingAdvisory={loadingAiAdvisory}
                  onGenerateAdvisory={handleFetchAiAdvisory}
                  onViewHighwayOnMap={onViewHighwayOnMap}
                  onOpenHighwayDirectory={onOpenHighwayDirectory}
                />
              </DetailSection>

              <DetailSection
                id="costs"
                title="Costs"
                Icon={Flame}
                hint={`Fuel Rs ${Math.max(estimatedTripCostNpr - (routePlan.totalTollCostNpr || 0), 0).toLocaleString()} · tolls Rs ${(routePlan.totalTollCostNpr || 0).toLocaleString()}`}
                open={isOpen('costs', false)}
                onToggle={() => toggleSection('costs')}
              >
                <CostsPanel
                  route={routePlan}
                  vehicle={vehicle}
                  highwayCodes={routeHighwayCodes}
                  fuelPrices={fuelPrices}
                  fuelPriceMetadata={fuelPriceMetadata}
                  isLoadingPrices={isLoadingPrices}
                  minutesSinceLastCheck={getMinutesSinceLastCheck()}
                  isPriceStale={isPriceStale()}
                  onRefreshPrices={handleRefreshFuelPrices}
                  onVehicleChange={setVehicle}
                  onOpenPreTrip={onOpenPreTrip}
                />
              </DetailSection>

              {routePlan.allRouteOptions && routePlan.allRouteOptions.length > 1 && (
                <DetailSection
                  id="routes"
                  title="Alternative routes"
                  Icon={Layers}
                  badge={routePlan.allRouteOptions.length}
                  hint="Compare distance, time and road score"
                  open={isOpen('routes', false)}
                  onToggle={() => toggleSection('routes')}
                >
                  <RouteComparisonView
                    activePlan={routePlan}
                    allOptions={routePlan.allRouteOptions}
                    selectedRouteId={routePlan.id}
                    vehicle={vehicle}
                    onSelectRoute={(opt) => {
                      setRoutePlan(opt);
                      setPreference(opt.preference);
                      onRouteCalculated(opt);
                      setOpenSections({});
                    }}
                    onViewOnMap={onViewOnMap}
                  />
                </DetailSection>
              )}

              <DetailSection
                id="report"
                title="Trip report"
                Icon={FileText}
                hint="Printable and shareable summary"
                open={isOpen('report', false)}
                onToggle={() => toggleSection('report')}
              >
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
              </DetailSection>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
