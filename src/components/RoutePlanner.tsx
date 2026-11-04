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
import { findOptimizedRoute, pickVerifiedRoute, pickRouteByCertification, ensureRealRoadGeometry } from '../utils/routeOptimizer';
import { RouteComparisonView } from './RouteComparisonView';
import { ErrorBoundary } from './ErrorBoundary';
import { PlaceField, FieldIconButton } from './planner/PlaceField';
import { TripOptions } from './planner/TripOptions';
import { RouteVerdict } from './planner/RouteVerdict';
import { DetailSection } from './planner/DetailSection';
import { ReelCard } from './planner/ReelCard';
import { PlannerDeck, DeckItem } from './PlannerDeck';
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
  Car,
  Navigation,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
  ShieldCheck,
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
  PREFERENCE_CONFIGS,
  FuelRateConfig,
} from '../utils/vehicleConfigs';
import { fetchJson } from '../utils/apiConfig';
import { NOC_FUEL_RATES_AS_OF } from '../utils/vehicleConfigs';
import type { ReportFuelBasis } from './UnifiedRouteReport';
import { fetchFuelPrices, getFuelPriceMetadata, getMinutesSinceLastCheck, formatLastChecked, isPriceStale, getEffectiveFuelRate } from '../utils/fuelPriceService';
import { filterCities, countCityMatches, citySuggestionLimit } from '../utils/citySearch';
import { CitySuggestionDropdown } from './CityResultRow';
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
  // On/off toggle for the detailed My-Location info on the location card.
  // Default OFF so the first load is clean: the card shows only the title and
  // the toggle button. Tapping "My Location" (the toggle) reveals the GPS
  // coordinates, nearest junction/highway, address label, etc. at the same
  // place where they currently live — inside the location card.
  const [showMyLocationDetails, setShowMyLocationDetails] = useState<boolean>(false);
  const [originSelected, setOriginSelected] = useState<boolean>(false);
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number } | null>(null);
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

  // NOTE: "Where to" is no longer auto-focused after the origin is picked.
  // On mobile, auto-focusing an input pops the on-screen keyboard without the
  // user tapping the field — disturbing. The user taps the input when they
  // want to type; the keyboard appears only then.

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

  // PlannerDeck active card id. The deck shows one card at a time; the user
  // swipes left/right to move between single-info cards. When the planner
  // flips between pre-calc and post-calc, the deck item set changes, so we
  // reset the active id to the first card of the new set (destination pre-calc,
  // verdict post-calc).
  const [plannerDeckActiveId, setPlannerDeckActiveId] = useState<string>('destination');
  const plannerDeckItems: DeckItem[] = useMemo(() => {
    if (!hasCalculated) {
      // Pre-calc: a single card. The "Where to?" search bar is the default
      // visible surface, with a My Location button on its right that reveals
      // the location info card on demand (no permanent expanded panel).
      return [
        { id: 'destination', label: 'Where to?', hint: 'Destination' },
      ];
    }
    const items: DeckItem[] = [
      { id: 'verdict', label: 'Trip summary', hint: 'Distance · time · status' },
      { id: 'actions', label: 'Trip actions', hint: 'Share · emergency help' },
      { id: 'blocks', label: 'Road alerts', hint: 'Only important issues' },
      { id: 'journey', label: 'Journey', hint: 'Key road sections' },
      { id: 'options', label: 'Trip options', hint: 'Vehicle · route type' },
      { id: 'costs', label: 'Trip cost', hint: 'Fuel · tolls' },
      { id: 'insights', label: 'Road insights', hint: 'Score · AI advice' },
    ];
    if (routePlan?.allRouteOptions && routePlan.allRouteOptions.length > 1) {
      items.push({ id: 'routes', label: 'Route choices', hint: 'Compare alternatives' });
    }
    return items;
  }, [hasCalculated, routePlan]);
  // Safety net: if the active id is no longer in the deck (e.g. the deck flipped
  // from post-calc to pre-calc and the old 'verdict' id is gone, or the
  // alternative-routes card disappeared after a recalculation), snap back to
  // the first card. Explicit setPlannerDeckActiveId calls in the transition
  // handlers below pick the right card for each transition; this only fires
  // when no explicit choice was made.
  useEffect(() => {
    if (plannerDeckItems.length === 0) return;
    if (!plannerDeckItems.some((it) => it.id === plannerDeckActiveId)) {
      setPlannerDeckActiveId(plannerDeckItems[0].id);
    }
  }, [plannerDeckItems, plannerDeckActiveId]);
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

  // NOTE: inputs are no longer auto-focused based on the planner step. On
  // mobile, programmatic focus pops the on-screen keyboard without the user
  // tapping the field. The user taps an input when they want to type.

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

  const handleSelectOrigin = (city: CityNode) => {
    setOriginId(city.id);
    setOriginSearchQuery(city.name);
    setOriginSelected(false);
    setIsOriginDropdownOpen(false);
    if (hasCalculated) setNeedsRecalculation(true);
    // NOTE: destination input is no longer auto-focused after picking the
    // origin. On mobile, popping the keyboard without a tap is disturbing.
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
    setTimeout(async () => {
      // Real DoR highway geometry loads asynchronously. Awaiting it here means
      // the drawn route follows the actual surveyed highway alignment instead
      // of the hand-estimated 3-point edge lines (the "route floats off the
      // highway" bug).
      await ensureRealRoadGeometry();
      const plan = findOptimizedRoute(fromId, toId, pref, veh, terrainFilters, originCity || undefined, destCity || undefined, liveIncidents);
      // Prefer a verified road route. If no connected road path exists,
      // retain the explicitly labelled aerial estimate instead of snapping
      // the user to an unrelated junction or silently showing no result.
      const resolved = plan
        ? (pickVerifiedRoute(plan) || pickRouteByCertification(plan))
        : null;
      if (resolved && fuelPrices && !resolved.__aerialWarning) {
        const updatedPlan = applyLiveFuelPrices(resolved, veh, fuelPrices);
        setRoutePlan(updatedPlan);
        onRouteCalculated(updatedPlan);
      } else if (resolved) {
        setRoutePlan(resolved);
        onRouteCalculated(resolved);
      }
      setHasCalculated(true);
      setTripStarted(false);
      // Route just calculated → jump the deck to the verdict card so the
      // user sees the result immediately, not the location/destination card.
      setPlannerDeckActiveId('verdict');

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

  // NOTE: handleShowLocationOnMap was removed — the "Show on Map" button it
  // backed is now an on/off "My Location" toggle. The map-centering
  // behaviour it provided is dropped per the user's request to replace that
  // button with the toggle.

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
    setPlannerDeckActiveId('destination');
    // Keep the map/search compact; details appear only when the user taps
    // the My Location control beside the destination search bar.
    setShowMyLocationDetails(false);
    // Open the destination dropdown so suggestions are ready, but do NOT
    // focus the input — on mobile that pops the keyboard without a tap.
    setTimeout(() => setIsSingleDropdownOpen(true), 150);
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
    // Switching to custom_from_to → jump the deck to the destination card,
    // which is where the from/to PlaceFields live in this mode.
    setPlannerDeckActiveId('destination');
    // Open the origin dropdown so suggestions are ready, but do NOT focus
    // the input — on mobile that pops the keyboard without a tap.
    setTimeout(() => setIsOriginDropdownOpen(true), 150);
  };

  const handleReturnToDefault = () => {
    setLocationMode('my_location');
    setIsLocationMenuOpen(false);
    if (hasCalculated) {
      setHasCalculated(false);
      setRoutePlan(null);
      onRouteClear?.();
    }
    setRoutePlannerStep('destination');
    handleDetectDeviceLocation(false);
    setPlannerDeckActiveId('destination');
    // Do not force-open a location panel when returning to GPS mode.
    setShowMyLocationDetails(false);
    // Open the destination dropdown, but do NOT focus the input.
    setTimeout(() => setIsSingleDropdownOpen(true), 150);
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
    setTripStarted(false);
    // Editing locations → jump the deck to the destination card and reveal
    // the location info card so the from/to fields (custom_from_to mode) are
    // visible. The hasCalculated flip below will reset the deck to its first
    // pre-calc card (which is now 'destination' itself); this confirms it.
    setPlannerDeckActiveId('destination');
    setShowMyLocationDetails(false);
    onRouteClear?.();
    // Do NOT auto-focus the destination input — on mobile that pops the
    // keyboard without the user tapping the field.
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
    setPlannerDeckActiveId('destination');
    setShowMyLocationDetails(true);
    onRouteClear?.();
    // Open the origin dropdown, but do NOT focus the input.
    setTimeout(() => setIsOriginDropdownOpen(true), 150);
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

  // "Start trip" from the verdict: opens the live journey card and the map.
  // The deck now shows one card at a time, so "open journey" means navigate
  // the deck to the Journey card (the old expand-collapse is gone).
  const handleStartTrip = () => {
    setTripStarted(true);
    setPlannerDeckActiveId('journey');
    onViewOnMap?.();
  };

  return (
    <div className="space-y-3">
      {/* Floating speech-transcript chip — kept outside the deck so it
          doesn't move when the user swipes between planner cards. */}
      {speechTranscriptNotice && (
        <div className="flex items-center space-x-1.5 text-xs text-emerald-300 animate-fadeIn bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2">
          <Mic className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium truncate">{speechTranscriptNotice}</span>
        </div>
      )}

      {/* Calculating spinner — kept outside the deck so it shows over the
          location/destination card while the route is being computed. */}
      {userPickedDestination && isCalculating && !hasCalculated && (
        <div className="pt-2 flex items-center justify-center space-x-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Calculating the route…</span>
        </div>
      )}

      {/* Reels-style 3D deck — one card at a time, swipe ⇆ to navigate.
          Each card carries a single piece of information; no multi-tab
          expand-collapse. The plain-face variant lets each section's own
          card styling show through while the slot still applies the 3D
          rotateY / parallax depth. */}
      <PlannerDeck
        items={plannerDeckItems}
        activeId={plannerDeckActiveId}
        onChange={setPlannerDeckActiveId}
        variant="plain"
      >
        {(activeId) => (
          <>
            {/* ===== PRE-CALCULATION CARDS ===== */}

            {!hasCalculated && activeId === 'destination' && (
              <ReelCard
                id="destination"
                title="Destination search"
                Icon={Navigation}
                hideTitle
                headerActions={
                  <button
                    type="button"
                    onClick={() => setShowMyLocationDetails((prev) => !prev)}
                    aria-label="My Location"
                    aria-expanded={showMyLocationDetails}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      showMyLocationDetails
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-emerald-500/40 hover:bg-slate-800'
                    }`}
                  >
                    <Crosshair className="h-4 w-4" />
                    <span>My Location</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMyLocationDetails ? 'rotate-180' : ''}`} />
                  </button>
                }
              >
                <div className="space-y-3">
                  {locationMode === 'my_location' ? (
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
                            <FieldIconButton label="Browse by highway" onClick={() => onOpenHighwayDirectory?.()}>
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
                  )}

                  {/* Collapsible My Location info card — revealed only when the
                      user taps the My Location button on the right side of the
                      search bar. Default OFF (no permanent panel). The card
                      holds the GPS status (icon, title, address / coordinates,
                      LIVE GPS line, nearest highway) and the location options
                      menu (Use Device GPS / Change Origin City). Tapping the
                      My Location button again hides this whole block. */}
                  {showMyLocationDetails && !hasCalculated && (
                    <div ref={locationMenuRef} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-3 animate-fadeIn">
                      {/* GPS status row */}
                      <div
                        onClick={() => {
                          if (locationMode === 'custom_from_to') {
                            handleReturnToDefault();
                          } else {
                            setIsLocationMenuOpen((prev) => !prev);
                          }
                        }}
                        id="btn-my-location-toggle"
                        className="flex items-center space-x-3 group select-none rounded-2xl px-3 py-2.5 border transition cursor-pointer bg-slate-950/60 hover:bg-slate-950 border-slate-800 hover:border-emerald-500/50 shadow-inner"
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

                      {/* Location Dropdown Options Menu — only shown in my_location mode. */}
                      {locationMode === 'my_location' && isLocationMenuOpen && (
                        <div className="pt-1 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
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

                  {/* Search coverage banner */}
                  <div className="w-full bg-slate-900/40 border-b border-slate-800 py-1.5 overflow-hidden">
                    <div className="flex items-center justify-center gap-8 px-4 animate-marquee">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        Search {searchablePlaceCount.toLocaleString('en-US')} places — cities and palikas. Just one letter is enough to start.
                      </span>
                    </div>
                  </div>

                  {/* AI Prompt Input Bar (If user clicks AI icon) */}
                  {isAiPromptOpen && (
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
                </div>
              </ReelCard>
            )}

            {/* ===== POST-CALCULATION CARDS ===== */}
            {hasCalculated && routePlan && activeId === 'verdict' && (
              <div
                key={`trip-${calcKey}-${routePlan.id}`}
                id="route-verdict"
                className="animate-fade-in-smooth"
              >
                <RouteVerdict
                  plan={routePlan}
                  totalCostNpr={estimatedTripCostNpr}
                  viaLabel={viaLabel}
                  tripStarted={tripStarted}
                  onStartTrip={handleStartTrip}
                  onEdit={handleEditLocations}
                />
              </div>
            )}

            {hasCalculated && activeId === 'options' && (
              <ReelCard id="options" title="Trip options" Icon={SlidersHorizontal} hint="Change vehicle or route preference">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vehicle</div>
                    <div className="grid grid-cols-5 gap-1">
                      {VEHICLE_CONFIGS.map(({ type, shortName, icon: Icon, desc }) => (
                        <button
                          key={type}
                          type="button"
                          title={`${shortName} - ${desc}`}
                          aria-pressed={vehicle === type}
                          onClick={() => handleQuickVehicleSwitch(type)}
                          className={`flex flex-col items-center gap-0.5 rounded-xl border px-0.5 py-2 text-center transition ${
                            vehicle === type
                              ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[9px] font-semibold leading-tight">{shortName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Route preference</div>
                    <div className="flex flex-wrap gap-1.5">
                      {PREFERENCE_CONFIGS.map(({ pref, icon, label, desc }) => (
                        <button
                          key={pref}
                          type="button"
                          title={desc}
                          aria-pressed={preference === pref}
                          onClick={() => handleQuickPrefSwitch(pref)}
                          className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            preference === pref
                              ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-300'
                              : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <span>{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ReelCard>
            )}

            {hasCalculated && routePlan && activeId === 'blocks' && (
              <ReelCard
                id="blocks"
                title="Blocks & alerts on route"
                Icon={AlertTriangle}
                tone="alert"
                badge={routeSegmentIssues + routeIncidentCount}
                hint={routeBlockHint}
              >
                <RouteBlocksPanel plan={routePlan} extraIncidents={liveIncidents} />
              </ReelCard>
            )}

            {hasCalculated && routePlan && activeId === 'journey' && (
              <ReelCard id="journey" title="Journey" Icon={Route} hint="Key road sections · no extra tabs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <span className="truncate text-xs font-semibold text-slate-200">{routePlan.origin.name} <ArrowRight className="inline h-3 w-3 text-emerald-400" /> {routePlan.destination.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-cyan-300">{routePlan.steps.length} sections</span>
                  </div>
                  {routePlan.steps.slice(0, 3).map((step, index) => (
                    <div key={`${step.highwayCode || 'road'}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-black text-slate-300">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-slate-200">{step.instruction || step.highwayName || 'Road section'}</p>
                        <p className="truncate text-[10px] text-slate-500">{step.highwayCode || 'Local road'}{step.roadStatus && step.roadStatus !== 'clear' ? ` · ${step.roadStatus}` : ''}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-slate-400">{Number(step.distanceKm || 0).toFixed(1)} km</span>
                    </div>
                  ))}
                  {routePlan.steps.length > 3 && (
                    <p className="px-1 text-[10px] text-slate-500">+ {routePlan.steps.length - 3} more sections · use the map for the full route</p>
                  )}
                  {routePlan.steps.length === 0 && <p className="text-xs text-slate-400">Detailed road sections are not available for this route.</p>}
                </div>
              </ReelCard>
            )}

            {hasCalculated && routePlan && activeId === 'insights' && (
              <ReelCard id="insights" title="Road insights" Icon={Sparkles} hint="A few useful facts and optional AI advice">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Road score</p>
                    <p className="mt-1 text-xl font-black text-emerald-300">{routePlan.roadConditionScore}<span className="text-xs text-slate-500">/100</span></p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Highest point</p>
                    <p className="mt-1 text-xl font-black text-cyan-300">{routePlan.maxElevationM.toLocaleString()}<span className="text-xs text-slate-500"> m</span></p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-300">AI travel advice</span>
                  <button type="button" onClick={handleFetchAiAdvisory} disabled={loadingAiAdvisory} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
                    {loadingAiAdvisory ? 'Analysing…' : aiCustomAdvisory ? 'Refresh' : 'Generate'}
                  </button>
                </div>
                {aiCustomAdvisory ? (
                  <div className="mt-2 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-300">
                    <p>{aiCustomAdvisory.summary}</p>
                    {aiCustomAdvisory.bestDepartureWindow && <p className="text-cyan-300">Best departure: {aiCustomAdvisory.bestDepartureWindow}</p>}
                    {aiCustomAdvisory.monsoonOrWeatherWarning && <p className="text-amber-300">⚠ {aiCustomAdvisory.monsoonOrWeatherWarning}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-500">AI advice is optional. Generate it when you need a route-specific travel summary.</p>
                )}
              </ReelCard>
            )}

            {hasCalculated && routePlan && activeId === 'costs' && (
              <ReelCard id="costs" title="Trip cost" Icon={Flame} hint="Estimated fuel and tolls for this vehicle">
                {routePlan.__aerialWarning ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] leading-relaxed text-amber-200">Cost estimates need a connected road route. This result is an aerial estimate only.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Fuel estimate</p>
                        <p className="mt-1 text-lg font-black text-amber-300">Rs {routePlan.fuelEstimate.costNpr.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">{Number(routePlan.fuelEstimate.liters || 0).toFixed(1)} L approx.</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tolls</p>
                        <p className="mt-1 text-lg font-black text-cyan-300">Rs {(routePlan.totalTollCostNpr || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">Along selected route</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated total</span>
                      <span className="text-base font-black text-emerald-300">Rs {estimatedTripCostNpr.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[9px] leading-relaxed text-slate-500">Planning estimate; actual cost varies with traffic and driving style.</p>
                      <button type="button" onClick={handleRefreshFuelPrices} disabled={isLoadingPrices} aria-label="Refresh fuel prices" className="shrink-0 rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-300 disabled:opacity-50">{isLoadingPrices ? 'Updating…' : 'Refresh rates'}</button>
                    </div>
                  </>
                )}
              </ReelCard>
            )}

            {hasCalculated && routePlan && routePlan.allRouteOptions && routePlan.allRouteOptions.length > 1 && activeId === 'routes' && (
              <ReelCard id="routes" title="Alternative routes" Icon={Layers} badge={routePlan.allRouteOptions.length} hint="Compare distance, time and road score">
                <RouteComparisonView
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
              </ReelCard>
            )}

          </>
        )}
      </PlannerDeck>

      {/* Keep a complete report in the print tree; on-screen navigation remains sector-by-sector. */}
      {hasCalculated && routePlan && (
        <div className="planner-print-report">
          <UnifiedRouteReport
            reportSection="all"
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
            userIdentity={{ name: user?.displayName || undefined, email: user?.email || undefined }}
            fuelBasis={buildFuelBasis()}
            embedded
            showElevationProfile
            simulationControls={simulationControls}
            onViewOnMap={onViewOnMap}
          />
        </div>
      )}
    </div>
  );
};
