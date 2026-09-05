export type RoadStatusType = 'clear' | 'caution' | 'obstructed' | 'closed';

export type SurfaceType = 'asphalt_excellent' | 'blacktopped_fair' | 'gravel' | 'under_construction' | 'offroad_mud';

export type IncidentType = 'landslide' | 'flood' | 'construction' | 'fallen_rocks' | 'one_way' | 'accident' | 'bridge_maintenance' | 'traffic_jam' | 'pothole';

export type VehicleType = 'car' | 'suv_4wd' | 'motorbike' | 'bus_truck' | 'electric_vehicle';

export type RoutePreference = 'fastest' | 'shortest' | 'safest' | 'scenic' | 'ev_optimized';

export interface TerrainFilterOptions {
  avoidHighPasses?: boolean; // Avoid mountain passes > 1500m (e.g. Daman Pass, Daunne, Tansen, Karnali)
  requirePavedOnly?: boolean; // Restrict to asphalt/paved roads; heavily penalize or bypass gravel/offroad/construction
  avoidSteepGrades?: boolean; // Avoid steep mountain hairpin climbs (> 6.0% slope gradient)
  avoidActiveLandslideZones?: boolean; // Avoid high landslide hazard alerts and single-lane clearance zones
  maxElevationM?: number; // Optional altitude cap (e.g., 1400m, 1800m, 2200m)
}

export type POICategory = 'ev_charger' | 'fuel_station' | 'food_rest' | 'scenic_pass' | 'emergency_dor' | 'toll_plaza';

export type TrafficLevel = 'smooth' | 'moderate' | 'heavy' | 'standstill' | 'alternating_1way';

export type WeatherCondition = 'sunny' | 'rain_monsoon' | 'dense_fog' | 'cloudy' | 'thunderstorm' | 'mountain_shower';

export type RoadGrip = 'dry_excellent' | 'wet_caution' | 'mud_slippery' | 'fog_low_visibility';

export interface HighwayWeatherNode {
  id: string;
  name: string;
  nepaliName: string;
  highwayCode: string;
  elevationM: number;
  lat: number;
  lng: number;
  tempC: number;
  condition: WeatherCondition;
  rainProbabilityPercent: number;
  humidityPercent: number;
  windSpeedKmh: number;
  visibilityKm: number;
  roadGrip: RoadGrip;
  landslideRisk: 'low' | 'moderate' | 'high' | 'severe';
  summary: string;
  lastUpdated: string;
}

export interface HighwayPOI {
  id: string;
  name: string;
  nepaliName?: string;
  category: POICategory;
  highwayCode: string;
  locationName: string;
  lat: number;
  lng: number;
  rating: number;
  description: string;
  facilities: string[];
  contactNumber?: string;
  evSpecs?: {
    powerKw: number;
    plugs: string[];
    operator: string;
    availablePorts: number;
    totalPorts: number;
  };
  fuelSpecs?: {
    petrolAvailable: boolean;
    dieselAvailable: boolean;
    airPumpAvailable: boolean;
    open24Hours: boolean;
  };
  tollFeeNpr?: {
    bike: number;
    car: number;
    bus_truck: number;
  };
}

export interface HourlyTrafficTrend {
  hour: number; // 0 - 23
  label: string; // "6 AM", "12 PM", etc.
  travelTimeMinutes: number;
  freeFlowMinutes: number;
  delayMinutes: number;
  avgSpeedKmh: number;
  congestionIndex: number; // 0 - 100
  level: TrafficLevel;
  advisoryNote?: string;
}

export type DayProfileType = 'weekday' | 'friday' | 'saturday' | 'festival';

export interface CorridorTrendData {
  corridorId: string;
  corridorName: string;
  highwayCode: string;
  section: string;
  distanceKm: number;
  freeFlowTimeMinutes: number;
  peakTimeMinutes: number;
  bestDepartureWindow: string;
  worstDepartureWindow: string;
  primaryBottlenecks: string[];
  historicalTips: string[];
  hourlyProfiles: Record<DayProfileType, HourlyTrafficTrend[]>;
}

export interface TrafficCorridor {
  id: string;
  name: string;
  highwayCode: string;
  section: string;
  level: TrafficLevel;
  avgSpeedKmh: number;
  normalSpeedKmh: number;
  delayMinutes: number;
  cause: string;
  lastUpdated: string;
  startCoord: [number, number];
  endCoord: [number, number];
  trends?: CorridorTrendData;
}

export interface HighwaySegment {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  avgSpeedKmh: number;
  surface: SurfaceType;
  status: RoadStatusType;
  lanes: number;
  elevationStartM: number;
  elevationEndM: number;
  currentIssue?: string;
  lastUpdated?: string;
  coordinates: [number, number][]; // [lat, lng]
}

export interface EVCharger {
  id: string;
  name: string;
  location: string;
  powerKw: number;
  type: 'CCS2' | 'Type 2' | 'GB/T';
  available: boolean;
  lat: number;
  lng: number;
}

export interface TollPlaza {
  id: string;
  name: string;
  location: string;
  costNpr: Record<VehicleType, number>;
  lat: number;
  lng: number;
}

export interface Highway {
  id: string;
  code: string; // e.g. "NH01", "NH17", "H04"
  name: string; // e.g. "Prithvi Highway"
  nepaliName: string; // e.g. "पृथ्वी राजमार्ग"
  totalLengthKm: number;
  startPoint: string;
  endPoint: string;
  provinces?: string[];
  districts?: string[];
  divisions?: string[];
  route?: string;
  file?: string;
  keyPassesAndJunctions?: string[];
  overallStatus: RoadStatusType;
  conditionRating: number; // 1 to 5
  scenicRating: number; // 1 to 5
  terrainType: 'Plains' | 'Hilly' | 'High Mountain' | 'Mixed';
  description: string;
  dorDivision: string;
  emergencyContact: string;
  segments?: HighwaySegment[];
  evChargers?: EVCharger[];
  tollPlazas?: TollPlaza[];
  activeAlertCount: number;
  featureCount?: number;
  bounds?: [[number, number], [number, number]] | null;
  center?: [number, number];
  coordinates?: [number, number][][]; // Array of polylines from GeoJSON
  segmentLinks?: Array<{
    fid: number;
    linkCode: string;
    linkName: string;
    roadRefNo: string;
    roadName: string;
    linkFrom: number | null;
    linkTo: number | null;
    linkLenKm: number;
    divName: string;
    distName: string;
    paveType: string;
    dyear: string;
  }>;
}

export interface RoadIncident {
  id: string;
  highwayCode: string;
  highwayName: string;
  locationName: string;
  chainageKm?: string;
  lat: number;
  lng: number;
  type: IncidentType;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  title: string;
  description: string;
  status: RoadStatusType;
  reportedAt: string;
  estimatedClearance?: string;
  dorVerified: boolean;
  alternativeRouteAdvice?: string;
  upvotes: number;
}

export interface CityNode {
  id: string;
  name: string;
  nepaliName: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  elevationM: number;
  isMajorHub: boolean;
  connectedHighways: string[];
}

export type SafetyTier = 'high' | 'moderate' | 'elevated_risk' | 'high_hazard';
export type AccidentRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface KnownBlackspot {
  id: string;
  name: string;
  highwayCode: string;
  chainageOrLocation: string;
  riskLevel: 'moderate' | 'high' | 'critical';
  primaryCause: string;
  annualAccidentStats: string;
  safeDrivingAdvice: string;
  coordinates: [number, number];
}

export interface SegmentSafetyData {
  segmentId: string;
  fromName: string;
  toName: string;
  highwayCode: string;
  highwayName: string;
  distanceKm: number;
  safetyScore: number; // 0 to 100
  safetyTier: SafetyTier;
  color: string; // Hex color for mapping e.g. #10b981, #f59e0b, #f97316, #ef4444
  roadQualityScore: number; // 0 to 100
  accidentRiskLevel: AccidentRiskLevel;
  annualAccidentIncidents: number;
  hazardFactors: string[];
  recommendedSpeedKmh: number;
  blackspotName?: string;
  coordinates: [number, number][];
}

export interface RouteSafetyIndex {
  overallScore: number; // 0 to 100
  safetyTier: SafetyTier;
  tierLabel: string;
  color: string;
  roadQualityAverage: number; // 0 to 100
  accidentRiskSummary: {
    safeKm: number; // >= 80 score
    moderateKm: number; // 60 - 79 score
    elevatedRiskKm: number; // 40 - 59 score
    highHazardKm: number; // < 40 score
    safePercentage: number;
  };
  totalHistoricalAnnualAccidents: number;
  activeBlackspots: KnownBlackspot[];
  segmentBreakdown: SegmentSafetyData[];
  keySafetyDirectives: string[];
}

export interface RouteStep {
  instruction: string;
  highwayCode?: string;
  distanceKm: number;
  durationMinutes: number;
  roadStatus: RoadStatusType;
  surface: SurfaceType;
  warning?: string;
  elevationChangeM?: number;
  safetyData?: SegmentSafetyData;
}

export interface RoutePlanResult {
  id: string;
  origin: CityNode;
  destination: CityNode;
  preference: RoutePreference;
  vehicle: VehicleType;
  routeName?: string;
  routeColor?: string;
  routeBadge?: string;
  viaHighlights?: string;
  scenicRating?: number; // 1 to 5
  totalDistanceKm: number;
  estimatedTimeMinutes: number;
  roadConditionScore: number; // 0 - 100
  safetyIndex: RouteSafetyIndex;
  statusSummary: {
    clearKm: number;
    cautionKm: number;
    obstructedKm: number;
  };
  fuelEstimate: {
    liters: number;
    costNpr: number;
    avgMileageKmPerLiter: number;
  };
  evEstimate?: {
    kwhRequired: number;
    recommendedChargingStops: EVCharger[];
    batteryUsagePercent: number;
  };
  totalTollCostNpr: number;
  elevationGainM: number;
  maxElevationM: number;
  incidentsOnRoute: RoadIncident[];
  steps: RouteStep[];
  pathCoordinates: [number, number][];
  alternateRouteSummary?: {
    name: string;
    distanceDiffKm: number;
    timeDiffMinutes: number;
    reason: string;
  };
  allRouteOptions?: RoutePlanResult[];
  appliedTerrainFilters?: TerrainFilterOptions;
  aiAdvisory?: {
    summary: string;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
    keyRecommendations: string[];
    monsoonOrWeatherWarning?: string;
    bestDepartureWindow: string;
    emergencyContacts: string[];
  };
}

export interface UserRoadReport {
  id: string;
  highwayCode: string;
  location: string;
  incidentType: IncidentType;
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  photoUrl?: string;
  reporterName: string;
  contactNumber?: string;
  createdAt: string;
  upvotes: number;
  verified: boolean;
}

export type TripStopCategory = 'scenic_viewpoint' | 'cafe_dining' | 'rest_stop' | 'cultural_heritage' | 'ev_charging';

export interface TripAssistantStop {
  id: string;
  name: string;
  category: TripStopCategory;
  approxKmFromOrigin: number;
  approxTravelTime: string;
  locationName: string;
  highwayCode?: string;
  highlights: string;
  proTip: string;
  bestFor: string;
  rating: number;
  lat?: number;
  lng?: number;
}

export interface TripAssistantPlan {
  tripTitle: string;
  overallVibe: string;
  destinationOverview: {
    tagline: string;
    mustDoUponArrival: string;
    localSpecialty: string;
    parkingTip: string;
  };
  suggestedStops: TripAssistantStop[];
  travelerTips: string[];
  customAnswer?: string;
}

export type EmergencyDistressType =
  | 'accident'
  | 'landslide_obstruction'
  | 'vehicle_breakdown'
  | 'ev_battery_or_fuel'
  | 'mountain_weather'
  | 'offroad_distress'
  | 'medical'
  | 'general_rescue';

export interface EmergencyDispatchData {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  altitudeM?: number;
  timestamp: string;
  nearestCityName: string;
  nearestCityDistrict?: string;
  distanceToCityKm: number;
  nearestHighwayName?: string;
  activeRouteSummary?: string;
  distressType: EmergencyDistressType;
  customNotes?: string;
  vehicleType: VehicleType;
  vehiclePlateNumber?: string;
  passengerCount?: number;
  batteryStatus?: string;
}

