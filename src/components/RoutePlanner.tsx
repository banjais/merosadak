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
import { ShareTripModal } from './ShareTripModal';
import { TripAssistantPanel } from './TripAssistantPanel';
import { RouteTerrainAndTrafficAnalysis } from './RouteTerrainAndTrafficAnalysis';
import { PreTripChecklist } from './PreTripChecklist';
import { RouteOptionsSelector } from './RouteOptionsSelector';
import { HighwaySafetyIndexCard } from './HighwaySafetyIndexCard';
import { RouteElevationProfileChart } from './RouteElevationProfileChart';
import { CarbonFootprintCard } from './CarbonFootprintCard';
import { WeatherPassesPanel } from './WeatherPassesPanel';
import { HighwayPOIsPanel } from './HighwayPOIsPanel';
import { TrafficCorridorPanel } from './TrafficCorridorPanel';
import { RouteComparisonView } from './RouteComparisonView';
import { RouteJunctionTimeline } from './RouteJunctionTimeline';
import { RouteHighwayInfoPanel } from './RouteHighwayInfoPanel';
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
import {
  VEHICLE_CONFIGS,
  NOC_FUEL_RATES,
  getNOCFuelRate,
  getFuelRateLabel,
  getFuelName,
  FUEL_RATE_LABELS,
  getVehicleUIConfig,
  formatPreference,
  PREFERENCE_CONFIGS,
} from '../utils/vehicleConfigs';
import { fetchJson } from '../utils/apiConfig';
import { filterCities } from '../utils/citySearch';

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
}

const METRO_CITY_NAME_FRAGMENTS = ['kathmandu', 'pokhara', 'bharatpur', 'biratnagar', 'birgunj', 'bhaktapur', 'lalitpur'];
const SUB_METRO_CITY_NAME_FRAGMENTS = ['hetauda', 'butwal', 'dhangadhi', 'nepalgunj', 'birendranagar', 'dharan', 'janakpur', 'gauraha', 'birgunj'];

const getCityType = (city: CityNode): string => {
  const lower = city.name.toLowerCase();
  if (METRO_CITY_NAME_FRAGMENTS.some((m) => lower.includes(m))) return 'Metropolitan City';
  if (SUB_METRO_CITY_NAME_FRAGMENTS.some((m) => lower.includes(m))) return 'Sub-metropolitan City';
  return city.isMajorHub ? 'Municipality' : 'Rural Municipality';
};

const findClosestCityFromCoords = (lat: number, lng: number, cities: CityNode[]): CityNode => {
  if (!cities || cities.length === 0) {
    return {
      id: '',
      name: 'Unknown',
      nepaliName: '',
      district: '',
      province: '',
      lat,
      lng,
      elevationM: 0,
      isMajorHub: false,
      connectedHighways: [],
    };
  }
  let closestCity = cities[0];
  let minDist = Infinity;
  cities.forEach((city) => {
    const d = Math.hypot(city.lat - lat, city.lng - lng);
    if (d < minDist) {
      minDist = d;
      closestCity = city;
    }
  });
  return closestCity;
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
  | 'highway_info';

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
  const [showElevationDetails, setShowElevationDetails] = useState<boolean>(false);
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

  useEffect(() => {
    loadExpandedCities().then(setAllCities);
  }, []);

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
        setOriginSearchQuery(originCity?.name ?? '');
      }
      if (destSearchRef.current && !destSearchRef.current.contains(e.target as Node)) {
        setIsDestDropdownOpen(false);
        setDestSearchQuery(destCity?.name ?? '');
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
      setRoutePlan(plan);
      setHasCalculated(true);
      setIsReportExpanded(true);
      setCalcKey((k) => k + 1);
      setAiCustomAdvisory(null);
      setIsCalculating(false);

      if (plan) {
        onRouteCalculated(plan);
      }

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
         const closestCity = findClosestCityFromCoords(latitude, longitude, allCitiesRef.current);
         setOriginId(closestCity.id);
         setGpsOriginCityId(closestCity.id);
         setOriginSelected(true);
         setIsLocationMenuOpen(false);
         setLocationPermissionDenied(false);
       },
       (err) => {
         setOriginSelected(false);
         setOriginId('');
         setGpsOriginCityId('');
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
       { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
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
          const closestCity = findClosestCityFromCoords(latitude, longitude, allCitiesRef.current);
          setOriginId(closestCity.id);
          setGpsOriginCityId(closestCity.id);
          setOriginSelected(true);
          setIsLocationMenuOpen(false);
        },
        () => {
          // Permission denied or error — user can still pick manually
        },
        { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
      );
    };

    // Check existing permission state before prompting
    if (typeof navigator.permissions !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            tryAutoDetect();
          } else if (permissionStatus.state === 'prompt') {
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

   // Toggle detail module tabs — click the active tab to close it, click a
   // different tab to switch straight to it.
  const handleToggleModuleTab = (tab: DetailModuleTab) => {
    setActiveModuleTab((prev) => (prev === tab ? 'none' : tab));
  };

  // Ordered list of module tabs, used so mobile swipe-left/right can move
  // between them in the same order they're laid out in the button grid.
  const MODULE_TAB_ORDER: DetailModuleTab[] = [
    'timeline', 'elevation', 'travel_plan', 'weather', 'pois',
    'traffic',      'safety', 'fuel_tolls', 'ai_advisory', 'sos', 'eco', 'checklist', 'highway_info',
  ];
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
    setActiveModuleTab((prev) => {
      const idx = MODULE_TAB_ORDER.indexOf(prev as DetailModuleTab);
      if (idx === -1) return prev;
      const nextIdx = deltaX < 0
        ? Math.min(idx + 1, MODULE_TAB_ORDER.length - 1) // swipe left -> next
        : Math.max(idx - 1, 0); // swipe right -> previous
      return MODULE_TAB_ORDER[nextIdx];
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

  return (
    <div className="space-y-4">
      {/* AI Parsing Message Banner */}
      {aiParseMessage && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-3 rounded-2xl flex items-center space-x-2 text-xs text-cyan-200 animate-fadeIn shadow-lg">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-medium">{aiParseMessage}</span>
        </div>
      )}

      {/* Main Clean Route Planner Box */}
      <div className="bg-slate-900/95 border border-slate-800 border-t-0 rounded-t-none sm:rounded-t-none p-4 sm:p-5 space-y-4">
{/* 1. MY LOCATION CARD / PICKER - Always visible */}
      <div className="relative" ref={locationMenuRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            {/* Clickable My Location Widget */}
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
              className={`flex items-center space-x-3 group select-none rounded-xl px-3.5 py-2 border transition ${
                isCustomLocationMode
                  ? 'cursor-pointer bg-slate-900/60 border-slate-800 opacity-40'
                  : 'cursor-pointer bg-slate-950/80 hover:bg-slate-950 border-slate-800 hover:border-emerald-500/50'
              }`}
              aria-disabled={isCustomLocationMode}
              title={isCustomLocationMode ? 'Click to return to My Location' : 'Click to view My Location or Change Origin'}
             >
               <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition ${
                 detectedLocation
                   ? 'bg-emerald-500/30 text-emerald-400 border-emerald-400/50'
                   : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
               }`}>
                 {detectedLocation ? <LocateFixed className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
               </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    <span>My Location</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isLocationMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="text-[10px] font-normal text-slate-400 truncate space-y-0.5">
                    {detectedLocation ? (
                      gpsOriginCity ? (
                        <>
                          <span className="block">{gpsOriginCity.name} / {getCityType(gpsOriginCity)}</span>
                          <span className="block text-[9px] text-slate-500">District: {gpsOriginCity.district}, Province: {gpsOriginCity.province}</span>
                          <span className="block">{detectedLocation.lat.toFixed(4)}° N, {detectedLocation.lng.toFixed(4)}° E</span>
                        </>
                      ) : (
                        <>
                          <span className="block">Detected Location</span>
                          <span className="block text-[9px] text-slate-500">Coordinates below</span>
                          <span className="block">{detectedLocation.lat.toFixed(4)}° N, {detectedLocation.lng.toFixed(4)}° E</span>
                        </>
                      )
                    ) : isCustomLocationMode ? (
                      <span className="text-slate-500">Custom origin mode</span>
                    ) : (
                      <span className="text-slate-500">Select a location</span>
                    )}
                  </div>
                </div>
            </div>
          </div>

          {/* Location Dropdown Options Menu (When user clicks My Location) */}
          {isLocationMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 space-y-1.5 animate-fadeIn">
              {!detectedLocation && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Choose Location Preference:
                </div>
              )}

               {/* Option 1: Current GPS / Device Location - only when not detected */}
               {!detectedLocation && (
                 <button
                   onClick={() => {
                     handleDetectDeviceLocation();
                     setLocationMode('my_location');
                     closeAllMenus(null);
                   }}
                   className={`w-full p-2.5 rounded-xl text-left bg-slate-900/90 hover:bg-slate-800 border transition flex items-start space-x-2.5 group ${
                     locationPermissionDenied
                       ? 'border-rose-500/50 hover:border-rose-500/60'
                       : 'border-slate-800 hover:border-emerald-500/50'
                   }`}
                 >
                   <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                     locationPermissionDenied
                       ? 'bg-rose-500/20 text-rose-400'
                       : 'bg-emerald-500/20 text-emerald-400'
                   }`}>
                     <LocateFixed className="w-4 h-4 group-hover:scale-110 transition" />
                   </div>
                   <div>
                     <div className={`text-xs font-bold group-hover:font-bold ${
                       locationPermissionDenied ? 'text-rose-200 group-hover:text-rose-300' : 'text-white group-hover:text-emerald-300'
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

                {/* Option 2: Change Location (Custom From / To) - keeps GPS-origin permanent */}
                 <button
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
                  className="w-full p-2.5 rounded-xl text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition flex items-start space-x-2.5 group"
               >
                 <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                   <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition" />
                 </div>
                 <div>
                   <div className="text-xs font-bold text-white group-hover:text-amber-300">
                     Change Origin
                   </div>
                   <div className="text-[11px] text-slate-400">
                     Specify origin &amp; destination
                   </div>
                 </div>
               </button>
            </div>
          )}
        </div>

        {/* Speech / Live Notice - simple text under the My Location box */}
        {speechTranscriptNotice && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-300 animate-fadeIn">
            <Mic className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
            <span className="font-medium">{speechTranscriptNotice}</span>
          </div>
        )}


        {/* 2. SEARCH INPUT BARS - Hidden after calculation */}
        {!hasCalculated && (
          <>
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {c.elevationM}m ASL
                    </span>
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
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                          {c.elevationM}m ASL
                        </span>
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
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                          {c.elevationM}m ASL
                        </span>
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
                <span>AI Smart Route Planner (Natural Language)</span>
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

        {hasCalculated && (
          <>
            {/* Vehicle Profile & Routing Priority */}
            <div className="pt-1 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => { closeAllMenus('vehicle'); setShowVehicleOptions(!showVehicleOptions); }}
            className="w-full py-2 px-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-between transition group shadow-sm"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-bold text-slate-200 truncate">Vehicle Profile &amp; Routing Priority</span>
              <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.shortName} • {preference.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-400 group-hover:text-white shrink-0 ml-2">
              <span className="text-[10px] font-medium">{showVehicleOptions ? 'Hide Options' : 'Customize Options'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showVehicleOptions ? 'rotate-180 text-emerald-400' : ''}`} />
            </div>
          </button>

          {showVehicleOptions && (
            <div className="mt-2.5 p-2.5 sm:p-3 bg-slate-950/90 border border-slate-800/90 rounded-xl space-y-2.5 animate-fadeIn">
              {/* Vehicle Profile grid with reduced box size and font sizes for mobile fit */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Vehicle Profile</span>
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

              {/* Routing Priority grid with reduced box size and font sizes */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Routing Priority</span>
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
          </>
          )}
        </div>

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
              <span>Start Trip</span>
            </button>

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
                <span>Riding along</span>
              </button>
            </div>
          </div>

            {/* ELEVATION PROFILE - Expandable (Hidden by default) */}
            <div
              id="route-elevation-profile-card"
              key={`route-elevation-profile-${calcKey}`}
              className="pt-1 animate-fade-in-smooth transition-all duration-500 ease-out"
            >
              <button
                type="button"
                onClick={() => setShowElevationDetails(!showElevationDetails)}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 transition text-left"
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" />
                  <span>⛰️ Route Elevation Profile &amp; Mountain Gradients</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  <span>+{routePlan.elevationGainM}m climb • Peak {routePlan.maxElevationM}m</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showElevationDetails ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showElevationDetails && (
                <div className="animate-fadeIn">
                  <RouteElevationProfileChart
                    activeRoute={routePlan}
                    routePlan={routePlan}
                    vehicle={vehicle}
                    simulationControls={simulationControls}
                    onViewOnMap={onViewOnMap}
                  />
                </div>
              )}
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
                    const price = getNOCFuelRate(vehicle);
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
              <div
                key={`route-summary-card-${calcKey}`}
                className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl animate-fade-in-smooth transition-all duration-500 ease-out"
              >
            {/* Header / Title Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                    <span>Trip Summary &amp; Vehicle Fuel Cost Breakdown</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {routePlan.origin.name} ➔ {routePlan.destination.name} • Calculated for{' '}
                    <span className="text-emerald-300 font-semibold">
                      {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label || 'Selected Vehicle'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 self-start sm:self-auto font-mono">
                <span>Source: DoR Nepal Highway GIS</span>
              </div>
            </div>

            {/* 3 Core Primary Metric Bento Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Total Trip Distance */}
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Trip Distance</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    {routePlan.roadConditionScore}/100 Safe
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-2xl sm:text-3xl font-black text-white font-display">
                    {routePlan.totalDistanceKm} <span className="text-sm font-normal text-slate-400">km</span>
                  </div>
                  {routePlan.aerialDistanceKm && (
                    <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <span>Air: <strong className="text-slate-200">{routePlan.aerialDistanceKm} km</strong></span>
                      <span>•</span>
                      <span className="text-amber-400 font-bold" title="Mountain terrain winding detour">
                        +{Math.round(((routePlan.totalDistanceKm - routePlan.aerialDistanceKm) / routePlan.aerialDistanceKm) * 100)}% detour
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-emerald-400 font-medium">✓ {routePlan.statusSummary.clearKm} km clear</span>
                  {routePlan.statusSummary.cautionKm > 0 && (
                    <span className="text-amber-400 font-medium">⚠ {routePlan.statusSummary.cautionKm} km caution</span>
                  )}
                </div>
              </div>

              {/* 2. Estimated Travel Time */}
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Estimated Travel Time</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                    {Math.round(routePlan.totalDistanceKm / (routePlan.estimatedTimeMinutes / 60))} km/h avg
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-display">
                    {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleToggleModuleTab('timeline')}
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 transition"
                    title="View vertical timeline breakdown by highway junctions with arrival times"
                  >
                    <Milestone className="w-3 h-3 text-cyan-400" />
                    <span>Junction ETAs ➔</span>
                  </button>
                  <span className="text-slate-300">+{routePlan.elevationGainM}m climb</span>
                </div>
              </div>

              {/* 3. Selected Vehicle Estimated Fuel/Energy Cost */}
              {(() => {
                const unitPrice = getNOCFuelRate(vehicle);
                const effKmL = Math.max(1.0, customMileageKmL);
                const unitsReq = Math.round((routePlan.totalDistanceKm / effKmL) * 10) / 10;
                const cost = Math.round(unitsReq * unitPrice);
                const costPerKm = (cost / Math.max(1, routePlan.totalDistanceKm)).toFixed(1);

                return (
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
                        {vehicle === 'electric_vehicle' ? (
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Fuel className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>{vehicle === 'electric_vehicle' ? 'EV Energy Cost' : 'Est. Fuel Cost'}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                        {vehicle === 'electric_vehicle' ? 'NEA Fast Charger' : 'Live Calculated'}
                      </span>
                    </div>
                    <div className="my-2">
                      <div className="text-2xl sm:text-3xl font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span>
                        {unitsReq} {vehicle === 'electric_vehicle' ? 'kWh req.' : 'Liters req.'}
                      </span>
                      <span className="text-slate-300 font-mono">
                        ~Rs {costPerKm}/km
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Road Network Classification & Certification Composition */}
            {routePlan.roadTierBreakdown && (
              <div className="bg-slate-900/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center space-x-1.5 font-bold">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Road Classification & Provenance</span>
                  </span>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    {routePlan.roadTierBreakdown.certifiedPercent}% DoR Federal Certified Highway
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${routePlan.roadTierBreakdown.certifiedPercent}%` }}
                    title={`DoR Certified: ${routePlan.roadTierBreakdown.highwayKm} km`}
                  />
                  {routePlan.roadTierBreakdown.certifiedPercent < 100 && (
                    <div
                      className="bg-cyan-500 h-full"
                      style={{ width: `${100 - routePlan.roadTierBreakdown.certifiedPercent}%` }}
                      title={`Provincial / Local Palika Links: ${routePlan.roadTierBreakdown.localKm + routePlan.roadTierBreakdown.provincialKm + routePlan.roadTierBreakdown.communityKm} km`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Federal Highway (NH01–NH80): <strong>{routePlan.roadTierBreakdown.highwayKm} km</strong></span>
                    </span>
                    {(routePlan.roadTierBreakdown.provincialKm > 0 || routePlan.roadTierBreakdown.localKm > 0) && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                        <span>Local Palika Links: <strong>{routePlan.roadTierBreakdown.provincialKm + routePlan.roadTierBreakdown.localKm} km</strong></span>
                      </span>
                    )}
                    {routePlan.roadTierBreakdown.communityKm > 0 && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Unpaved Track: <strong>{routePlan.roadTierBreakdown.communityKm} km</strong></span>
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">
                    Detour: {routePlan.circuityFactor || 1.0}×
                  </span>
                </div>
              </div>
            )}

            {/* Route Terrain & Surface Info */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-semibold">Route Terrain:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                Peak {routePlan.maxElevationM}m
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                +{routePlan.elevationGainM}m climb
              </span>
              {(() => {
                const surfaces = [...new Set(routePlan.steps.map((s) => s.surface))];
                const surfaceLabels = {
                  asphalt_excellent: 'Excellent Asphalt',
                  blacktopped_fair: 'Blacktopped',
                  gravel: 'Gravel',
                  under_construction: 'Under Construction',
                  offroad_mud: 'Off-road/Mud',
                } as const;
                return surfaces.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                    {surfaceLabels[s as keyof typeof surfaceLabels] || s}
                  </span>
                ));
              })()}
              {(routePlan.statusSummary.cautionKm > 0 || routePlan.statusSummary.obstructedKm > 0) && (
                <>
                  {routePlan.statusSummary.cautionKm > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {routePlan.statusSummary.cautionKm} km caution
                    </span>
                  )}
                  {routePlan.statusSummary.obstructedKm > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/30">
                      {routePlan.statusSummary.obstructedKm} km obstructed
                    </span>
                  )}
                </>
              )}
              {routePlan.incidentsOnRoute.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/30">
                  {routePlan.incidentsOnRoute.length} incident(s)
                </span>
              )}
            </div>

            {/* Official Data Provenance Footer */}
            <DataAttribution
              source="DoR Nepal Highway GIS (NH01–NH80)"
              updatedAt="2026-03"
              note="Official statutory road distances certified along surveyed national highway centerlines."
              href="https://dor.gov.np"
            compact
            />

              {/* Vehicle Performance Impact - Expandable (Hidden by default) */}
              <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowVehiclePerformance(!showVehiclePerformance)}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-xl text-left font-bold text-white uppercase text-xs tracking-wider hover:bg-slate-800/60 transition"
                >
                  <div className="flex items-center space-x-2">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Vehicle Performance Impact</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showVehiclePerformance ? 'rotate-180' : ''}`} />
                </button>
                {showVehiclePerformance && (
                  <div className="p-4 space-y-3 animate-fadeIn border-t border-slate-800">
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <span>Vehicle Performance</span>
                      <span className="text-emerald-400 text-[9px] font-mono">{VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Fuel / Tariff Rate</div>
                        <div className="text-xs font-bold text-white mt-0.5">{getFuelRateLabel(vehicle)}</div>
                        <div className="text-[9px] text-slate-400 truncate">{getFuelName(vehicle)}</div>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Efficiency</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">{customMileageKmL.toFixed(1)} km/L</div>
                        <div className="text-[9px] text-slate-400">{vehicle === 'electric_vehicle' ? '~160 Wh/km' : `${(customMileageKmL * 2.35215).toFixed(1)} MPG`}</div>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Required</div>
                        <div className="text-xs font-bold text-cyan-400 mt-0.5">{Math.round((routePlan.totalDistanceKm / Math.max(1.0, customMileageKmL)) * 10) / 10} L</div>
                        <div className="text-[9px] text-slate-400">For {routePlan.totalDistanceKm} km</div>
                      </div>
                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Cost / km</div>
                        <div className="text-xs font-bold text-amber-400 mt-0.5">Rs {(Math.round((routePlan.totalDistanceKm / Math.max(1.0, customMileageKmL)) * getNOCFuelRate(vehicle)) / Math.max(1, routePlan.totalDistanceKm)).toFixed(2)}</div>
                        <div className="text-[9px] text-slate-400">Direct expense</div>
                      </div>
                    </div>
                    <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800/80 text-xs space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-1 text-slate-300 pt-1.5 border-t border-slate-800">
                        <span className="font-bold flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                          <span>Elevation Impact:</span>
                        </span>
                        <span className="text-emerald-400 self-end sm:self-auto font-bold">+{routePlan.elevationGainM}m ascent</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-slate-300">
                        <span className="font-bold flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                          <span>Terrain Grade Factor:</span>
                        </span>
                        <span>Peak {routePlan.maxElevationM}m ASL</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>


          </div>

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

          {/* 6. OPTION BUTTONS (Travel Plan, Weather, POIs, SOS, Traffic, etc.)
              Split by who needs them: everyone gets trip info & safety; only
              "Driving" mode gets vehicle-operating tools (fuel/toll cost, eco
              footprint, pre-trip vehicle checklist). Don't show contents if
              user doesn't click them! */}
          <div className="pt-2 border-t border-slate-800 space-y-4">

            {/* ---- FOR YOUR TRIP: relevant whether you're driving or riding along ---- */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                For Your Trip (Click to view):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">

                {/* Option: Junction Timeline & ETAs */}
                <button
                  onClick={() => handleToggleModuleTab('timeline')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'timeline'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                  id="btn-junction-timeline-tab"
                >
                  <Milestone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Junction Timeline</span>
                </button>

                {/* Option: Travel Plan & Itinerary */}
                <button
                  onClick={() => handleToggleModuleTab('travel_plan')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'travel_plan'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Travel Plan</span>
                </button>

                {/* Option: Weather & Passes */}
                <button
                  onClick={() => handleToggleModuleTab('weather')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'weather'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-md shadow-sky-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <CloudSun className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">Weather &amp; Passes</span>
                </button>

                {/* Option: POIs (fuel/EV are labeled for drivers, but rest stops/food are for everyone) */}
                <button
                  onClick={() => handleToggleModuleTab('pois')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'pois'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <Fuel className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">Rest Stops &amp; POIs</span>
                </button>

                {/* Option: Traffic & Terrain */}
                <button
                  onClick={() => handleToggleModuleTab('traffic')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'traffic'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/60 shadow-md shadow-teal-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <Radio className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="truncate">Live Traffic</span>
                </button>

                {/* Option: Safety & Hazards */}
                <button
                  onClick={() => handleToggleModuleTab('safety')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'safety'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-md shadow-rose-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">Safety &amp; Hazards</span>
                </button>

                {/* Option: AI Advisory */}
                <button
                  onClick={() => handleToggleModuleTab('ai_advisory')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'ai_advisory'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">AI Advisory</span>
                </button>

                {/* Option: SOS Rescue */}
                <button
                  onClick={() => handleToggleModuleTab('sos')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                    activeModuleTab === 'sos'
                      ? 'bg-red-600/30 text-red-300 border-red-500 shadow-md shadow-red-600/20'
                      : 'bg-slate-950 hover:bg-slate-900 text-red-400 border-slate-800'
                  }`}
                >
                  <PhoneCall className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate font-black">SOS Rescue</span>
                </button>
              </div>
            </div>

            {/* ---- DRIVER TOOLS: only relevant to whoever is actually operating the vehicle ---- */}
            {travelerMode === 'driver' && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-500" />
                  <span>Driver Tools:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                  {/* Option: Fuel & Toll Calculator */}
                  <button
                    onClick={() => handleToggleModuleTab('fuel_tolls')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                      activeModuleTab === 'fuel_tolls'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">Fuel &amp; Tolls</span>
                  </button>

                  {/* Option: Eco Footprint */}
                  <button
                    onClick={() => handleToggleModuleTab('eco')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                      activeModuleTab === 'eco'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Eco Footprint</span>
                  </button>

                  {/* Option: Pre-Trip Checklist */}
                  <button
                    onClick={() => handleToggleModuleTab('checklist')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                      activeModuleTab === 'checklist'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/60'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Wrench className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate">Vehicle Checklist</span>
                  </button>

                  {/* Option: Highway Info */}
                  <button
                    onClick={() => handleToggleModuleTab('highway_info')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                      activeModuleTab === 'highway_info'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Highway Info</span>
                  </button>
                </div>
              </div>
            )}
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
                  {activeModuleTab === 'timeline' && <span>🕒 Highway Junction Timeline &amp; Arrival Times</span>}
                  {activeModuleTab === 'comparison' && <span>⚖️ Primary vs Alternative Route Comparison</span>}
                  {activeModuleTab === 'travel_plan' && <span>📋 Turn-by-Turn Travel Plan &amp; Itinerary</span>}
                  {activeModuleTab === 'elevation' && <span>⛰️ Route Elevation Profile &amp; Steep Gradients</span>}
                  {activeModuleTab === 'weather' && <span>🌤️ Live Mountain Passes &amp; Weather Conditions</span>}
                  {activeModuleTab === 'pois' && <span>⛽ Highway POIs, Fuel Pumps &amp; EV Charging</span>}
                  {activeModuleTab === 'traffic' && <span>🚦 Real-Time Traffic Speeds &amp; Terrain Analysis</span>}
                  {activeModuleTab === 'safety' && <span>🛡️ Highway Safety Score &amp; Incident Advisories</span>}
                  {activeModuleTab === 'fuel_tolls' && <span>💰 Fuel &amp; Nagdhunga Toll Calculator</span>}
                  {activeModuleTab === 'ai_advisory' && <span>🤖 Gemini AI Highway Safety &amp; Departure Advisory</span>}
                  {activeModuleTab === 'sos' && <span>🚨 Emergency Highway SOS Dispatch Hotline</span>}
                  {activeModuleTab === 'eco' && <span>🌱 Eco Rating &amp; Carbon Footprint Analysis</span>}
                  {activeModuleTab === 'checklist' && <span>🔧 Pre-Trip Highway Vehicle Checklist</span>}
                  {activeModuleTab === 'highway_info' && <span>🛣️ Active Route Highway Details & Alerts</span>}
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
                  <FuelCostEstimator
                    distanceKm={routePlan.totalDistanceKm}
                    vehicleType={vehicle}
                    elevationGainM={routePlan.elevationGainM}
                    origin={routePlan.origin}
                    destination={routePlan.destination}
                    defaultTollCost={routePlan.totalTollCostNpr}
                    onVehicleChange={(newV) => setVehicle(newV)}
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
              </div>
            )}
          </>
        )}
      </>
    )}
  </div>
)}

      {/* Share Trip Modal */}
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
  );
};
