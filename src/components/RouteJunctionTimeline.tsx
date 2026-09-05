import React, { useState, useMemo, useCallback } from 'react';
import {
  RoutePlanResult,
  VehicleType,
  CityNode,
} from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import {
  Clock,
  MapPin,
  Milestone,
  Navigation,
  Compass,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Zap,
  Utensils,
  Coffee,
  ShieldCheck,
  ShieldAlert,
  Mountain,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Calendar,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Sliders,
  Flag,
  Car,
  Bike,
  Truck,
  Building2,
  Crosshair,
  ExternalLink,
} from 'lucide-react';

export type JunctionCategory =
  | 'origin'
  | 'destination'
  | 'interchange'
  | 'pass'
  | 'bridge'
  | 'dining'
  | 'checkpoint'
  | 'landmark';

export interface TimelineJunctionPoint {
  id: string;
  name: string;
  nepaliName?: string;
  category: JunctionCategory;
  categoryLabel: string;
  district?: string;
  province?: string;
  lat: number;
  lng: number;
  elevationM: number;
  elevationDeltaM: number;
  distanceFromStartKm: number;
  segmentDistanceKm: number;
  segmentDurationMinutes: number;
  cumulativeDriveMinutes: number;
  elapsedTotalMinutes: number;
  etaFormatted: string;
  dayOffset: number;
  highwayCode?: string;
  highwayName?: string;
  roadStatus?: 'clear' | 'caution' | 'obstructed' | 'closed';
  surface?: string;
  warning?: string;
  amenities: ('fuel' | 'ev' | 'food' | 'police' | 'hospital' | 'scenic')[];
  recommendedNote?: string;
  isMajorHub: boolean;
  plannedStopMinutes: number;
}

interface RouteJunctionTimelineProps {
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
  onViewOnMap?: (target: { lat: number; lng: number; title: string; zoom?: number }) => void;
  className?: string;
}

// Known intermediate landmarks, mountain passes, tunnels, and river confluences
interface IntermediateLandmark {
  fromId: string;
  toId: string;
  id: string;
  name: string;
  nepaliName: string;
  category: JunctionCategory;
  categoryLabel: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  elevationM: number;
  fractionAlongSegment: number; // 0.0 to 1.0
  amenities: ('fuel' | 'ev' | 'food' | 'police' | 'hospital' | 'scenic')[];
  note: string;
}

const KNOWN_INTERMEDIATE_LANDMARKS: IntermediateLandmark[] = [
  // Kathmandu to Naubise
  {
    fromId: 'ktm',
    toId: 'nbz',
    id: 'nagdhunga_pass',
    name: 'Nagdhunga Ridge & Tunnel Bypass',
    nepaliName: 'नागढुंगा डाँडा तथा सुरुङमार्ग',
    category: 'pass',
    categoryLabel: 'Mountain Pass & Tunnel Portal',
    district: 'Kathmandu / Dhading Border',
    province: 'Bagmati',
    lat: 27.7020,
    lng: 85.2010,
    elevationM: 1510,
    fractionAlongSegment: 0.6,
    amenities: ['police', 'fuel', 'food', 'scenic'],
    note: 'Primary western valley gateway checkpoint and Sisne Khola tunnel portal.',
  },
  // Naubise to Mugling
  {
    fromId: 'nbz',
    toId: 'mgl',
    id: 'galchhi_fork',
    name: 'Galchhi 3-Way Interchange',
    nepaliName: 'गल्छी चोक',
    category: 'interchange',
    categoryLabel: 'Major Highway Interchange',
    district: 'Dhading',
    province: 'Bagmati',
    lat: 27.8105,
    lng: 84.9754,
    elevationM: 560,
    fractionAlongSegment: 0.28,
    amenities: ['fuel', 'food', 'police'],
    note: 'Strategic junction connecting Prithvi Highway to Trishuli, Rasuwa & China Border.',
  },
  {
    fromId: 'nbz',
    toId: 'mgl',
    id: 'malekhu_hub',
    name: 'Malekhu River Crossing & Dining Hub',
    nepaliName: 'मलेखु बजार',
    category: 'dining',
    categoryLabel: 'Highway Dining & Fish Bazaar',
    district: 'Dhading',
    province: 'Bagmati',
    lat: 27.8228,
    lng: 84.8155,
    elevationM: 420,
    fractionAlongSegment: 0.55,
    amenities: ['food', 'fuel'],
    note: 'Famous Trishuli river rest stop for highway breakfast, tea, and local freshwater fish.',
  },
  {
    fromId: 'nbz',
    toId: 'mgl',
    id: 'kurintar_cablecar',
    name: 'Kurintar Cable Car Base & EV Hub',
    nepaliName: 'कुरिनटार',
    category: 'landmark',
    categoryLabel: 'EV Fast-Charge & Cable Car Base',
    district: 'Chitwan',
    province: 'Bagmati',
    lat: 27.8423,
    lng: 84.7155,
    elevationM: 310,
    fractionAlongSegment: 0.82,
    amenities: ['ev', 'fuel', 'food', 'scenic'],
    note: 'Manakamana Temple Cable Car base station and 30kW CCS2 DC EV fast charging station.',
  },
  // Mugling to Narayanghat
  {
    fromId: 'mgl',
    toId: 'cht',
    id: 'jalbire_gorge',
    name: 'Jalbire Gorge & Waterfall Zone',
    nepaliName: 'जलबिरे तथा गाईघाट',
    category: 'landmark',
    categoryLabel: 'River Gorge & Rockfall Protection',
    district: 'Chitwan',
    province: 'Bagmati',
    lat: 27.7650,
    lng: 84.4750,
    elevationM: 240,
    fractionAlongSegment: 0.5,
    amenities: ['police', 'scenic'],
    note: 'Narayani river canyon with high-tensile rockfall barriers and monitored bends.',
  },
  // Mugling to Damauli
  {
    fromId: 'mgl',
    toId: 'dml',
    id: 'anbu_khaireni',
    name: 'Anbu Khaireni Confluence Bridge',
    nepaliName: 'आँबुखैरेनी',
    category: 'interchange',
    categoryLabel: 'River Confluence & Gorkha Turnoff',
    district: 'Tanahun',
    province: 'Gandaki',
    lat: 27.9142,
    lng: 84.4223,
    elevationM: 340,
    fractionAlongSegment: 0.32,
    amenities: ['fuel', 'food', 'police'],
    note: 'Marsyangdi River bridge and historic Gorkha district highway interchange.',
  },
  {
    fromId: 'mgl',
    toId: 'dml',
    id: 'dumre_gateway',
    name: 'Dumre Annapurna Gateway',
    nepaliName: 'डुम्रे बजार',
    category: 'interchange',
    categoryLabel: 'Lamjung & Annapurna Circuit Fork',
    district: 'Tanahun',
    province: 'Gandaki',
    lat: 27.9450,
    lng: 84.3800,
    elevationM: 410,
    fractionAlongSegment: 0.65,
    amenities: ['fuel', 'food'],
    note: 'Direct turnoff towards Besisahar, Manang, and the Annapurna trekking circuit.',
  },
  // Damauli to Pokhara
  {
    fromId: 'dml',
    toId: 'pkr',
    id: 'khairenitar_dulegauda',
    name: 'Khairenitar & Dulegauda Hub',
    nepaliName: 'खैरेनीटार / दुलेगौंडा',
    category: 'landmark',
    categoryLabel: 'Seti River Highway Hub',
    district: 'Tanahun',
    province: 'Gandaki',
    lat: 28.0833,
    lng: 84.1432,
    elevationM: 560,
    fractionAlongSegment: 0.52,
    amenities: ['fuel', 'food', 'police'],
    note: 'Seti River commercial basin with multiple refueling stations and vehicle services.',
  },
  {
    fromId: 'dml',
    toId: 'pkr',
    id: 'kotre_kaski_entry',
    name: 'Kotre Kaski Gateway',
    nepaliName: 'कोत्रे',
    category: 'checkpoint',
    categoryLabel: 'Metropolitan Entry & Weighbridge',
    district: 'Kaski',
    province: 'Gandaki',
    lat: 28.1400,
    lng: 84.0500,
    elevationM: 680,
    fractionAlongSegment: 0.8,
    amenities: ['police', 'fuel'],
    note: 'Welcome gate into Pokhara Metropolitan City valley basin.',
  },
  // Narayanghat to Butwal
  {
    fromId: 'cht',
    toId: 'btl',
    id: 'kawasoti_hub',
    name: 'Kawasoti Highway Hub',
    nepaliName: 'कावासोती',
    category: 'landmark',
    categoryLabel: 'Terai Commercial Hub',
    district: 'Nawalpur',
    province: 'Gandaki',
    lat: 27.6500,
    lng: 84.1200,
    elevationM: 195,
    fractionAlongSegment: 0.32,
    amenities: ['fuel', 'ev', 'food', 'hospital'],
    note: 'Central refueling, fast DC charging, and medical emergency hub along the Mahendra Highway.',
  },
  {
    fromId: 'cht',
    toId: 'btl',
    id: 'dumkibas_entry',
    name: 'Dumkibas Foothill Ascent',
    nepaliName: 'दुम्किबास',
    category: 'checkpoint',
    categoryLabel: 'Pass Ascent Foothills',
    district: 'Nawalpur',
    province: 'Gandaki',
    lat: 27.5600,
    lng: 83.8900,
    elevationM: 175,
    fractionAlongSegment: 0.52,
    amenities: ['food', 'police'],
    note: 'Eastern base of the Daunne Hill climb; traffic checkpost and heavy truck staging area.',
  },
  {
    fromId: 'cht',
    toId: 'btl',
    id: 'daunne_pass_crest',
    name: 'Daunne Hills Summit Pass',
    nepaliName: 'दाउन्ने डाँडा शिखर',
    category: 'pass',
    categoryLabel: 'Mountain Pass & Temple Crest',
    district: 'Nawalparasi Border',
    province: 'Lumbini',
    lat: 27.5300,
    lng: 83.8400,
    elevationM: 550,
    fractionAlongSegment: 0.65,
    amenities: ['food', 'police', 'scenic'],
    note: 'Historic pass summit with Daunne Devi Temple; active highway widening chokepoint.',
  },
  {
    fromId: 'cht',
    toId: 'btl',
    id: 'bardaghat_junction',
    name: 'Bardaghat 3-Way Junction',
    nepaliName: 'बर्दघाट चोक',
    category: 'interchange',
    categoryLabel: 'Plains Interchange',
    district: 'Parasi (Nawalparasi West)',
    province: 'Lumbini',
    lat: 27.4800,
    lng: 83.8000,
    elevationM: 160,
    fractionAlongSegment: 0.78,
    amenities: ['fuel', 'food', 'police'],
    note: 'Western foot of Daunne pass, connecting to Tribeni border and Rupandehi plains.',
  },
  // Butwal to Palpa
  {
    fromId: 'btl',
    toId: 'plp',
    id: 'siddhababa_shed',
    name: 'Siddhababa Rockfall Shed & Temple',
    nepaliName: 'सिद्धबाबा रक-शेड',
    category: 'pass',
    categoryLabel: 'Gorge Rock-Shed & Temple',
    district: 'Palpa Border',
    province: 'Lumbini',
    lat: 27.7400,
    lng: 83.4700,
    elevationM: 450,
    fractionAlongSegment: 0.22,
    amenities: ['police', 'scenic'],
    note: 'Heavy engineering rockfall protection shed along Tinau river gorge canyon.',
  },
  {
    fromId: 'btl',
    toId: 'plp',
    id: 'dobhan_bridge',
    name: 'Dobhan Tinau Confluence',
    nepaliName: 'दोभान',
    category: 'bridge',
    categoryLabel: 'River Confluence Bridge',
    district: 'Palpa',
    province: 'Lumbini',
    lat: 27.7800,
    lng: 83.5100,
    elevationM: 580,
    fractionAlongSegment: 0.58,
    amenities: ['food', 'police'],
    note: 'Beginning of the winding Siddhartha Highway hill ascent to Tansen.',
  },
  // Narayanghat to Hetauda
  {
    fromId: 'cht',
    toId: 'htd',
    id: 'manahari_bridge',
    name: 'Manahari River Bridge & Buffer',
    nepaliName: 'मनहरी पुल',
    category: 'bridge',
    categoryLabel: 'National Park Wildlife Corridor',
    district: 'Makwanpur',
    province: 'Bagmati',
    lat: 27.5700,
    lng: 84.7500,
    elevationM: 320,
    fractionAlongSegment: 0.55,
    amenities: ['fuel', 'food', 'police'],
    note: 'Parsa-Chitwan forest buffer zone bridge with controlled wildlife speed limits.',
  },
  // Hetauda to Birgunj
  {
    fromId: 'htd',
    toId: 'brg',
    id: 'pathlaiya_junction',
    name: 'Pathlaiya 4-Way Interchange',
    nepaliName: 'पथलैया चोक',
    category: 'interchange',
    categoryLabel: 'Cross-Highway Interchange (H01 x H02)',
    district: 'Bara',
    province: 'Madhesh',
    lat: 27.1800,
    lng: 84.9900,
    elevationM: 120,
    fractionAlongSegment: 0.52,
    amenities: ['fuel', 'ev', 'food', 'police'],
    note: 'Major national nexus connecting East-West Highway (H01) to Tribhuvan Highway (H02).',
  },
  // Kathmandu to Dhulikhel
  {
    fromId: 'ktm',
    toId: 'dhk',
    id: 'banepa_crossing',
    name: 'Banepa Commercial Interchange',
    nepaliName: 'बनेपा चोक',
    category: 'interchange',
    categoryLabel: 'Kavre Valley Nexus',
    district: 'Kavrepalanchok',
    province: 'Bagmati',
    lat: 27.6300,
    lng: 85.5200,
    elevationM: 1470,
    fractionAlongSegment: 0.7,
    amenities: ['fuel', 'food', 'hospital', 'police'],
    note: 'Key junction connecting Araniko Highway to Panauti, Nala, and eastern valleys.',
  },
  // Dhulikhel to Sindhuli
  {
    fromId: 'dhk',
    toId: 'sdh',
    id: 'nepalthok_roshi',
    name: 'Nepalthok Roshi Confluence',
    nepaliName: 'नेपालथोक',
    category: 'bridge',
    categoryLabel: 'River Confluence Bridge',
    district: 'Sindhuli',
    province: 'Bagmati',
    lat: 27.4200,
    lng: 85.8300,
    elevationM: 650,
    fractionAlongSegment: 0.5,
    amenities: ['food', 'fuel', 'police'],
    note: 'BP Highway scenic winding valley bridge along Roshi Khola.',
  },
  {
    fromId: 'dhk',
    toId: 'sdh',
    id: 'khurkot_midhill',
    name: 'Khurkot Sunkoshi & Mid-Hill Junction',
    nepaliName: 'खुरकोट चोक',
    category: 'interchange',
    categoryLabel: 'Mid-Hill Highway Confluence (H13 x H17)',
    district: 'Sindhuli',
    province: 'Bagmati',
    lat: 27.3300,
    lng: 85.9900,
    elevationM: 470,
    fractionAlongSegment: 0.82,
    amenities: ['fuel', 'food', 'police'],
    note: 'Major Sunkoshi River bridge connecting BP Highway to Mid-Hill Highway (Pushpalal Lokmarga).',
  },
];

export const RouteJunctionTimeline: React.FC<RouteJunctionTimelineProps> = ({
  routePlan,
  vehicle,
  onViewOnMap,
  className = '',
}) => {
  // 1. Interactive Departure Time (default: current system local time or 07:00 AM)
  const [departureTime, setDepartureTime] = useState<string>(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  });

  // 2. Pace Buffer / Driving Conditions (1.0x normal, 1.2x monsoon/rain, 1.35x night/heavy traffic)
  const [paceMultiplier, setPaceMultiplier] = useState<number>(1.0);

  // 3. Planned Rest Stops & Buffers (junctionId -> minutes)
  const [plannedStops, setPlannedStops] = useState<Record<string, number>>({});

  // 4. Filter view: 'all' (milestones & passes included) vs 'interchanges_only'
  const [filterMode, setFilterMode] = useState<'all' | 'interchanges_only'>('all');

  // 5. Expand state for inspecting junction details
  const [expandedJunctionIds, setExpandedJunctionIds] = useState<Record<string, boolean>>({});

  // 6. Copy Itinerary Feedback Toast
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Toggle expansion of a junction card
  const toggleJunctionExpand = (id: string) => {
    setExpandedJunctionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Add / modify a planned rest stop at a junction
  const handleSetPlannedStop = (junctionId: string, minutes: number) => {
    setPlannedStops((prev) => {
      const next = { ...prev };
      if (minutes <= 0) {
        delete next[junctionId];
      } else {
        next[junctionId] = minutes;
      }
      return next;
    });
  };

  // Helper to format minutes into clock time based on departureTime
  const computeClockTime = useCallback(
    (totalElapsedMinutes: number) => {
      const [depHours, depMins] = departureTime.split(':').map(Number);
      const departureDate = new Date();
      departureDate.setHours(depHours || 7, depMins || 0, 0, 0);

      const targetDate = new Date(departureDate.getTime() + totalElapsedMinutes * 60 * 1000);

      let hours = targetDate.getHours();
      const mins = targetDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const formattedTime = `${hours}:${String(mins).padStart(2, '0')} ${ampm}`;

      // Calculate calendar day difference
      const dayDiff = Math.floor(
        (targetDate.getTime() - departureDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      return {
        formattedTime,
        dayOffset: dayDiff,
      };
    },
    [departureTime]
  );

  // Build the complete sequential list of timeline junctions
  const rawTimelineJunctions = useMemo<TimelineJunctionPoint[]>(() => {
    const list: TimelineJunctionPoint[] = [];

    // Milestone 0: Origin (Departure)
    const originNode = routePlan.origin;
    const originStopMinutes = plannedStops['origin'] || 0;
    const { formattedTime: originEta, dayOffset: originDay } = computeClockTime(0);

    list.push({
      id: `junction-${originNode.id}`,
      name: originNode.name,
      nepaliName: originNode.nepaliName,
      category: 'origin',
      categoryLabel: 'Trip Origin & Departure Hub',
      district: originNode.district,
      province: originNode.province,
      lat: originNode.lat,
      lng: originNode.lng,
      elevationM: originNode.elevationM,
      elevationDeltaM: 0,
      distanceFromStartKm: 0,
      segmentDistanceKm: 0,
      segmentDurationMinutes: 0,
      cumulativeDriveMinutes: 0,
      elapsedTotalMinutes: 0,
      etaFormatted: originEta,
      dayOffset: originDay,
      highwayCode: originNode.connectedHighways[0],
      amenities: ['fuel', 'ev', 'food', 'police', 'hospital'],
      recommendedNote: 'Conduct pre-trip tire, coolant, and brake checks before highway departure.',
      isMajorHub: true,
      plannedStopMinutes: originStopMinutes,
    });

    let runningDistanceKm = 0;
    let runningDriveMinutes = 0;
    let runningTotalElapsedMinutes = originStopMinutes;
    let lastElevation = originNode.elevationM;

    // Traverse each route step
    routePlan.steps.forEach((step, stepIdx) => {
      const fromId = step.safetyData?.fromId || (stepIdx === 0 ? routePlan.origin.id : '');
      const toId = step.safetyData?.toId || '';
      const toNode = CITIES_AND_JUNCTIONS.find((c) => c.id === toId);

      // Check if there are intermediate landmarks along this edge
      const intermediates = KNOWN_INTERMEDIATE_LANDMARKS.filter(
        (im) => im.fromId === fromId && im.toId === toId
      ).sort((a, b) => a.fractionAlongSegment - b.fractionAlongSegment);

      let prevFraction = 0;

      // Add each intermediate landmark along the segment
      intermediates.forEach((im) => {
        const segFrac = im.fractionAlongSegment - prevFraction;
        const subDistKm = Math.round(step.distanceKm * segFrac * 10) / 10;
        const subDurationMins = Math.round(step.durationMinutes * segFrac * paceMultiplier);

        runningDistanceKm = Math.round((runningDistanceKm + subDistKm) * 10) / 10;
        runningDriveMinutes += subDurationMins;
        runningTotalElapsedMinutes += subDurationMins;

        const stopMins = plannedStops[im.id] || 0;
        const { formattedTime, dayOffset } = computeClockTime(runningTotalElapsedMinutes);

        const elevDelta = im.elevationM - lastElevation;
        lastElevation = im.elevationM;

        list.push({
          id: im.id,
          name: im.name,
          nepaliName: im.nepaliName,
          category: im.category,
          categoryLabel: im.categoryLabel,
          district: im.district,
          province: im.province,
          lat: im.lat,
          lng: im.lng,
          elevationM: im.elevationM,
          elevationDeltaM: elevDelta,
          distanceFromStartKm: runningDistanceKm,
          segmentDistanceKm: subDistKm,
          segmentDurationMinutes: subDurationMins,
          cumulativeDriveMinutes: runningDriveMinutes,
          elapsedTotalMinutes: runningTotalElapsedMinutes,
          etaFormatted: formattedTime,
          dayOffset,
          highwayCode: step.highwayCode,
          highwayName: step.safetyData?.highwayName,
          roadStatus: step.roadStatus,
          surface: step.surface,
          warning: step.warning,
          amenities: im.amenities,
          recommendedNote: im.note,
          isMajorHub: false,
          plannedStopMinutes: stopMins,
        });

        // Add the planned stop to elapsed time for subsequent junctions
        runningTotalElapsedMinutes += stopMins;
        prevFraction = im.fractionAlongSegment;
      });

      // Now add the segment destination junction (city node)
      const remainingFrac = 1.0 - prevFraction;
      const subDistKm = Math.round(step.distanceKm * remainingFrac * 10) / 10;
      const subDurationMins = Math.round(step.durationMinutes * remainingFrac * paceMultiplier);

      runningDistanceKm = Math.round((runningDistanceKm + subDistKm) * 10) / 10;
      runningDriveMinutes += subDurationMins;
      runningTotalElapsedMinutes += subDurationMins;

      const isFinalDestination = stepIdx === routePlan.steps.length - 1;
      const destNode = isFinalDestination ? routePlan.destination : toNode;

      const junctionName = destNode ? destNode.name : step.safetyData?.toName || `Junction ${stepIdx + 1}`;
      const junctionNepali = destNode?.nepaliName;
      const junctionElevation = destNode?.elevationM ?? (lastElevation + (step.elevationChangeM || 0));
      const elevDelta = junctionElevation - lastElevation;
      lastElevation = junctionElevation;

      const junctionId = `node-${destNode?.id || stepIdx}`;
      const stopMins = plannedStops[junctionId] || 0;
      const { formattedTime, dayOffset } = computeClockTime(runningTotalElapsedMinutes);

      const isInterchange = Boolean(destNode && destNode.connectedHighways.length > 1);

      list.push({
        id: junctionId,
        name: junctionName,
        nepaliName: junctionNepali,
        category: isFinalDestination
          ? 'destination'
          : isInterchange
          ? 'interchange'
          : 'landmark',
        categoryLabel: isFinalDestination
          ? 'Final Destination Arrival'
          : isInterchange
          ? `Highway Interchange (${destNode?.connectedHighways.join(' • ')})`
          : 'Town & Highway Milestone',
        district: destNode?.district,
        province: destNode?.province,
        lat: destNode?.lat ?? (step.safetyData?.coordinates?.[0]?.[0] || routePlan.destination.lat),
        lng: destNode?.lng ?? (step.safetyData?.coordinates?.[0]?.[1] || routePlan.destination.lng),
        elevationM: junctionElevation,
        elevationDeltaM: elevDelta,
        distanceFromStartKm: runningDistanceKm,
        segmentDistanceKm: subDistKm,
        segmentDurationMinutes: subDurationMins,
        cumulativeDriveMinutes: runningDriveMinutes,
        elapsedTotalMinutes: runningTotalElapsedMinutes,
        etaFormatted: formattedTime,
        dayOffset,
        highwayCode: step.highwayCode,
        highwayName: step.safetyData?.highwayName,
        roadStatus: step.roadStatus,
        surface: step.surface,
        warning: step.warning,
        amenities: isFinalDestination
          ? ['fuel', 'ev', 'food', 'hospital', 'police']
          : ['fuel', 'food', 'police'],
        recommendedNote: isFinalDestination
          ? 'Journey complete. Confirm safe arrival and vehicle state.'
          : destNode?.isMajorHub
          ? 'Major regional transit hub with fuel, mechanical assistance, and food.'
          : undefined,
        isMajorHub: destNode?.isMajorHub ?? false,
        plannedStopMinutes: stopMins,
      });

      runningTotalElapsedMinutes += stopMins;
    });

    return list;
  }, [routePlan, paceMultiplier, plannedStops, computeClockTime]);

  // Filtered junctions based on user preference
  const visibleJunctions = useMemo(() => {
    if (filterMode === 'all') return rawTimelineJunctions;
    return rawTimelineJunctions.filter(
      (j) => j.category === 'origin' || j.category === 'destination' || j.category === 'interchange' || j.isMajorHub
    );
  }, [rawTimelineJunctions, filterMode]);

  // Summary Metrics
  const summary = useMemo(() => {
    const lastJunction = rawTimelineJunctions[rawTimelineJunctions.length - 1];
    const totalBreaksMins = Object.values(plannedStops).reduce((acc: number, m: number) => acc + m, 0);
    const minElev = Math.min(...rawTimelineJunctions.map((j) => j.elevationM));
    const maxElev = Math.max(...rawTimelineJunctions.map((j) => j.elevationM));

    const totalDriveMins = lastJunction ? lastJunction.cumulativeDriveMinutes : 0;
    const finalEta = lastJunction ? lastJunction.etaFormatted : '--:--';
    const finalDayOffset = lastJunction ? lastJunction.dayOffset : 0;

    return {
      totalDistanceKm: lastJunction?.distanceFromStartKm || routePlan.totalDistanceKm,
      totalDriveMinutes: totalDriveMins,
      totalBreaksMinutes: totalBreaksMins,
      finalEta,
      finalDayOffset,
      minElev,
      maxElev,
      junctionCount: rawTimelineJunctions.length,
    };
  }, [rawTimelineJunctions, plannedStops, routePlan.totalDistanceKm]);

  // Copy Complete Itinerary to Clipboard
  const handleCopyItinerary = () => {
    const header = `📍 NEPAL HIGHWAY TRIP TIMELINE: ${routePlan.origin.name} ➔ ${routePlan.destination.name}\n` +
      `🚗 Vehicle: ${vehicle.replace('_', ' ').toUpperCase()} • Total Distance: ${summary.totalDistanceKm} km\n` +
      `🕒 Departure Time: ${departureTime} • Planned Stops: ${summary.totalBreaksMinutes} mins\n` +
      `----------------------------------------------------------------------\n`;

    const body = rawTimelineJunctions
      .map((j, idx) => {
        const breakTag = j.plannedStopMinutes > 0 ? ` [☕ Break: +${j.plannedStopMinutes}m]` : '';
        const dayTag = j.dayOffset > 0 ? ` (+${j.dayOffset}d)` : '';
        return `${idx + 1}. [${j.etaFormatted}${dayTag}] ${j.name}${j.nepaliName ? ` (${j.nepaliName})` : ''} • Elev: ${j.elevationM}m • +${j.distanceFromStartKm} km${breakTag}`;
      })
      .join('\n');

    const footer = `\n----------------------------------------------------------------------\n` +
      `🏁 Est. Arrival: ${summary.finalEta} (${Math.floor(summary.totalDriveMinutes / 60)}h ${summary.totalDriveMinutes % 60}m drive + ${summary.totalBreaksMinutes}m stops)`;

    const textToCopy = header + body + footer;
    navigator.clipboard.writeText(textToCopy);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // Helper to format minutes into clean hours and minutes
  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-slate-200 shadow-xl space-y-5 ${className}`}
      id="route-junction-timeline"
    >
      {/* 1. Header with Title & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Milestone className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Highway Junction Timeline</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  Live ETAs
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sequential itinerary across major junctions, mountain passes, and river crossings with live time-of-arrival estimates.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Copy Itinerary & Filter */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopyItinerary}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shadow-sm"
            title="Copy Schedule to Clipboard for WhatsApp / SMS"
            id="btn-copy-junction-itinerary"
          >
            {copiedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copy Itinerary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Interactive Departure Time & Pace Buffer Bar */}
      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Departure Time Controller */}
          <div className="flex items-center space-x-2.5">
            <span className="text-slate-400 font-bold flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Departure Time:</span>
            </span>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value || '07:00')}
              className="bg-slate-900 border border-slate-700 text-emerald-300 text-xs font-extrabold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner cursor-pointer"
              id="input-departure-time"
            />
            {/* Quick Departure Presets */}
            <div className="hidden sm:flex items-center space-x-1">
              {[
                { label: 'Now', val: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}` },
                { label: '06:00 AM', val: '06:00' },
                { label: '07:30 AM', val: '07:30' },
                { label: '10:00 AM', val: '10:00' },
                { label: '01:30 PM', val: '13:30' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setDepartureTime(preset.val)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                    departureTime === preset.val
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pace / Driving Condition Buffer */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Speed Profile:</span>
            </span>
            <select
              value={paceMultiplier}
              onChange={(e) => setPaceMultiplier(parseFloat(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              id="select-pace-profile"
            >
              <option value={1.0}>Standard Normal Pace (1.0x)</option>
              <option value={1.2}>Monsoon / Rain Buffer (+20% time)</option>
              <option value={1.35}>Night Drive / Heavy Fog (+35% time)</option>
              <option value={0.9}>Express Highway Empty (+10% faster)</option>
            </select>
          </div>
        </div>

        {/* View Mode Filter Tabs */}
        <div className="flex items-center justify-between border-t border-slate-800/70 pt-2.5 text-xs">
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="filter-all-junctions"
            >
              All Highway Landmarks &amp; Passes ({rawTimelineJunctions.length})
            </button>
            <button
              onClick={() => setFilterMode('interchanges_only')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                filterMode === 'interchanges_only'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="filter-major-interchanges"
            >
              Major Interchanges Only
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:flex items-center space-x-1.5">
            <span>Tip: Click</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-bold">
              + Break
            </span>
            <span>to simulate breakfast or charging stops!</span>
          </div>
        </div>
      </div>

      {/* 3. Summary Metric Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Distance</div>
            <div className="text-sm font-black text-white font-display">
              {summary.totalDistanceKm} km
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Drive Duration</div>
            <div className="text-sm font-black text-white font-display">
              {formatDuration(summary.totalDriveMinutes)}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Planned Stops</div>
            <div className="text-sm font-black text-amber-300 font-display">
              {summary.totalBreaksMinutes > 0 ? `${summary.totalBreaksMinutes} mins` : 'None (Direct)'}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Final ETA</div>
            <div className="text-sm font-black text-purple-300 font-display flex items-center space-x-1">
              <span>{summary.finalEta}</span>
              {summary.finalDayOffset > 0 && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-200">
                  +{summary.finalDayOffset}d
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Vertical Timeline Sequence */}
      <div className="relative pl-3 sm:pl-6 space-y-6 pt-2 pb-2">
        {/* Continuous vertical timeline connector line in background */}
        <div className="absolute left-[19px] sm:left-[31px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500 via-cyan-500 to-purple-500 opacity-60 z-0" />

        {visibleJunctions.map((junction, idx) => {
          const isExpanded = Boolean(expandedJunctionIds[junction.id]);
          const isFirst = idx === 0;
          const isLast = idx === visibleJunctions.length - 1;

          // Road status colors for track
          const statusColor =
            junction.roadStatus === 'caution'
              ? 'border-amber-500 text-amber-400'
              : junction.roadStatus === 'obstructed'
              ? 'border-rose-500 text-rose-400'
              : 'border-emerald-500 text-emerald-400';

          return (
            <div
              key={junction.id}
              className="relative z-10 flex items-start space-x-3 sm:space-x-5 group"
              id={`timeline-item-${junction.id}`}
            >
              {/* Left Column: Milestone Node Icon */}
              <div className="shrink-0 flex flex-col items-center">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-lg transition-transform duration-200 group-hover:scale-105 ${
                    isFirst
                      ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20'
                      : isLast
                      ? 'bg-purple-500 text-white ring-4 ring-purple-500/20'
                      : junction.category === 'pass'
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20'
                      : junction.category === 'interchange'
                      ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20'
                      : junction.category === 'dining'
                      ? 'bg-orange-500 text-white ring-4 ring-orange-500/20'
                      : 'bg-slate-900 text-slate-200 border-2 border-slate-700'
                  }`}
                  title={`${junction.categoryLabel}: ${junction.name}`}
                >
                  {isFirst ? (
                    <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : isLast ? (
                    <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : junction.category === 'pass' ? (
                    <Mountain className="w-4 h-4" />
                  ) : junction.category === 'interchange' ? (
                    <Milestone className="w-4 h-4" />
                  ) : junction.category === 'dining' ? (
                    <Utensils className="w-4 h-4" />
                  ) : junction.category === 'bridge' ? (
                    <Navigation className="w-4 h-4 rotate-45" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                </div>

                {/* Road segment distance pill between nodes */}
                {!isLast && (
                  <div className="w-0.5 h-full my-1 flex items-center justify-center">
                    {/* Invisible spacer ensuring alignment */}
                  </div>
                )}
              </div>

              {/* Right Column: Timeline Junction Card */}
              <div
                className={`flex-1 bg-slate-950/75 rounded-2xl border transition duration-200 p-3.5 sm:p-4 hover:border-slate-700 ${
                  isFirst
                    ? 'border-emerald-500/40 shadow-md shadow-emerald-500/5'
                    : isLast
                    ? 'border-purple-500/40 shadow-md shadow-purple-500/5'
                    : junction.category === 'pass'
                    ? 'border-amber-500/30'
                    : junction.category === 'interchange'
                    ? 'border-cyan-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Top Row: ETA + Elapsed Time + Category Tag */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm sm:text-base font-black text-emerald-400 font-display flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{junction.etaFormatted}</span>
                    </span>

                    {junction.dayOffset > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                        +{junction.dayOffset} Day
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium">
                      ({isFirst ? 'Start Point' : `+${formatDuration(junction.cumulativeDriveMinutes)} drive`})
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isFirst
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : isLast
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                          : junction.category === 'pass'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : junction.category === 'interchange'
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {junction.categoryLabel}
                    </span>

                    {junction.highwayCode && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {junction.highwayCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Name + Elevation + Distance Metrics */}
                <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-white flex items-center space-x-1.5">
                      <span>{junction.name}</span>
                      {junction.nepaliName && (
                        <span className="text-xs text-slate-400 font-normal">
                          ({junction.nepaliName})
                        </span>
                      )}
                    </h4>

                    <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2 flex-wrap">
                      {junction.district && (
                        <span>
                          {junction.district}, {junction.province}
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-slate-300 font-medium">
                        Elevation: <strong className="text-purple-300">{junction.elevationM}m</strong>
                      </span>
                      {junction.elevationDeltaM !== 0 && (
                        <span
                          className={`text-[11px] font-bold ${
                            junction.elevationDeltaM > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          ({junction.elevationDeltaM > 0 ? `▲ +${junction.elevationDeltaM}m` : `▼ ${junction.elevationDeltaM}m`})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Distance & Segment Drive */}
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-sm font-black text-slate-200">
                      {junction.distanceFromStartKm} km
                      <span className="text-[11px] text-slate-400 font-normal ml-1">total</span>
                    </div>
                    {!isFirst && (
                      <div className="text-[11px] text-slate-400">
                        +{junction.segmentDistanceKm} km ({junction.segmentDurationMinutes} mins)
                      </div>
                    )}
                  </div>
                </div>

                {/* Planned Rest Stop Banner (if configured) */}
                {junction.plannedStopMinutes > 0 && (
                  <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>Planned Halt: +{junction.plannedStopMinutes} mins break</span>
                      <span className="text-[10px] text-amber-400/80 font-normal">
                        (Cascaded into subsequent ETAs)
                      </span>
                    </div>
                    <button
                      onClick={() => handleSetPlannedStop(junction.id, 0)}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-200 underline"
                      title="Remove this planned stop"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Road Conditions & Caution Warning (if any) */}
                {junction.warning && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{junction.warning}</span>
                  </div>
                )}

                {/* Recommendation Note */}
                {junction.recommendedNote && (
                  <p className="mt-2 text-xs text-slate-300/90 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    💡 <span className="font-semibold text-white">Traveler Note:</span> {junction.recommendedNote}
                  </p>
                )}

                {/* Amenities & Action Buttons Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Available Amenities */}
                  <div className="flex items-center space-x-1 text-slate-400">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                      Services:
                    </span>
                    {junction.amenities.includes('fuel') && (
                      <span
                        className="p-1 rounded bg-slate-800/90 text-amber-400 border border-slate-700"
                        title="Fuel Stations (Petrol & Diesel) Available"
                      >
                        <Fuel className="w-3 h-3" />
                      </span>
                    )}
                    {junction.amenities.includes('ev') && (
                      <span
                        className="p-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        title="EV Fast Charging Available"
                      >
                        <Zap className="w-3 h-3" />
                      </span>
                    )}
                    {junction.amenities.includes('food') && (
                      <span
                        className="p-1 rounded bg-slate-800/90 text-orange-400 border border-slate-700"
                        title="Highway Eateries & Daal-Bhat Stalls"
                      >
                        <Utensils className="w-3 h-3" />
                      </span>
                    )}
                    {junction.amenities.includes('police') && (
                      <span
                        className="p-1 rounded bg-slate-800/90 text-sky-400 border border-slate-700"
                        title="Highway Police Assistance Post"
                      >
                        <ShieldCheck className="w-3 h-3" />
                      </span>
                    )}
                    {junction.amenities.includes('scenic') && (
                      <span
                        className="p-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        title="Scenic Himalayan / River Valley Vista"
                      >
                        <Mountain className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Interactive Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Add Stop Button */}
                    {!isLast && (
                      <div className="flex items-center space-x-1">
                        {junction.plannedStopMinutes === 0 ? (
                          <button
                            onClick={() => handleSetPlannedStop(junction.id, 20)}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center space-x-1 transition"
                            title="Add 20-min Tea/Snack Break"
                          >
                            <Coffee className="w-3 h-3" />
                            <span>+ 20m Break</span>
                          </button>
                        ) : (
                          <div className="flex items-center space-x-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                            <button
                              onClick={() => handleSetPlannedStop(junction.id, Math.max(0, junction.plannedStopMinutes - 10))}
                              className="px-1 text-slate-400 hover:text-white font-bold"
                              title="Decrease 10m"
                            >
                              -
                            </button>
                            <span className="font-bold text-amber-300 px-1">{junction.plannedStopMinutes}m</span>
                            <button
                              onClick={() => handleSetPlannedStop(junction.id, junction.plannedStopMinutes + 10)}
                              className="px-1 text-slate-400 hover:text-white font-bold"
                              title="Increase 10m"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* View on GIS Map */}
                    {onViewOnMap && (
                      <button
                        onClick={() =>
                          onViewOnMap({
                            lat: junction.lat,
                            lng: junction.lng,
                            title: `${junction.name} (${junction.elevationM}m)`,
                            zoom: 13,
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1 transition"
                        title="Focus and inspect this junction on the interactive map"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Map</span>
                      </button>
                    )}

                    {/* Expand Details Toggle */}
                    <button
                      onClick={() => toggleJunctionExpand(junction.id)}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-medium flex items-center space-x-1 transition"
                    >
                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Technical Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-2 bg-slate-900/40 p-2.5 rounded-xl animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Coordinates:</span>
                        <div className="font-mono text-slate-200">
                          {junction.lat.toFixed(4)}°N, {junction.lng.toFixed(4)}°E
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Road Surface:</span>
                        <div className="font-semibold text-slate-200 capitalize">
                          {junction.surface ? junction.surface.replace(/_/g, ' ') : 'Paved Blacktop'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Road Status:</span>
                        <div
                          className={`font-semibold capitalize ${
                            junction.roadStatus === 'caution'
                              ? 'text-amber-400'
                              : junction.roadStatus === 'obstructed'
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {junction.roadStatus || 'Clear / Open'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Calculated using {vehicle.replace('_', ' ')} dynamics with {paceMultiplier}x pace profile.
                      </span>
                      {junction.plannedStopMinutes === 0 && (
                        <div className="flex items-center space-x-1.5 mt-1 sm:mt-0">
                          <span>Add break:</span>
                          <button
                            onClick={() => handleSetPlannedStop(junction.id, 15)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold"
                          >
                            +15m Tea
                          </button>
                          <button
                            onClick={() => handleSetPlannedStop(junction.id, 35)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold"
                          >
                            +35m Meal
                          </button>
                          <button
                            onClick={() => handleSetPlannedStop(junction.id, 45)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold"
                          >
                            +45m EV Fast Charge
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Footer Traveler Directives */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            ETAs automatically adjust when speed multipliers, departure times, or planned rest breaks are modified.
          </span>
        </div>
        <button
          onClick={() => {
            setPlannedStops({});
            setPaceMultiplier(1.0);
          }}
          className="text-slate-400 hover:text-white text-[11px] font-bold underline shrink-0"
        >
          Reset Stops
        </button>
      </div>
    </div>
  );
};
