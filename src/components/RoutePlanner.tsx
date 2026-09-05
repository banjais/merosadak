import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CityNode,
  RoutePlanResult,
  VehicleType,
  RoutePreference,
  TerrainFilterOptions,
  HighwayWeatherNode,
  HighwayPOI,
  TrafficCorridor,
} from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
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
import { TerrainFiltersPanel } from './TerrainFiltersPanel';
import { WeatherPassesPanel } from './WeatherPassesPanel';
import { HighwayPOIsPanel } from './HighwayPOIsPanel';
import { TrafficCorridorPanel } from './TrafficCorridorPanel';
import { RouteComparisonView } from './RouteComparisonView';
import { RouteJunctionTimeline } from './RouteJunctionTimeline';
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
} from 'lucide-react';

interface RoutePlannerProps {
  initialOriginId?: string;
  initialDestId?: string;
  initialVehicle?: VehicleType;
  initialPreference?: RoutePreference;
  onRouteCalculated: (route: RoutePlanResult) => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
  onToggleMapFull?: () => void;
  isMapFull?: boolean;
}

const VEHICLE_CONFIGS: { type: VehicleType; label: string; icon: any; shortName: string; desc: string }[] = [
  { type: 'car', label: 'Car / Sedan', icon: Car, shortName: 'Car', desc: 'Standard sedan or hatchback' },
  { type: 'suv_4wd', label: 'SUV / 4WD Jeep', icon: Mountain, shortName: 'SUV/4WD', desc: 'High ground clearance 4x4' },
  { type: 'motorbike', label: 'Motorcycle', icon: Bike, shortName: 'Bike', desc: 'Motorcycle or scooter' },
  { type: 'bus_truck', label: 'Bus / Heavy Cargo', icon: Truck, shortName: 'Truck', desc: 'Commercial bus or truck' },
  { type: 'electric_vehicle', label: 'Electric Vehicle', icon: Zap, shortName: 'EV', desc: 'Battery electric vehicle' },
];

const PREFERENCE_CONFIGS: { pref: RoutePreference; icon: string; label: string; desc: string }[] = [
  { pref: 'fastest', icon: '⚡', label: 'Fastest', desc: 'Shortest travel time' },
  { pref: 'safest', icon: '🛡️', label: 'Safest', desc: 'Maximum road score & fewer bottlenecks' },
  { pref: 'scenic', icon: '🏔️', label: 'Scenic', desc: 'Mountain vistas & river valleys' },
  { pref: 'ev_optimized', icon: '🔋', label: 'EV Eco', desc: 'EV charging corridors & low consumption' },
];

type DetailModuleTab =
  | 'none'
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
  | 'checklist';

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  initialOriginId = 'ktm',
  initialDestId = 'pkr',
  initialVehicle = 'car',
  initialPreference = 'fastest',
  onRouteCalculated,
  onViewOnMap,
  onToggleMapFull,
  isMapFull = false,
}) => {
  // Routing states
  const [originId, setOriginId] = useState<string>(initialOriginId);
  const [destId, setDestId] = useState<string>(initialDestId);
  const [vehicle, setVehicle] = useState<VehicleType>(initialVehicle);
  const [preference, setPreference] = useState<RoutePreference>(initialPreference);
  const [showVehicleOptions, setShowVehicleOptions] = useState<boolean>(false);
  const [isReportExpanded, setIsReportExpanded] = useState<boolean>(true);
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
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState<boolean>(false);
  const [showTerrainFilters, setShowTerrainFilters] = useState<boolean>(false);

  // Search queries & Autocompletions
  const [singleSearchQuery, setSingleSearchQuery] = useState<string>('');
  const [originSearchQuery, setOriginSearchQuery] = useState<string>('');
  const [destSearchQuery, setDestSearchQuery] = useState<string>('');
  const [isSingleDropdownOpen, setIsSingleDropdownOpen] = useState<boolean>(false);
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState<boolean>(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);

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

  // Active Option Button / Module Expansion (Default: none - don't show contents if user hasn't clicked!)
  const [activeModuleTab, setActiveModuleTab] = useState<DetailModuleTab>('none');
  const [resultsViewMode, setResultsViewMode] = useState<'overview' | 'comparison'>('overview');
  const [travelPlanView, setTravelPlanView] = useState<'timeline' | 'steps'>('timeline');
  // Calculation animation key for smooth CSS fade-in transitions
  const [calcKey, setCalcKey] = useState<number>(0);

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
  const locationMenuRef = useRef<HTMLDivElement>(null);

  // Get current city objects
  const originCity = useMemo(() => CITIES_AND_JUNCTIONS.find((c) => c.id === originId) || CITIES_AND_JUNCTIONS[0], [originId]);
  const destCity = useMemo(() => CITIES_AND_JUNCTIONS.find((c) => c.id === destId) || CITIES_AND_JUNCTIONS[1], [destId]);

  // Sync destination search box with selected city name
  useEffect(() => {
    if (destCity) {
      setSingleSearchQuery(destCity.name);
      setDestSearchQuery(destCity.name);
    }
  }, [destCity]);

  useEffect(() => {
    if (originCity) {
      setOriginSearchQuery(originCity.name);
    }
  }, [originCity]);

  // Initial calculation on mount
  useEffect(() => {
    if (originId && destId && originId !== destId) {
      const plan = findOptimizedRoute(originId, destId, preference, vehicle, terrainFilters);
      if (plan) {
        setRoutePlan(plan);
        setHasCalculated(true);
        onRouteCalculated(plan);
      }
    }
  }, []);

  // Fetch optional telemetry data when respective tabs are clicked
  useEffect(() => {
    if (activeModuleTab === 'weather' && weatherNodes.length === 0) {
      fetch('/api/weather')
        .then((res) => res.json())
        .then((data) => data.weatherNodes && setWeatherNodes(data.weatherNodes))
        .catch(() => {});
    }
    if (activeModuleTab === 'pois' && poisList.length === 0) {
      fetch('/api/pois')
        .then((res) => res.json())
        .then((data) => data.pois && setPoisList(data.pois))
        .catch(() => {});
    }
    if (activeModuleTab === 'traffic' && corridorsList.length === 0) {
      fetch('/api/traffic')
        .then((res) => res.json())
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
      if (locationMenuRef.current && !locationMenuRef.current.contains(e.target as Node)) {
        setIsLocationMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities for search dropdowns
  const filterCities = (query: string) => {
    if (!query) return CITIES_AND_JUNCTIONS.slice(0, 8);
    const q = query.toLowerCase().trim();
    return CITIES_AND_JUNCTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.province.toLowerCase().includes(q) ||
        (c.nepaliName && c.nepaliName.includes(q))
    ).slice(0, 10);
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
      const plan = findOptimizedRoute(fromId, toId, pref, veh, terrainFilters);
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

      // Update URL silently
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const params = new URLSearchParams(window.location.search);
        params.set('origin', fromId);
        params.set('dest', toId);
        params.set('vehicle', veh);
        params.set('pref', pref);
        if (terrainFilters.avoidHighPasses) params.set('avoidPasses', '1');
        else params.delete('avoidPasses');
        if (terrainFilters.requirePavedOnly) params.set('pavedOnly', '1');
        else params.delete('pavedOnly');
        if (terrainFilters.avoidSteepGrades) params.set('avoidSteep', '1');
        else params.delete('avoidSteep');
        if (terrainFilters.avoidActiveLandslideZones) params.set('avoidHazards', '1');
        else params.delete('avoidHazards');
        if (terrainFilters.maxElevationM) params.set('maxElev', String(terrainFilters.maxElevationM));
        else params.delete('maxElev');
        params.set('tab', 'route');
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
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

  // Device Geolocation Auto-Detection
  const handleDetectDeviceLocation = () => {
    if (!navigator.geolocation) {
      setSpeechTranscriptNotice('GPS geolocation is not supported in this browser.');
      setTimeout(() => setSpeechTranscriptNotice(null), 3000);
      return;
    }

    setSpeechTranscriptNotice('Detecting your GPS location in Nepal...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Find nearest city in CITIES_AND_JUNCTIONS
        let closestCity = CITIES_AND_JUNCTIONS[0];
        let minDist = Infinity;

        CITIES_AND_JUNCTIONS.forEach((city) => {
          const d = Math.hypot(city.lat - latitude, city.lng - longitude);
          if (d < minDist) {
            minDist = d;
            closestCity = city;
          }
        });

        setOriginId(closestCity.id);
        setSpeechTranscriptNotice(`Detected location: ${closestCity.name} (${closestCity.district})`);
        setIsLocationMenuOpen(false);
        setTimeout(() => setSpeechTranscriptNotice(null), 3500);
      },
      (err) => {
        setSpeechTranscriptNotice('GPS access denied. Defaulting to Kathmandu.');
        setOriginId('ktm');
        setIsLocationMenuOpen(false);
        setTimeout(() => setSpeechTranscriptNotice(null), 3000);
      },
      { timeout: 8000 }
    );
  };

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
        const matched = CITIES_AND_JUNCTIONS.find(
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
          } else if (target === 'origin') {
            setOriginId(matched.id);
            setOriginSearchQuery(matched.name);
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
      const res = await fetch('/api/ai-smart-route-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToParse }),
      });

      const data = await res.json();
      if (data && data.destId) {
        if (data.originId) setOriginId(data.originId);
        if (data.destId) setDestId(data.destId);
        if (data.vehicle) setVehicle(data.vehicle);
        if (data.preference) setPreference(data.preference);

        const destCityObj = CITIES_AND_JUNCTIONS.find((c) => c.id === data.destId);
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
      const response = await fetch('/api/ai-route-advisor', {
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
      const data = await response.json();
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
  };

  // Toggle detail module tabs
  const handleToggleModuleTab = (tab: DetailModuleTab) => {
    setActiveModuleTab((prev) => (prev === tab ? 'none' : tab));
  };

  return (
    <div className="space-y-4">
      {/* Speech / Live Notice Banner */}
      {speechTranscriptNotice && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 p-3 rounded-2xl flex items-center space-x-2 text-xs text-emerald-200 animate-fadeIn shadow-lg">
          <Mic className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <span className="font-medium">{speechTranscriptNotice}</span>
        </div>
      )}

      {/* AI Parsing Message Banner */}
      {aiParseMessage && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-3 rounded-2xl flex items-center space-x-2 text-xs text-cyan-200 animate-fadeIn shadow-lg">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-medium">{aiParseMessage}</span>
        </div>
      )}

      {/* Main Clean Route Planner Box */}
      <div className="bg-slate-900/95 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-2xl space-y-4">
        {/* 1. MY LOCATION CARD / PICKER */}
        <div className="relative" ref={locationMenuRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            {/* Clickable My Location Widget */}
            <div
              onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
              id="btn-my-location-toggle"
              className="flex items-center space-x-3 cursor-pointer group select-none bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/50 px-3.5 py-2 rounded-xl transition"
              title="Click to view My Location or Change Origin"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  <span>My Location</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isLocationMenuOpen ? 'rotate-180' : ''}`} />
                </div>
                <div className="text-sm font-black text-white truncate font-display">
                  {originCity.name} <span className="text-xs font-normal text-slate-400">({originCity.district} • {originCity.elevationM}m)</span>
                </div>
              </div>
            </div>

            {/* Quick Status / Toggle indicator */}
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                onClick={() => {
                  setLocationMode(locationMode === 'my_location' ? 'custom_from_to' : 'my_location');
                  setIsLocationMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center space-x-1.5 ${
                  locationMode === 'custom_from_to'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title="Toggle between Single Search and Custom From/To inputs"
              >
                <span>{locationMode === 'custom_from_to' ? 'Custom From ➔ To' : 'Change Location'}</span>
              </button>
            </div>
          </div>

          {/* Location Dropdown Options Menu (When user clicks My Location) */}
          {isLocationMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 space-y-1.5 animate-fadeIn">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Choose Location Preference:
              </div>

              {/* Option 1: Current GPS / Device Location */}
              <button
                onClick={() => {
                  handleDetectDeviceLocation();
                  setLocationMode('my_location');
                }}
                className="w-full p-2.5 rounded-xl text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition flex items-start space-x-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <LocateFixed className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                    Use Current GPS Location
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Auto-detects nearest Nepal junction via device sensors
                  </div>
                </div>
              </button>

              {/* Option 2: Change Location (Custom From / To) */}
              <button
                onClick={() => {
                  setLocationMode('custom_from_to');
                  setIsLocationMenuOpen(false);
                }}
                className="w-full p-2.5 rounded-xl text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition flex items-start space-x-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-300">
                    Change Location (From &amp; To)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Manually specify different origin and destination junctions
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 2. SEARCH INPUT BARS */}
        {locationMode === 'my_location' ? (
          /* SINGLE SEARCH BAR with functional Mic and AI icons */
          <div className="space-y-2 relative" ref={singleSearchRef}>
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <span>Where do you want to go in Nepal?</span>
            </label>

            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4 text-emerald-400" />
              </div>

              <input
                type="text"
                value={singleSearchQuery}
                onChange={(e) => {
                  setSingleSearchQuery(e.target.value);
                  setIsSingleDropdownOpen(true);
                }}
                onFocus={() => setIsSingleDropdownOpen(true)}
                placeholder="Search destination (e.g. Pokhara, Mustang, Chitwan, Lumbini, Birgunj)..."
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
                  onClick={() => setIsAiPromptOpen(!isAiPromptOpen)}
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
                {filterCities(singleSearchQuery).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setDestId(c.id);
                      setSingleSearchQuery(c.name);
                      setDestSearchQuery(c.name);
                      setIsSingleDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                        {c.name} {c.nepaliName ? <span className="text-[11px] font-normal text-slate-400">({c.nepaliName})</span> : ''}
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
            <div className="md:col-span-5 space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>From (Origin)</span>
                </span>
                <button
                  onClick={() => startVoiceRecognition('origin')}
                  className={`p-1 rounded-md text-[10px] font-bold flex items-center space-x-1 transition ${
                    listeningTarget === 'origin' ? 'bg-rose-500 text-white' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  }`}
                  title="Voice input for Origin"
                >
                  <Mic className="w-3 h-3" />
                  <span>Voice</span>
                </button>
              </label>

              <select
                id="select-from-origin"
                value={originId}
                onChange={(e) => {
                  setOriginId(e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 transition"
              >
                {CITIES_AND_JUNCTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.district} • {c.elevationM}m)
                  </option>
                ))}
              </select>
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
            <div className="md:col-span-5 space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>To (Destination)</span>
                </span>
                <button
                  onClick={() => startVoiceRecognition('dest')}
                  className={`p-1 rounded-md text-[10px] font-bold flex items-center space-x-1 transition ${
                    listeningTarget === 'dest' ? 'bg-rose-500 text-white' : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  }`}
                  title="Voice input for Destination"
                >
                  <Mic className="w-3 h-3" />
                  <span>Voice</span>
                </button>
              </label>

              <select
                id="select-to-dest"
                value={destId}
                onChange={(e) => {
                  setDestId(e.target.value);
                  const selectedCity = CITIES_AND_JUNCTIONS.find((c) => c.id === e.target.value);
                  if (selectedCity) setSingleSearchQuery(selectedCity.name);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-cyan-500 transition"
              >
                {CITIES_AND_JUNCTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.district} • {c.elevationM}m)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* AI Prompt Input Bar (If user clicks AI icon) */}
        {isAiPromptOpen && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Smart Route Planner (Natural Language)</span>
              </div>
              <button
                onClick={() => setIsAiPromptOpen(false)}
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

        {/* 3. THE PROMINENT "CALCULATE ROUTE & REPORTS" BUTTON */}
        <div className="pt-2">
          <button
            onClick={() => handleCalculateRoute()}
            disabled={isCalculating}
            id="btn-calculate-route-main"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 active:scale-[0.99] text-white rounded-xl text-sm font-black tracking-wide transition shadow-xl shadow-emerald-950/50 flex items-center justify-center space-x-2 border border-emerald-400/30"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Optimizing Highway Geometry &amp; Telemetry...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Calculate Route &amp; Reports</span>
              </>
            )}
          </button>
        </div>

        {/* 4. VEHICLE PROFILE & ROUTING PRIORITY (LOCATED AFTER CALCULATE BUTTON UNDER A DROPDOWN) */}
        <div className="pt-1 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => setShowVehicleOptions(!showVehicleOptions)}
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

              {/* Terrain & Surface Filters toggle inside dropdown */}
              <div className="pt-2 border-t border-slate-800/70">
                <button
                  type="button"
                  onClick={() => setShowTerrainFilters(!showTerrainFilters)}
                  className="w-full text-[11px] font-semibold text-slate-400 hover:text-teal-300 flex items-center justify-between py-1 transition"
                >
                  <span className="flex items-center space-x-1.5">
                    <SlidersHorizontal className="w-3 h-3 text-teal-400" />
                    <span>Terrain &amp; Highway Surface Constraints</span>
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTerrainFilters ? 'rotate-180 text-teal-400' : ''}`} />
                </button>

                {showTerrainFilters && (
                  <div className="mt-2">
                    <TerrainFiltersPanel filters={terrainFilters} onChange={setTerrainFilters} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. READY REPORTS IN A SHORT PLACE WITH MORE INFO (COMPACT BENTO DASHBOARD) */}
      {routePlan && hasCalculated && (
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold shrink-0">
                  {routePlan.totalDistanceKm} km
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.shortName} •{' '}
                <span className="capitalize">{preference.replace('_', ' ')}</span> priority • {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m drive
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
                  const mapElem = document.getElementById('map');
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

              {/* Primary View Mode Switcher */}
              <div className="flex items-center space-x-1 bg-slate-950 p-0.5 sm:p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setResultsViewMode('overview');
                    setIsReportExpanded(true);
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-lg font-bold transition flex items-center space-x-1 text-[11px] ${
                    resultsViewMode === 'overview'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3 h-3" />
                  <span>Overview</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResultsViewMode('comparison');
                    setIsReportExpanded(true);
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-lg font-bold transition flex items-center space-x-1 text-[11px] ${
                    resultsViewMode === 'comparison'
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  <Scale className="w-3 h-3 text-emerald-400" />
                  <span>Compare</span>
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
          </div>

          {/* REDUCED REPORT SUMMARY (When user clicks Reduce Report) */}
          {!isReportExpanded && (
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-fadeIn">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 font-mono text-[11px]">
                <span className="flex items-center space-x-1 text-white font-bold">
                  <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{routePlan.totalDistanceKm} km</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-bold">
                  {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300 font-bold">
                  NPR {(() => {
                    const isEV = vehicle === 'electric_vehicle';
                    const effKmL = Math.max(1.0, customMileageKmL);
                    const unitsReq = Math.round((routePlan.totalDistanceKm / effKmL) * 10) / 10;
                    const price = isEV ? 15 : (vehicle === 'suv_4wd' || vehicle === 'bus_truck') ? 158 : 175;
                    return (Math.round(unitsReq * price) + (routePlan.totalTollCostNpr || 0)).toLocaleString();
                  })()}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-bold">
                  {routePlan.roadConditionScore}/100 Safe
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
                <span>NOC Petrol: Rs 175/L</span>
                <span>•</span>
                <span>Diesel: Rs 158/L</span>
                <span>•</span>
                <span>NEA EV: Rs 15/kWh</span>
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
                const isEV = vehicle === 'electric_vehicle';
                const isDiesel = vehicle === 'suv_4wd' || vehicle === 'bus_truck';
                const unitPrice = isEV ? 15 : isDiesel ? 158 : 175;
                const effKmL = Math.max(1.0, customMileageKmL);
                const unitsReq = Math.round((routePlan.totalDistanceKm / effKmL) * 10) / 10;
                const cost = Math.round(unitsReq * unitPrice);
                const costPerKm = (cost / Math.max(1, routePlan.totalDistanceKm)).toFixed(1);

                return (
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
                        {isEV ? (
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Fuel className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>{isEV ? 'EV Energy Cost' : 'Est. Fuel Cost'}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                        {isEV ? 'NEA Fast Charger' : 'Live Calculated'}
                      </span>
                    </div>
                    <div className="my-2">
                      <div className="text-2xl sm:text-3xl font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span>
                        {unitsReq} {isEV ? 'kWh req.' : 'Liters req.'}
                      </span>
                      <span className="text-slate-300 font-mono">
                        ~Rs {costPerKm}/km
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ELEVATION PROFILE VISUALIZATION (RECHARTS) - DIRECTLY BENEATH ROUTE DETAILS */}
            <div
              id="route-elevation-profile-card"
              key={`route-elevation-profile-${calcKey}`}
              className="pt-1 animate-fade-in-smooth transition-all duration-500 ease-out"
            >
              <RouteElevationProfileChart
                activeRoute={routePlan}
                routePlan={routePlan}
                vehicle={vehicle}
                onViewOnMap={onViewOnMap}
              />
            </div>

              {/* STRUCTURED FUEL COST BREAKDOWN FOR SELECTED VEHICLE */}
              {(() => {
                const isEV = vehicle === 'electric_vehicle';
                const isDiesel = vehicle === 'suv_4wd' || vehicle === 'bus_truck';
                const fuelName = isEV ? 'Electricity (NEA Grid)' : isDiesel ? 'Auto Diesel (NOC)' : 'Petrol / Gasoline (NOC)';
                const unitPrice = isEV ? 15 : isDiesel ? 158 : 175;
                const unitPriceLabel = isEV ? 'Rs 15.00 / kWh' : isDiesel ? 'Rs 158.00 / L' : 'Rs 175.00 / L';

                // Effective km per Liter (or km per kWh for EV)
                const currentEffKmL = Math.max(1.0, customMileageKmL);

                // Calculations
                // Total liters or kWh
                const totalUnitsRequired = Math.round((routePlan.totalDistanceKm / currentEffKmL) * 10) / 10;
                const dynamicFuelCost = Math.round(totalUnitsRequired * unitPrice);
                const dynamicTotalCost = dynamicFuelCost + (routePlan.totalTollCostNpr || 0);
                const dynamicCostPerKm = (dynamicFuelCost / Math.max(1, routePlan.totalDistanceKm)).toFixed(2);

                // Conversion representations
                // MPG US: 1 km/L ≈ 2.35215 MPG
                const currentMpg = (currentEffKmL * 2.35215).toFixed(1);
                // L/100km: 100 / (km/L)
                const currentL100km = (100 / currentEffKmL).toFixed(1);

                // Carbon footprint
                const co2Kg = isEV
                  ? '0 kg (Tailpipe)'
                  : (totalUnitsRequired * (isDiesel ? 2.68 : 2.31)).toFixed(1) + ' kg';

                // Slider configuration based on vehicle type
                const minEff = isEV ? 3.0 : vehicle === 'bus_truck' ? 2.0 : vehicle === 'motorbike' ? 15.0 : 5.0;
                const maxEff = isEV ? 10.0 : vehicle === 'bus_truck' ? 8.0 : vehicle === 'motorbike' ? 70.0 : 30.0;
                const stepEff = isEV ? 0.1 : vehicle === 'motorbike' ? 0.5 : 0.2;

                const defaultBenchmarkEff = isEV ? 6.2 : vehicle === 'car' ? 14.0 : vehicle === 'suv_4wd' ? 10.0 : vehicle === 'motorbike' ? 35.0 : 4.5;

                return (
                  <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-3.5 sm:p-4 space-y-3.5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-800/70">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Fuel className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Detailed Fuel &amp; Transit Cost Breakdown ({VEHICLE_CONFIGS.find((v) => v.type === vehicle)?.label})
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Calculated for {routePlan.totalDistanceKm} km journey factoring vehicle efficiency &amp; elevation climb (+{routePlan.elevationGainM}m)
                          </p>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 self-start sm:self-auto font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        Total Transit Outlay: NPR {dynamicTotalCost.toLocaleString()}
                      </div>
                    </div>

                    {/* INTERACTIVE FUEL EFFICIENCY SLIDER CONTROLLER */}
                    <div className="bg-slate-950/90 rounded-xl p-3 sm:p-3.5 border border-slate-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-slate-200">
                            Custom Fuel Efficiency / Consumption Adjustment
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                            Interactive Slider
                          </span>
                        </div>

                        {/* Unit Switcher Pills (km/L, MPG, L/100km) */}
                        {!isEV ? (
                          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setEfficiencyUnit('km_l')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                                efficiencyUnit === 'km_l'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              km/L
                            </button>
                            <button
                              type="button"
                              onClick={() => setEfficiencyUnit('mpg')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                                efficiencyUnit === 'mpg'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              US MPG
                            </button>
                            <button
                              type="button"
                              onClick={() => setEfficiencyUnit('l_100km')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                                efficiencyUnit === 'l_100km'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              L/100km
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-cyan-400 font-mono">
                            ⚡ EV Metric: km per kWh
                          </span>
                        )}
                      </div>

                      {/* Slider Input Row */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400 text-[11px] font-sans">
                            {isEV ? 'Adjust EV Economy (km/kWh):' : 'Adjust Real-World Mileage:'}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {isEV
                                ? `${currentEffKmL.toFixed(1)} km/kWh`
                                : efficiencyUnit === 'km_l'
                                ? `${currentEffKmL.toFixed(1)} km/L`
                                : efficiencyUnit === 'mpg'
                                ? `${currentMpg} MPG (${currentEffKmL.toFixed(1)} km/L)`
                                : `${currentL100km} L/100km (${currentEffKmL.toFixed(1)} km/L)`}
                            </span>
                            {currentEffKmL !== defaultBenchmarkEff && (
                              <button
                                type="button"
                                onClick={() => setCustomMileageKmL(defaultBenchmarkEff)}
                                className="text-[10px] text-slate-400 hover:text-emerald-400 underline"
                              >
                                Reset ({defaultBenchmarkEff})
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          type="range"
                          min={minEff}
                          max={maxEff}
                          step={stepEff}
                          value={customMileageKmL}
                          onChange={(e) => setCustomMileageKmL(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />

                        <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                          <span>
                            {isEV ? `${minEff} km/kWh (Heavy)` : `${minEff} km/L (Heavy traffic/Climb)`}
                          </span>
                          <span className="text-slate-400">
                            Standard benchmark: {defaultBenchmarkEff} {isEV ? 'km/kWh' : 'km/L'}
                          </span>
                          <span>
                            {isEV ? `${maxEff} km/kWh (Eco)` : `${maxEff} km/L (Highway Eco)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4-Column Itemized Specs for the Selected Vehicle */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Fuel / Tariff Rate</div>
                        <div className="text-xs font-bold text-white mt-0.5">{unitPriceLabel}</div>
                        <div className="text-[9px] text-slate-400 truncate">{fuelName}</div>
                      </div>

                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Current Efficiency</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          {isEV
                            ? `${currentEffKmL.toFixed(1)} km/kWh`
                            : `${currentEffKmL.toFixed(1)} km/L`}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {isEV ? '~160 Wh/km' : `${currentMpg} MPG • ${currentL100km} L/100km`}
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Required Quantity</div>
                        <div className="text-xs font-bold text-cyan-400 mt-0.5">
                          {totalUnitsRequired} {isEV ? 'kWh' : 'Liters'}
                        </div>
                        <div className="text-[9px] text-slate-400">For {routePlan.totalDistanceKm} km trip</div>
                      </div>

                      <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Running Cost / km</div>
                        <div className="text-xs font-bold text-amber-400 mt-0.5">Rs {dynamicCostPerKm} / km</div>
                        <div className="text-[9px] text-slate-400">Direct fuel expense</div>
                      </div>
                    </div>

                    {/* Cost Ledger Table & Mountain Grade Factor */}
                    <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800/80 text-xs space-y-2 font-mono">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                          <span>Base Fuel &amp; Energy ({totalUnitsRequired} {isEV ? 'kWh' : 'L'} @ {unitPriceLabel}):</span>
                        </span>
                        <span className="font-bold text-white self-end sm:self-auto">NPR {dynamicFuelCost.toLocaleString()}</span>
                      </div>

                      {routePlan.totalTollCostNpr > 0 ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300">
                          <span className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                            <span>Highway Tolls &amp; Tunnel Pass:</span>
                          </span>
                          <span className="font-bold text-emerald-400 self-end sm:self-auto">NPR {routePlan.totalTollCostNpr.toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"></span>
                            <span>Highway Tolls / Tunnel Pass:</span>
                          </span>
                          <span className="text-slate-400 font-normal self-end sm:self-auto">NPR 0 (Toll-Free Route)</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300 pt-1.5 border-t border-slate-800">
                        <span className="font-bold text-white flex items-center space-x-1.5">
                          <Receipt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Total Estimated Transit Outlay:</span>
                        </span>
                        <span className="text-sm font-black text-emerald-300 self-end sm:self-auto">
                          NPR {dynamicTotalCost.toLocaleString()}
                        </span>
                      </div>

                      <div className="pt-1 text-[10px] text-slate-400 font-sans flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/50">
                        <span>🏔️ Terrain Grade Factor: Factored +{routePlan.elevationGainM}m mountain ascent (Peak {routePlan.maxElevationM}m ASL)</span>
                        <span>🌿 Est. CO₂ Footprint: <span className="font-semibold text-slate-300">{co2Kg}</span></span>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Quick Vehicle Compare Matrix (Click to switch) */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                <span>Compare Fuel &amp; Energy Cost Across All Vehicles:</span>
                <span className="text-[10px] text-emerald-400 font-normal">Click any card to switch active profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {/* 1. Car / Sedan */}
                {(() => {
                  const liters = Math.round((routePlan.totalDistanceKm / 14.0) * 10) / 10;
                  const cost = Math.round(liters * 175);
                  const isCurrent = vehicle === 'car';
                  return (
                    <div
                      onClick={() => handleQuickVehicleSwitch('car')}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                          <Car className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span>Car / Sedan</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-base font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{liters} L Petrol</span>
                        <span>~Rs {(cost / routePlan.totalDistanceKm).toFixed(1)}/km</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. SUV / 4WD */}
                {(() => {
                  const liters = Math.round((routePlan.totalDistanceKm / 10.0) * 10) / 10;
                  const cost = Math.round(liters * 158);
                  const isCurrent = vehicle === 'suv_4wd';
                  return (
                    <div
                      onClick={() => handleQuickVehicleSwitch('suv_4wd')}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                          <Mountain className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span>SUV / 4WD</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-base font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{liters} L Diesel</span>
                        <span>~Rs {(cost / routePlan.totalDistanceKm).toFixed(1)}/km</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Motorcycle */}
                {(() => {
                  const liters = Math.round((routePlan.totalDistanceKm / 35.0) * 10) / 10;
                  const cost = Math.round(liters * 175);
                  const isCurrent = vehicle === 'motorbike';
                  return (
                    <div
                      onClick={() => handleQuickVehicleSwitch('motorbike')}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                          <Bike className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span>Motorcycle</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-base font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{liters} L Petrol</span>
                        <span>~Rs {(cost / routePlan.totalDistanceKm).toFixed(1)}/km</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Bus / Heavy Truck */}
                {(() => {
                  const liters = Math.round((routePlan.totalDistanceKm / 4.5) * 10) / 10;
                  const cost = Math.round(liters * 158);
                  const isCurrent = vehicle === 'bus_truck';
                  return (
                    <div
                      onClick={() => handleQuickVehicleSwitch('bus_truck')}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                          <Truck className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span>Bus / Truck</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-base font-black text-amber-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{liters} L Diesel</span>
                        <span>~Rs {(cost / routePlan.totalDistanceKm).toFixed(1)}/km</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Electric Vehicle */}
                {(() => {
                  const kwh = Math.round((routePlan.totalDistanceKm / 6.2) * 10) / 10;
                  const cost = Math.round(kwh * 15);
                  const isCurrent = vehicle === 'electric_vehicle';
                  return (
                    <div
                      onClick={() => handleQuickVehicleSwitch('electric_vehicle')}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/5 ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                          <Zap className={`w-3.5 h-3.5 ${isCurrent ? 'text-cyan-400' : 'text-slate-400'}`} />
                          <span>Electric (EV)</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-base font-black text-cyan-300 font-display">
                        NPR {cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{kwh} kWh (NEA)</span>
                        <span className="text-emerald-400 font-semibold">~80% saved</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
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
              Don't show contents if user doesn't click them! */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Detailed Reports &amp; Tools (Click to view):
            </div>

            {/* Option Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {/* Option: Route Comparison View */}
              <button
                onClick={() => {
                  if (resultsViewMode === 'comparison') {
                    setResultsViewMode('overview');
                  } else {
                    setResultsViewMode('comparison');
                  }
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                  resultsViewMode === 'comparison' || activeModuleTab === 'comparison'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Compare Routes</span>
              </button>

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

              {/* Option: Elevation & Steep Gradients */}
              <button
                onClick={() => handleToggleModuleTab('elevation')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                  activeModuleTab === 'elevation'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <Mountain className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">Elevation Profile</span>
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

              {/* Option: POIs & Fuel / EV */}
              <button
                onClick={() => handleToggleModuleTab('pois')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 text-left ${
                  activeModuleTab === 'pois'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <Fuel className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">POIs &amp; Charging</span>
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
                <span className="truncate">Checklist</span>
              </button>
            </div>
          </div>

          {/* 7. DYNAMIC EXPANDED CONTENT AREA (Rendered ONLY when user clicks an option button!) */}
          {activeModuleTab !== 'none' && (
            <div className="pt-3 border-t border-slate-800 space-y-4 animate-fadeIn">
              {/* Module Header with Close Tab button */}
              <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-bold text-white">
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

                      {/* Elevation Profile Chart */}
                      <RouteElevationProfileChart
                        activeRoute={routePlan}
                        routePlan={routePlan}
                        vehicle={vehicle}
                        onViewOnMap={onViewOnMap}
                      />
                    </>
                  )}
                </div>
              )}

              {/* MODULE CONTENT: Elevation Profile & Steep Gradients */}
              {activeModuleTab === 'elevation' && (
                <div className="space-y-4">
                  <RouteElevationProfileChart
                    activeRoute={routePlan}
                    routePlan={routePlan}
                    vehicle={vehicle}
                    onViewOnMap={onViewOnMap}
                  />
                </div>
              )}

              {/* MODULE CONTENT: 2. Weather & Mountain Passes */}
              {activeModuleTab === 'weather' && (
                <div className="space-y-3">
                  <WeatherPassesPanel
                    weatherNodes={weatherNodes}
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
