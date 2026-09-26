import { CityNode, RoutePlanResult, VehicleType, RoutePreference, RoadIncident, RouteStep, EVCharger, SegmentSafetyData, TerrainFilterOptions, RoadClassificationTier } from '../types';
import { CITIES_AND_JUNCTIONS, NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS } from '../data/nepalHighwaysData';
import { calculateSegmentSafety, calculateRouteSafetyIndex } from './safetyIndexCalculator';
import { preloadRoadGraph, findRoadGraphRoute } from './roadGraphRouter';
import { getVehicleCalcConfig } from './vehicleConfigs';
import { getEffectiveFuelRate } from './fuelPriceService';
import { calculateTollCost, mapVehicleToTollCategory } from './tollRates.client';

export function classifyRoadTier(highwayCode?: string, surface?: string): {
  tier: RoadClassificationTier;
  label: string;
  badge: string;
} {
  const code = (highwayCode || '').trim().toUpperCase();
  if (code.startsWith('NH') || code.startsWith('NNH') || code.startsWith('H')) {
    return {
      tier: 'national_highway',
      label: 'DoR Federal Certified Highway',
      badge: '🛡️ DoR Certified',
    };
  }
  if (code.startsWith('F') || code.startsWith('PRN') || code.includes('FEEDER')) {
    return {
      tier: 'provincial_feeder',
      label: 'Provincial Feeder Corridor (PRN)',
      badge: '🏛️ Provincial PRN',
    };
  }
  if (surface === 'gravel' || surface === 'offroad_mud') {
    return {
      tier: 'community_track',
      label: 'Community Track (OSM / Unpaved)',
      badge: '🌐 Community Track',
    };
  }
  return {
    tier: 'local_palika',
    label: 'Local Palika / Municipal Road',
    badge: '📍 Local Palika',
  };
}

interface GraphEdge {
  fromId: string;
  toId: string;
  distanceKm: number;
  baseTimeMinutes: number;
  highwayCode: string;
  highwayName: string;
  surface: 'asphalt_excellent' | 'blacktopped_fair' | 'gravel' | 'under_construction' | 'offroad_mud';
  status: 'clear' | 'caution' | 'obstructed' | 'closed';
  elevationGain: number;
  intermediateCoords: [number, number][];
}

// Build comprehensive road network graph for Nepal
export const ROAD_NETWORK_EDGES: GraphEdge[] = [
  // KTM to Naubise (NH02 / NH04 entry)
  {
    fromId: 'ktm',
    toId: 'nbz',
    distanceKm: 26,
    baseTimeMinutes: 45,
    highwayCode: 'NH02/NH04',
    highwayName: 'Nagdhunga Corridor',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -480,
    intermediateCoords: [[27.7172, 85.3240], [27.7020, 85.2010], [27.7214, 85.1764]]
  },
  // Naubise to Galchhi (NH04 Prithvi Highway)
  {
    fromId: 'nbz',
    toId: 'gch',
    distanceKm: 26,
    baseTimeMinutes: 45,
    highwayCode: 'NH04',
    highwayName: 'Prithvi Highway (Naubise-Galchhi)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -340,
    intermediateCoords: [[27.7214, 85.1764], [27.7533, 85.0872], [27.8105, 84.9754]]
  },
  // Galchhi to Malekhu (NH04)
  {
    fromId: 'gch',
    toId: 'mlk',
    distanceKm: 22,
    baseTimeMinutes: 33,
    highwayCode: 'NH04',
    highwayName: 'Prithvi Highway (Galchhi-Malekhu)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: -130,
    intermediateCoords: [[27.8105, 84.9754], [27.8286, 84.8912], [27.8228, 84.8155]]
  },
  // Malekhu to Mugling (NH04)
  {
    fromId: 'mlk',
    toId: 'mgl',
    distanceKm: 40,
    baseTimeMinutes: 69,
    highwayCode: 'NH04',
    highwayName: 'Prithvi Highway (Malekhu-Mugling)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -175,
    intermediateCoords: [[27.8228, 84.8155], [27.8423, 84.7155], [27.8617, 84.5542]]
  },
  // Mugling to Damauli (NH04)
  {
    fromId: 'mgl',
    toId: 'dml',
    distanceKm: 84,
    baseTimeMinutes: 135,
    highwayCode: 'NH04',
    highwayName: 'Prithvi Highway (Tanahun)',
    surface: 'under_construction',
    status: 'caution',
    elevationGain: 175,
    intermediateCoords: [[27.8617, 84.5542], [27.9142, 84.4223], [27.9733, 84.2833]]
  },
  // Damauli to Pokhara (NH04)
  {
    fromId: 'dml',
    toId: 'pkr',
    distanceKm: 86,
    baseTimeMinutes: 90,
    highwayCode: 'NH04',
    highwayName: 'Prithvi Highway (Pokhara entry)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 372,
    intermediateCoords: [[27.9733, 84.2833], [28.0833, 84.1432], [28.2096, 83.9856]]
  },
  // Mugling to Narayanghat (NH05)
  {
    fromId: 'mgl',
    toId: 'cht',
    distanceKm: 18,
    baseTimeMinutes: 30,
    highwayCode: 'NH05',
    highwayName: 'Narayanghat-Mugling Road',
    surface: 'asphalt_excellent',
    status: 'caution',
    elevationGain: -67,
    intermediateCoords: [[27.8617, 84.5542], [27.8102, 84.5020], [27.7650, 84.4750], [27.6833, 84.4333]]
  },
  // Mugling to Jalbire (NH05)
  {
    fromId: 'mgl',
    toId: 'jlb',
    distanceKm: 18,
    baseTimeMinutes: 26,
    highwayCode: 'NH05',
    highwayName: 'Narayanghat-Mugling Road',
    surface: 'asphalt_excellent',
    status: 'caution',
    elevationGain: -40,
    intermediateCoords: [[27.8617, 84.5542], [27.8102, 84.502], [27.765, 84.475]]
  },
  // Jalbire to Aaptari (NH05)
  {
    fromId: 'jlb',
    toId: 'apt',
    distanceKm: 18,
    baseTimeMinutes: 20,
    highwayCode: 'NH05',
    highwayName: 'Narayanghat-Mugling Road',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -27,
    intermediateCoords: [[27.765, 84.475], [27.712, 84.451], [27.6833, 84.4333]]
  },
  // Narayanghat to Hetauda (NH01 Mahendra Highway)
  {
    fromId: 'cht',
    toId: 'htd',
    distanceKm: 76,
    baseTimeMinutes: 80,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Chitwan-Makwanpur)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 252,
    intermediateCoords: [[27.6833, 84.4333], [27.5700, 84.7500], [27.4285, 85.0331]]
  },
  // Hetauda to Birgunj (NH02 Tribhuvan Highway)
  {
    fromId: 'htd',
    toId: 'brg',
    distanceKm: 105,
    baseTimeMinutes: 90,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Terai Section)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -370,
    intermediateCoords: [[27.4285, 85.0331], [27.1800, 84.9900], [27.0128, 84.8774]]
  },
  // Naubise to Nagdhunga (NH02/NH04)
  {
    fromId: 'nbz',
    toId: 'ngd',
    distanceKm: 5,
    baseTimeMinutes: 10,
    highwayCode: 'NH02/NH04',
    highwayName: 'Tribhuvan/Prithvi Highway Junction',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 590,
    intermediateCoords: [[27.7214, 85.1764], [27.7000, 85.2000]]
  },
  // Nagdhunga to Tistung (NH02)
  {
    fromId: 'ngd',
    toId: 'tst',
    distanceKm: 25,
    baseTimeMinutes: 45,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Nagdhunga-Tistung)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: 290,
    intermediateCoords: [[27.7000, 85.2000], [27.6800, 85.1500], [27.8167, 85.0667]]
  },
  // Tistung to Daman (NH02)
  {
    fromId: 'tst',
    toId: 'dmn',
    distanceKm: 30,
    baseTimeMinutes: 60,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Tistung-Daman Pass)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: 522,
    intermediateCoords: [[27.8167, 85.0667], [27.7200, 85.0700], [27.6000, 85.0500]]
  },
  // Daman to Hetauda (NH02)
  {
    fromId: 'dmn',
    toId: 'htd',
    distanceKm: 51,
    baseTimeMinutes: 90,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Daman-Hetauda)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: -1862,
    intermediateCoords: [[27.6000, 85.0500], [27.5100, 85.0300], [27.4285, 85.0331]]
  },
  // Narayanghat to Bardaghat via Daunne Pass (NH01)
  {
    fromId: 'cht',
    toId: 'bdg',
    distanceKm: 62,
    baseTimeMinutes: 105,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Narayanghat–Bardaghat / Daunne)',
    surface: 'under_construction',
    status: 'caution',
    elevationGain: 20,
    intermediateCoords: [[27.6833, 84.4333], [27.6000, 84.1500], [27.5549, 83.7921]]
  },
  // Bardaghat to Butwal (NH01)
  {
    fromId: 'bdg',
    toId: 'btl',
    distanceKm: 52,
    baseTimeMinutes: 90,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Bardaghat–Butwal)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -8,
    intermediateCoords: [[27.5549, 83.7921], [27.6200, 83.6000], [27.7006, 83.4484]]
  },
  // Butwal to Bhairahawa / Sunauli (NH10 Siddhartha Highway)
  {
    fromId: 'btl',
    toId: 'bhr',
    distanceKm: 22,
    baseTimeMinutes: 25,
    highwayCode: 'NH10',
    highwayName: 'Siddhartha Highway (6-Lane Corridor)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -115,
    intermediateCoords: [[27.7006, 83.4484], [27.6000, 83.4500], [27.5045, 83.4503]]
  },
  // Butwal to Palpa Tansen (NH10)
  {
    fromId: 'btl',
    toId: 'plp',
    distanceKm: 61,
    baseTimeMinutes: 90,
    highwayCode: 'NH10',
    highwayName: 'Siddhartha Highway (Siddhababa section)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 1130,
    intermediateCoords: [[27.7006, 83.4484], [27.7800, 83.4900], [27.8683, 83.5489]]
  },
  // Palpa Tansen to Pokhara (NH10)
  {
    fromId: 'plp',
    toId: 'pkr',
    distanceKm: 159,
    baseTimeMinutes: 220,
    highwayCode: 'NH10',
    highwayName: 'Siddhartha Highway (Syangja section)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -528,
    intermediateCoords: [[27.8683, 83.5489], [27.9800, 83.7700], [28.2096, 83.9856]]
  },
  // Pokhara to Besisahar (NH25)
  {
    fromId: 'pkr',
    toId: 'bsl',
    distanceKm: 105,
    baseTimeMinutes: 180,
    highwayCode: 'NH25',
    highwayName: 'Mid-Hill Highway (Pokhara-Besisahar)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -62,
    intermediateCoords: [[28.2096, 83.9856], [28.150, 84.050], [28.2333, 84.3667]]
  },
  // Besisahar to Chame (NH25)
  {
    fromId: 'bsl',
    toId: 'chm',
    distanceKm: 70,
    baseTimeMinutes: 150,
    highwayCode: 'NH25',
    highwayName: 'Mid-Hill Highway (Besisahar-Chame/Manang)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: 1940,
    intermediateCoords: [[28.2333, 84.3667], [28.400, 84.250], [28.5833, 84.2167]]
  },
  // Pokhara to Baglung (NH15 Mid-Hill Highway)
  {
    fromId: 'pkr',
    toId: 'bgl',
    distanceKm: 72,
    baseTimeMinutes: 95,
    highwayCode: 'NH15',
    highwayName: 'Mid-Hill Highway (Pokhara-Baglung)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 198,
    intermediateCoords: [[28.2096, 83.9856], [28.2500, 83.7500], [28.2725, 83.6006]]
  },
  // KTM to Dhulikhel (NH03 Araniko)
  {
    fromId: 'ktm',
    toId: 'dhk',
    distanceKm: 30,
    baseTimeMinutes: 40,
    highwayCode: 'NH03',
    highwayName: 'Araniko 6-Lane Expressway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 150,
    intermediateCoords: [[27.7172, 85.3240], [27.6710, 85.4298], [27.6221, 85.5428]]
  },
  // Dhulikhel to Tatopani / Kodari (NH03)
  {
    fromId: 'dhk',
    toId: 'kdr',
    distanceKm: 113,
    baseTimeMinutes: 200,
    highwayCode: 'NH03',
    highwayName: 'Araniko Highway (Bhotekoshi Gorge)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 90,
    intermediateCoords: [[27.6221, 85.5428], [27.6333, 85.7000], [27.9497, 85.9452]]
  },
  // Dhulikhel to Nepalthok (NH13 BP Highway)
  {
    fromId: 'dhk',
    toId: 'npt',
    distanceKm: 50,
    baseTimeMinutes: 71,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Kavre-Sindhuli)',
    surface: 'asphalt_excellent',
    status: 'caution',
    elevationGain: -1030,
    intermediateCoords: [[27.6221, 85.5428], [27.502, 85.67], [27.42, 85.87]]
  },
  // Nepalthok to Bhakundebesi (NH13)
  {
    fromId: 'npt',
    toId: 'bkb',
    distanceKm: 15,
    baseTimeMinutes: 20,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Nepalthok-Bhakundebesi)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 0,
    intermediateCoords: [[27.42, 85.87], [27.450, 85.780], [27.5000, 85.6700]]
  },
  // Bhakundebesi to Khurkot (NH13)
  {
    fromId: 'bkb',
    toId: 'khk',
    distanceKm: 22,
    baseTimeMinutes: 30,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Bhakundebesi-Khurkot)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -50,
    intermediateCoords: [[27.5000, 85.6700], [27.420, 85.820], [27.3333, 86.0167]]
  },
  // Khurkot to Sindhuli Gadhi (NH13)
  {
    fromId: 'khk',
    toId: 'sdh',
    distanceKm: 33,
    baseTimeMinutes: 57,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Kavre-Sindhuli)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 630,
    intermediateCoords: [[27.3333, 86.0167], [27.28, 85.94], [27.2486, 85.9186]]
  },
  // Sindhuli Gadhi to Sindhuli Madi (NH13)
  {
    fromId: 'sdh',
    toId: 'smd',
    distanceKm: 15,
    baseTimeMinutes: 25,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Sindhuli Gadhi-Sindhuli Madi)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -600,
    intermediateCoords: [[27.2486, 85.9186], [27.260, 85.910], [27.2800, 85.9100]]
  },
  // Sindhuli Madi to Bardibas (NH13)
  {
    fromId: 'smd',
    toId: 'brd',
    distanceKm: 25,
    baseTimeMinutes: 35,
    highwayCode: 'NH13',
    highwayName: 'B.P. Koirala Highway (Sindhuli Madi-Bardibas)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -350,
    intermediateCoords: [[27.2800, 85.9100], [27.200, 85.905], [26.9740, 85.9024]]
  },
  // Bardibas to Janakpur (NH01 / Link)
  {
    fromId: 'brd',
    toId: 'jnk',
    distanceKm: 34,
    baseTimeMinutes: 40,
    highwayCode: 'NH01/Link',
    highwayName: 'Bardibas-Janakpur Highway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -76,
    intermediateCoords: [[26.9740, 85.9024], [26.8500, 85.9200], [26.7271, 85.9408]]
  },
  // Bardibas to Hetauda (NH01)
  {
    fromId: 'brd',
    toId: 'htd',
    distanceKm: 130,
    baseTimeMinutes: 130,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Central Terai)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 310,
    intermediateCoords: [[26.9740, 85.9024], [27.0500, 85.3500], [27.4285, 85.0331]]
  },
  // Bardibas to Biratnagar / Dharan (NH01)
  {
    fromId: 'brd',
    toId: 'brt',
    distanceKm: 175,
    baseTimeMinutes: 180,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (East Section & Koshi Barrage)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -78,
    intermediateCoords: [[26.9740, 85.9024], [26.5210, 86.9320], [26.4525, 87.2718]]
  },
  // Biratnagar to Dharan (NH01 / NH08 link)
  {
    fromId: 'brt',
    toId: 'dhr',
    distanceKm: 42,
    baseTimeMinutes: 45,
    highwayCode: 'NH08 Link',
    highwayName: '6-Lane Commercial Highway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 277,
    intermediateCoords: [[26.4525, 87.2718], [26.6650, 87.2780], [26.8124, 87.2834]]
  },
  // Biratnagar to Kakarbhitta (NH01)
  {
    fromId: 'brt',
    toId: 'kkr',
    distanceKm: 62,
    baseTimeMinutes: 75,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Jhapa-Morang 4-lane)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 73,
    intermediateCoords: [[26.4525, 87.2718], [26.6620, 87.8920], [26.6508, 88.1565]]
  },
  // Kakarbhitta to Birtamod (NH01 Mahendra Highway - Eastern Terminus)
  {
    fromId: 'kkr',
    toId: 'btm',
    distanceKm: 22,
    baseTimeMinutes: 30,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Kakarbhitta-Birtamod)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -45,
    intermediateCoords: [[26.6508, 88.1565], [26.5800, 88.1200], [26.4833, 88.0833]]
  },
  // Kakarbhitta to Itahari (NH01)
  {
    fromId: 'kkr',
    toId: 'ith',
    distanceKm: 85,
    baseTimeMinutes: 78,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Eastern Terai)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -35,
    intermediateCoords: [[26.6508, 88.1565], [26.662, 87.892], [26.665, 87.278]]
  },
  // Itahari to Bardibas (NH01)
  {
    fromId: 'ith',
    toId: 'brd',
    distanceKm: 165,
    baseTimeMinutes: 171,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Central Terai)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: 40,
    intermediateCoords: [[26.665, 87.278], [26.521, 86.932], [26.974, 85.9024]]
  },
  // Birtamod to Biratnagar (NH01)
  {
    fromId: 'btm',
    toId: 'brt',
    distanceKm: 108,
    baseTimeMinutes: 120,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Jhapa-Morang 4-lane)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -28,
    intermediateCoords: [[26.4833, 88.0833], [26.4700, 87.6500], [26.4525, 87.2718]]
  },
  // Kakarbhitta to Bhadrapur (NH01)
  {
    fromId: 'kkr',
    toId: 'bhp',
    distanceKm: 35,
    baseTimeMinutes: 40,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Kakarbhitta-Bhadrapur)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -44,
    intermediateCoords: [[26.6508, 88.1565], [26.6000, 88.1000], [26.5333, 88.0833]]
  },
  // Bhadrapur to Birtamod (NH01)
  {
    fromId: 'bhp',
    toId: 'btm',
    distanceKm: 25,
    baseTimeMinutes: 30,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Bhadrapur-Birtamod)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -1,
    intermediateCoords: [[26.5333, 88.0833], [26.5000, 88.0833], [26.4833, 88.0833]]
  },
  // Kakarbhitta to Damak (NH01)
  {
    fromId: 'kkr',
    toId: 'dmk',
    distanceKm: 42,
    baseTimeMinutes: 45,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Kakarbhitta-Damak)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -35,
    intermediateCoords: [[26.6508, 88.1565], [26.6600, 87.9500], [26.8667, 87.7000]]
  },
  // Damak to Itahari (NH01)
  {
    fromId: 'dmk',
    toId: 'ith',
    distanceKm: 43,
    baseTimeMinutes: 50,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Damak-Itahari)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 0,
    intermediateCoords: [[26.8667, 87.7000], [26.7800, 87.4500], [26.665, 87.278]]
  },
  // Itahari to Lahan (NH01)
  {
    fromId: 'ith',
    toId: 'lhn',
    distanceKm: 75,
    baseTimeMinutes: 85,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Itahari-Lahan)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 0,
    intermediateCoords: [[26.665, 87.278], [26.620, 86.850], [26.7333, 86.4833]]
  },
  // Lahan to Bardibas (NH01)
  {
    fromId: 'lhn',
    toId: 'brd',
    distanceKm: 90,
    baseTimeMinutes: 100,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Lahan-Bardibas)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 40,
    intermediateCoords: [[26.7333, 86.4833], [26.850, 86.100], [26.974, 85.9024]]
  },
  // Bardibas to Pathlaiya (NH01)
  {
    fromId: 'brd',
    toId: 'ptl',
    distanceKm: 120,
    baseTimeMinutes: 130,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Bardibas-Pathlaiya)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -60,
    intermediateCoords: [[26.974, 85.9024], [27.050, 85.350], [27.0167, 84.9500]]
  },
  // Pathlaiya to Hetauda (NH01 / NH02 link)
  {
    fromId: 'ptl',
    toId: 'htd',
    distanceKm: 55,
    baseTimeMinutes: 60,
    highwayCode: 'NH01/NH02',
    highwayName: 'Pathlaiya-Hetauda Link',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 410,
    intermediateCoords: [[27.0167, 84.9500], [27.200, 85.000], [27.4285, 85.0331]]
  },
  // Hetauda to Amlekhgunj (NH02)
  {
    fromId: 'htd',
    toId: 'amg',
    distanceKm: 35,
    baseTimeMinutes: 40,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Hetauda-Amlekhgunj)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -260,
    intermediateCoords: [[27.4285, 85.0331], [27.300, 84.950], [27.4167, 84.9833]]
  },
  // Amlekhgunj to Pathlaiya (NH02)
  {
    fromId: 'amg',
    toId: 'ptl',
    distanceKm: 20,
    baseTimeMinutes: 25,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Amlekhgunj-Pathlaiya)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 10,
    intermediateCoords: [[27.4167, 84.9833], [27.300, 84.950], [27.0167, 84.9500]]
  },
  // Pathlaiya to Birgunj (NH02)
  {
    fromId: 'ptl',
    toId: 'brg',
    distanceKm: 30,
    baseTimeMinutes: 35,
    highwayCode: 'NH02',
    highwayName: 'Tribhuvan Highway (Pathlaiya-Birgunj)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -10,
    intermediateCoords: [[27.0167, 84.9500], [27.050, 84.920], [27.0128, 84.8774]]
  },
  // Kohalpur to Attariya (NH01)
  {
    fromId: 'npg',
    toId: 'atr',
    distanceKm: 150,
    baseTimeMinutes: 140,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Kohalpur-Attariya)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 40,
    intermediateCoords: [[28.1900, 81.6900], [28.500, 81.000], [28.8833, 80.1500]]
  },
  // Attariya to Dhangadhi (NH01)
  {
    fromId: 'atr',
    toId: 'dhg',
    distanceKm: 67,
    baseTimeMinutes: 70,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Attariya-Dhangadhi)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -41,
    intermediateCoords: [[28.8833, 80.1500], [28.800, 80.300], [28.6946, 80.5977]]
  },
  // Attariya to Mahendranagar (NH01)
  {
    fromId: 'atr',
    toId: 'mhn',
    distanceKm: 150,
    baseTimeMinutes: 140,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Attariya-Mahendranagar)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 8,
    intermediateCoords: [[28.8833, 80.1500], [28.900, 80.000], [28.9667, 80.1833]]
  },
  // Kakarbhitta to Ilam (NH09 Mechi Highway)
  {
    fromId: 'kkr',
    toId: 'ilm',
    distanceKm: 82,
    baseTimeMinutes: 140,
    highwayCode: 'NH09',
    highwayName: 'Mechi Highway (Tea Garden Hill Climb)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 1063,
    intermediateCoords: [[26.6508, 88.1565], [26.7800, 87.9800], [26.9117, 87.9275]]
  },
  // Butwal to Nepalgunj (NH01)
  {
    fromId: 'btl',
    toId: 'npg',
    distanceKm: 240,
    baseTimeMinutes: 215,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Kapilvastu-Banke)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -70,
    intermediateCoords: [[27.7006, 83.4484], [27.7200, 82.8500], [28.0500, 81.6167]]
  },
  // Nepalgunj to Surkhet (NH12 Ratna Highway)
  {
    fromId: 'npg',
    toId: 'srk',
    distanceKm: 113,
    baseTimeMinutes: 140,
    highwayCode: 'NH12',
    highwayName: 'Ratna Highway (Kohalpur-Birendranagar)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 510,
    intermediateCoords: [[28.0500, 81.6167], [28.1900, 81.6900], [28.5997, 81.6334]]
  },
  // Surkhet to Jumla (NH06 Karnali Highway)
  {
    fromId: 'srk',
    toId: 'jml',
    distanceKm: 232,
    baseTimeMinutes: 460,
    highwayCode: 'NH06',
    highwayName: 'Karnali Highway (Mountain Gorge Road)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 1854,
    intermediateCoords: [[28.5997, 81.6334], [29.1400, 81.6000], [29.2747, 82.1838]]
  },
  // Nepalgunj to Dhangadhi (NH01)
  {
    fromId: 'npg',
    toId: 'dhg',
    distanceKm: 165,
    baseTimeMinutes: 145,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Chisapani Karnali Bridge)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -41,
    intermediateCoords: [[28.0500, 81.6167], [28.6400, 81.2800], [28.6946, 80.5977]]
  },
  // Dhangadhi to Mahendranagar (NH01)
  {
    fromId: 'dhg',
    toId: 'mhn',
    distanceKm: 217,
    baseTimeMinutes: 210,
    highwayCode: 'NH01',
    highwayName: 'Mahendra Highway (Far Western Terminus)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 89,
    intermediateCoords: [[28.6946, 80.5977], [28.8500, 80.3500], [28.9667, 80.1833]]
  },
  // Ilam to Dhankuta (NH08)
  {
    fromId: 'ilm',
    toId: 'dht',
    distanceKm: 120,
    baseTimeMinutes: 200,
    highwayCode: 'NH08',
    highwayName: 'Koshi Highway (Ilam-Dhankuta)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -59,
    intermediateCoords: [[26.9117, 87.9275], [26.850, 87.650], [26.9833, 87.3500]]
  },
  // Dhankuta to Dharan (NH08)
  {
    fromId: 'dht',
    toId: 'dhr',
    distanceKm: 45,
    baseTimeMinutes: 60,
    highwayCode: 'NH08',
    highwayName: 'Koshi Highway (Dhankuta-Dharan)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -801,
    intermediateCoords: [[26.9833, 87.3500], [26.900, 87.300], [26.8124, 87.2834]]
  },
  // Biratnagar to Dhankuta (NH08 link)
  {
    fromId: 'brt',
    toId: 'dht',
    distanceKm: 95,
    baseTimeMinutes: 120,
    highwayCode: 'NH08',
    highwayName: 'Koshi Highway (Biratnagar-Dhankuta)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: 878,
    intermediateCoords: [[26.4525, 87.2718], [26.700, 87.300], [26.9833, 87.3500]]
  },
  // Surkhet to Jajarkot (NH06) - intermediate
  {
    fromId: 'srk',
    toId: 'jjk',
    distanceKm: 130,
    baseTimeMinutes: 260,
    highwayCode: 'NH06',
    highwayName: 'Karnali Highway (Surkhet-Jajarkot)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 740,
    intermediateCoords: [[28.5997, 81.6334], [28.900, 81.600], [28.7000, 82.2000]]
  },
  // Jajarkot to Jumla (NH06)
  {
    fromId: 'jjk',
    toId: 'jml',
    distanceKm: 102,
    baseTimeMinutes: 200,
    highwayCode: 'NH06',
    highwayName: 'Karnali Highway (Jajarkot-Jumla)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: 1114,
    intermediateCoords: [[28.7000, 82.2000], [29.000, 81.800], [29.2747, 82.1838]]
  },
  // Baglung to Jajarkot (NH15 Mid-Hill)
  {
    fromId: 'bgl',
    toId: 'jjk',
    distanceKm: 150,
    baseTimeMinutes: 300,
    highwayCode: 'NH15',
    highwayName: 'Mid-Hill Highway (Baglung-Jajarkot)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: 380,
    intermediateCoords: [[28.2725, 83.6006], [28.400, 83.000], [28.7000, 82.2000]]
  },
  // Nepalgunj to Gulariya (NH59)
  {
    fromId: 'npg',
    toId: 'gly',
    distanceKm: 45,
    baseTimeMinutes: 50,
    highwayCode: 'NH59',
    highwayName: 'Bardiya Highway (Nepalgunj-Gulariya)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 0,
    intermediateCoords: [[28.0500, 81.6167], [28.150, 81.400], [28.2167, 81.3333]]
  },
  // Gulariya to Lamki (NH62)
  {
    fromId: 'gly',
    toId: 'lmk',
    distanceKm: 70,
    baseTimeMinutes: 80,
    highwayCode: 'NH62',
    highwayName: 'Karnali Corridor (Gulariya-Lamki)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 40,
    intermediateCoords: [[28.2167, 81.3333], [28.500, 81.400], [28.8833, 81.6167]]
  },
  // Lamki to Lodeghat (NH62)
  {
    fromId: 'lmk',
    toId: 'lgt',
    distanceKm: 50,
    baseTimeMinutes: 70,
    highwayCode: 'NH62',
    highwayName: 'Karnali Corridor (Lamki-Lodeghat)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 613,
    intermediateCoords: [[28.8833, 81.6167], [28.950, 81.500], [29.0500, 81.3833]]
  },
  // Lodeghat to Dipayal (NH65)
  {
    fromId: 'lgt',
    toId: 'dpl',
    distanceKm: 80,
    baseTimeMinutes: 120,
    highwayCode: 'NH65',
    highwayName: 'Seti Highway (Lodeghat-Dipayal)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: -620,
    intermediateCoords: [[29.0500, 81.3833], [28.900, 81.100], [28.7167, 80.9167]]
  },
  // Ghorahi to Pyuthan (NH19/NH55)
  {
    fromId: 'ghr',
    toId: 'pyt',
    distanceKm: 45,
    baseTimeMinutes: 70,
    highwayCode: 'NH19',
    highwayName: 'Rapti Highway (Ghorahi-Pyuthan)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 600,
    intermediateCoords: [[28.2500, 82.4833], [28.180, 82.650], [28.0833, 82.8500]]
  },
  // Pyuthan to Sandhikharka (NH51)
  {
    fromId: 'pyt',
    toId: 'sdk',
    distanceKm: 60,
    baseTimeMinutes: 100,
    highwayCode: 'NH51',
    highwayName: 'Arghakhanchi Highway (Pyuthan-Sandhikharka)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: 300,
    intermediateCoords: [[28.0833, 82.8500], [28.050, 83.000], [28.0000, 83.0333]]
  },
  // Butwal to Ghorahi (NH55)
  {
    fromId: 'btl',
    toId: 'ghr',
    distanceKm: 120,
    baseTimeMinutes: 180,
    highwayCode: 'NH55',
    highwayName: 'Rapti Highway (Butwal-Ghorahi)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 480,
    intermediateCoords: [[27.7006, 83.4484], [27.900, 83.000], [28.2500, 82.4833]]
  },
  // Butwal to Khunuwa (NH50)
  {
    fromId: 'btl',
    toId: 'khn',
    distanceKm: 85,
    baseTimeMinutes: 120,
    highwayCode: 'NH50',
    highwayName: 'Kapilvastu Highway (Butwal-Khunuwa)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -40,
    intermediateCoords: [[27.7006, 83.4484], [27.600, 83.100], [27.4167, 82.8667]]
  },
  // Hetauda to Janakpur (NH01/NH30 link) - Janakpur
  {
    fromId: 'htd',
    toId: 'jnp',
    distanceKm: 110,
    baseTimeMinutes: 130,
    highwayCode: 'NH30',
    highwayName: 'Fast Track / BP Link (Hetauda-Janakpur)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -386,
    intermediateCoords: [[27.4285, 85.0331], [27.000, 85.500], [26.7200, 85.9200]]
  },
  // Janakpur to Rajbiraj (NH14/NH22)
  {
    fromId: 'jnp',
    toId: 'rbj',
    distanceKm: 60,
    baseTimeMinutes: 80,
    highwayCode: 'NH14',
    highwayName: 'Sagarmatha Highway (Janakpur-Rajbiraj)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 4,
    intermediateCoords: [[26.7200, 85.9200], [26.650, 86.300], [26.5333, 86.7333]]
  },
  // Dhulikhel to Chautara (NH31)
  {
    fromId: 'dhk',
    toId: 'ctr',
    distanceKm: 35,
    baseTimeMinutes: 60,
    highwayCode: 'NH31',
    highwayName: 'Indrawati Corridor (Dhulikhel-Chautara)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -50,
    intermediateCoords: [[27.6221, 85.5428], [27.750, 85.600], [27.8667, 85.7000]]
  },
  // Dhulikhel to Bidur (NH40)
  {
    fromId: 'dhk',
    toId: 'bid',
    distanceKm: 30,
    baseTimeMinutes: 50,
    highwayCode: 'NH40',
    highwayName: 'Trishuli Corridor (Dhulikhel-Bidur/Nuwakot)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -450,
    intermediateCoords: [[27.6221, 85.5428], [27.750, 85.400], [27.8833, 85.3167]]
  },
  // Dunai to Jumla (NH57)
  {
    fromId: 'dun',
    toId: 'jml',
    distanceKm: 120,
    baseTimeMinutes: 240,
    highwayCode: 'NH57',
    highwayName: 'Dolpa Highway (Dunai-Jumla)',
    surface: 'gravel',
    status: 'caution',
    elevationGain: -514,
    intermediateCoords: [[29.2500, 82.4000], [29.200, 82.300], [29.2747, 82.1838]]
  },
  // Arungkhola to Pathlaiya (NH68)
  {
    fromId: 'ark',
    toId: 'ptl',
    distanceKm: 35,
    baseTimeMinutes: 45,
    highwayCode: 'NH68',
    highwayName: 'Bara Corridor (Arungkhola-Pathlaiya)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: -100,
    intermediateCoords: [[27.7167, 84.1167], [27.500, 84.500], [27.0167, 84.9500]]
  }
];

// ==========================================
// REAL ROAD GEOMETRY OVERRIDE
// ==========================================
// ROAD_NETWORK_EDGES above was hand-estimated (straight-ish 3-5 point lines,
// rounded km). Once the real DoR highway network graph (built from the actual
// survey link geometry in public/data/highway/*.geojson by
// scripts/build-road-graph.cjs) has loaded, replace each edge's distance and
// path with the real on-highway distance and coordinate path, so the map
// draws the actual road and trip planning uses real road-km instead of an
// estimate. Road status/surface/elevation stay as curated (the raw survey
// data doesn't carry live condition info).
let realRoadDataApplied = false;
function applyRealRoadDataToEdges(): void {
  if (realRoadDataApplied) return;
  let updated = 0;
  let skippedAsImplausible = 0;
  for (const edge of ROAD_NETWORK_EDGES) {
    const real = findRoadGraphRoute(edge.fromId, edge.toId);
    if (!real || real.pathCoordinates.length < 2) continue;

    // Sanity guard: the source highway link data has real coverage gaps, which
    // occasionally forces the pathfinder into an absurd long detour instead of
    // the true short local road. If the real-graph distance is wildly larger
    // than the curated estimate, that's a data-gap artifact, not a real route
    // — keep the curated estimate for that edge rather than replace it with a
    // broken one.
    const oldDistanceKm = edge.distanceKm;
    if (oldDistanceKm > 0 && real.distanceKm > oldDistanceKm * 2.5) {
      skippedAsImplausible++;
      continue;
    }

    edge.distanceKm = real.distanceKm;
    edge.intermediateCoords = real.pathCoordinates;
    if (oldDistanceKm > 0) {
      edge.baseTimeMinutes = Math.round(edge.baseTimeMinutes * (real.distanceKm / oldDistanceKm));
    }
    updated++;
  }
  realRoadDataApplied = true;
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info(`[roadGraph] Applied real highway geometry to ${updated}/${ROAD_NETWORK_EDGES.length} route edges (${skippedAsImplausible} skipped as implausible detours, kept curated estimate)`);
  }
}

if (typeof window !== 'undefined') {
  preloadRoadGraph().then((g) => {
    if (g) applyRealRoadDataToEdges();
  });
}

// Helper to calculate cost and fuel - uses shared vehicleConfigs.ts

// Distance matrix calculator between any two cities
export function calculateDirectDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function findFastestRouteDistanceKm(originId: string, destinationId: string): number | null {
  if (originId === destinationId) return null;

  const route = findRouteByPreference(originId, destinationId, 'fastest', 'car');
  if (route) return route.totalDistanceKm;

  const realRoute = findRoadGraphRoute(originId, destinationId);
  if (realRoute) return realRoute.distanceKm;

  const origin = CITIES_AND_JUNCTIONS.find((city) => city.id === originId);
  const destination = CITIES_AND_JUNCTIONS.find((city) => city.id === destinationId);
  if (!origin || !destination) return null;

  return calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
}

function buildAerialRouteResult(
  origin: CityNode,
  destination: CityNode,
  preference: RoutePreference,
  vehicle: VehicleType
): RoutePlanResult {
  const aerialKm = calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const vehicleConfig = getVehicleCalcConfig(vehicle);
  const estimatedMinutes = Math.round((aerialKm / (vehicleConfig.mileageKmPerUnit * 0.6)) * 60);
  const fuelLiters = Math.round((aerialKm / vehicleConfig.mileageKmPerUnit) * 10) / 10;

  return {
    id: `aerial-${origin.id}-${destination.id}-${preference}-${vehicle}`,
    origin,
    destination,
    preference,
    vehicle,
    routeName: 'Aerial Distance Approximation',
    routeBadge: '📐 Approximate',
    routeColor: '#94a3b8',
    viaHighlights: 'No DoR highway corridor coverage',
    totalDistanceKm: aerialKm,
    aerialDistanceKm: aerialKm,
    circuityFactor: 1.0,
    roadTierBreakdown: {
      highwayKm: 0,
      provincialKm: 0,
      localKm: 0,
      communityKm: aerialKm,
      certifiedPercent: 0
    },
    estimatedTimeMinutes: estimatedMinutes,
    roadConditionScore: 0,
    safetyIndex: {
      overallScore: 0,
      safetyTier: 'moderate',
      tierLabel: 'Unknown',
      color: '#94a3b8',
      roadQualityAverage: 0,
      accidentRiskSummary: { safeKm: 0, moderateKm: 0, elevatedRiskKm: 0, highHazardKm: 0, safePercentage: 0 },
      totalHistoricalAnnualAccidents: 0,
      activeBlackspots: [],
      segmentBreakdown: [],
      keySafetyDirectives: ['No DoR highway data available for this pair. Use aerial distance only for rough reference.']
    },
    statusSummary: { clearKm: 0, cautionKm: 0, obstructedKm: 0 },
    fuelEstimate: {
      liters: fuelLiters,
      costNpr: Math.round(fuelLiters * getEffectiveFuelRate(vehicle)),
      avgMileageKmPerLiter: vehicleConfig.mileageKmPerUnit
    },
    evEstimate: {
      kwhRequired: Math.round((aerialKm / 6.2) * 10) / 10,
      recommendedChargingStops: [],
      batteryUsagePercent: Math.round(((aerialKm / 6.2) / 50) * 100)
    },
    totalTollCostNpr: 0,
    elevationGainM: Math.abs(destination.elevationM - origin.elevationM),
    maxElevationM: Math.max(origin.elevationM, destination.elevationM),
    incidentsOnRoute: [],
    steps: [{
      instruction: `Straight-line aerial path from ${origin.name} to ${destination.name} (no DoR highway route available)`,
      highwayCode: 'AERIAL',
      distanceKm: aerialKm,
      durationMinutes: estimatedMinutes,
      roadStatus: 'clear',
      surface: 'asphalt_excellent',
      roadClassification: 'community_track',
      certificationBadge: '📐 Aerial Approx'
    }],
    pathCoordinates: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
    dataSource: 'Aerial Distance Estimation',
    dataProvenance: {
      source: 'Direct Geodesic Line-of-Sight Calculation',
      version: 'Great Circle Haversine (Aerial)',
      updatedAt: 'Real-time',
      certifiedAuthority: 'Aerial Geometry (No DoR Corridor)'
    },
    corridorsTraversed: 'None — no Department of Roads highway corridor covers this origin-destination pair'
  };
}

// Builds a route result for a city pair that has no curated ROAD_NETWORK_EDGES
// path, but IS reachable via the real DoR highway network graph. Distance and
// the drawn path come straight from actual highway geometry; live condition
// data (status/surface/hazards) isn't available for this pair since it falls
// outside the curated network, so those fields stay honestly neutral.
function buildRoadGraphRouteResult(
  origin: CityNode,
  destination: CityNode,
  preference: RoutePreference,
  vehicle: VehicleType
): RoutePlanResult | null {
  const real = findRoadGraphRoute(origin.id, destination.id);
  if (!real || real.pathCoordinates.length < 2) return null;

  const aerialKm = Math.round(calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) * 10) / 10;
  const vehicleConfig = getVehicleCalcConfig(vehicle);
  const estimatedMinutes = Math.round((real.distanceKm / (vehicleConfig.mileageKmPerUnit * 0.6)) * 60);
  const fuelLiters = Math.round((real.distanceKm / vehicleConfig.mileageKmPerUnit) * 10) / 10;
  const highwaysLabel = real.highwaysUsed.filter((h) => h && h !== 'undefined').join(' → ') || 'Local road network';

  const circuityFactor = aerialKm > 0 ? Math.round((real.distanceKm / aerialKm) * 100) / 100 : 1.0;

  return {
    id: `roadgraph-${origin.id}-${destination.id}-${preference}-${vehicle}`,
    origin,
    destination,
    preference,
    vehicle,
    routeName: 'Highway Route (real road distance)',
    routeBadge: '🛣️ DoR Network',
    routeColor: '#64748b',
    viaHighlights: highwaysLabel,
    totalDistanceKm: real.distanceKm,
    aerialDistanceKm: aerialKm,
    circuityFactor,
    roadTierBreakdown: {
      highwayKm: real.distanceKm,
      provincialKm: 0,
      localKm: 0,
      communityKm: 0,
      certifiedPercent: 100
    },
    estimatedTimeMinutes: estimatedMinutes,
    roadConditionScore: 0,
    safetyIndex: {
      overallScore: 0,
      safetyTier: 'moderate',
      tierLabel: 'Unknown',
      color: '#94a3b8',
      roadQualityAverage: 0,
      accidentRiskSummary: { safeKm: 0, moderateKm: 0, elevatedRiskKm: 0, highHazardKm: 0, safePercentage: 0 },
      totalHistoricalAnnualAccidents: 0,
      activeBlackspots: [],
      segmentBreakdown: [],
      keySafetyDirectives: ['This pair falls outside the curated highway-condition network; distance and path follow the real road, but live status/hazard data is not available for it yet.']
    },
    statusSummary: { clearKm: 0, cautionKm: 0, obstructedKm: 0 },
    fuelEstimate: {
      liters: fuelLiters,
      costNpr: Math.round(fuelLiters * getEffectiveFuelRate(vehicle)),
      avgMileageKmPerLiter: vehicleConfig.mileageKmPerUnit
    },
    evEstimate: {
      kwhRequired: Math.round((real.distanceKm / 6.2) * 10) / 10,
      recommendedChargingStops: [],
      batteryUsagePercent: Math.round(((real.distanceKm / 6.2) / 50) * 100)
    },
    totalTollCostNpr: 0,
    elevationGainM: Math.abs(destination.elevationM - origin.elevationM),
    maxElevationM: Math.max(origin.elevationM, destination.elevationM),
    incidentsOnRoute: [],
    steps: [{
      instruction: `Follow ${highwaysLabel} from ${origin.name} to ${destination.name}`,
      highwayCode: real.highwaysUsed[0] || 'NH',
      distanceKm: real.distanceKm,
      durationMinutes: estimatedMinutes,
      roadStatus: 'clear',
      surface: 'blacktopped_fair',
      roadClassification: 'national_highway',
      certificationBadge: '🛡️ DoR Certified'
    }],
    pathCoordinates: real.pathCoordinates,
    dataSource: 'Department of Roads, Nepal (Surveyed Network)',
    dataProvenance: {
      source: 'Department of Roads (DoR Nepal) GIS Survey',
      version: 'DoR Official Gazette Network (NH01–NH80)',
      updatedAt: '2026-03-01',
      certifiedAuthority: 'Federal Ministry of Physical Infrastructure & Transport'
    },
    corridorsTraversed: highwaysLabel
  };
}

// Helper to determine scenic rating (1 - 5) based on highway codes traversed
function calculateRouteScenicRating(highwayCodes: string[]): number {
  let score = 3.6;
  const codeStr = highwayCodes.join(' ');
  if (codeStr.includes('NH13')) score = Math.max(score, 4.9); // BP Highway
  if (codeStr.includes('NH09')) score = Math.max(score, 4.8); // Mechi Tea Gardens
  if (codeStr.includes('NH02') && highwayCodes.some(c => c.includes('NH02'))) score = Math.max(score, 4.7); // Daman pass
  if (codeStr.includes('NH10')) score = Math.max(score, 4.7); // Siddhartha Hwy
  if (codeStr.includes('NH15')) score = Math.max(score, 4.7); // Mid-Hill Hwy
  if (codeStr.includes('NH06')) score = Math.max(score, 4.6); // Karnali
  if (codeStr.includes('NH03')) score = Math.max(score, 4.5); // Araniko gorge
  if (codeStr.includes('NH04')) score = Math.max(score, 4.2); // Prithvi Trishuli gorge
  return Math.round(score * 10) / 10;
}

// Single preference Dijkstra route finder with optional edge penalties and terrain filters
export function findRouteByPreference(
  originId: string,
  destinationId: string,
  preference: RoutePreference = 'fastest',
  vehicle: VehicleType = 'car',
  penalizedEdgeIds: Set<string> = new Set<string>(),
  overrideMetadata?: { name?: string; badge?: string; color?: string; viaHighlights?: string },
  terrainFilters: TerrainFilterOptions = {}
): RoutePlanResult | null {
  const origin = CITIES_AND_JUNCTIONS.find((c) => c.id === originId);
  const destination = CITIES_AND_JUNCTIONS.find((c) => c.id === destinationId);

  if (!origin || !destination) return null;
  if (originId === destinationId) return null;

  // Build undirected adjacency list
  interface Neighbor {
    nodeId: string;
    edge: GraphEdge;
    edgeKey: string;
  }
  const adjMap = new Map<string, Neighbor[]>();

  CITIES_AND_JUNCTIONS.forEach((city) => adjMap.set(city.id, []));

  ROAD_NETWORK_EDGES.forEach((edge) => {
    const keyForward = `${edge.fromId}-${edge.toId}`;
    const keyReverse = `${edge.toId}-${edge.fromId}`;
    adjMap.get(edge.fromId)?.push({ nodeId: edge.toId, edge, edgeKey: keyForward });
    adjMap.get(edge.toId)?.push({
      nodeId: edge.fromId,
      edge: {
        ...edge,
        fromId: edge.toId,
        toId: edge.fromId,
        elevationGain: -edge.elevationGain,
        intermediateCoords: [...edge.intermediateCoords].reverse()
      },
      edgeKey: keyReverse
    });
  });

  // Dijkstra search with customized cost function
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: GraphEdge } | null>();
  const visited = new Set<string>();

  CITIES_AND_JUNCTIONS.forEach((city) => {
    distances.set(city.id, Infinity);
    previous.set(city.id, null);
  });

  distances.set(originId, 0);

  while (visited.size < CITIES_AND_JUNCTIONS.length) {
    let minNode: string | null = null;
    let minCost = Infinity;

    for (const [nodeId, cost] of distances.entries()) {
      if (!visited.has(nodeId) && cost < minCost) {
        minCost = cost;
        minNode = nodeId;
      }
    }

    if (!minNode || minCost === Infinity) break;
    if (minNode === destinationId) break;

    visited.add(minNode);

    const neighbors = adjMap.get(minNode) || [];
    for (const { nodeId: nextId, edge, edgeKey } of neighbors) {
      if (visited.has(nextId)) continue;

      let edgeWeight = edge.baseTimeMinutes;

      // Calculate terrain metrics for this edge
      const fromCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId);
      const toCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId);
      const fromElev = fromCityNode?.elevationM ?? 400;
      const toElev = toCityNode?.elevationM ?? 400;
      const peakElevOnEdge = Math.max(fromElev, toElev, fromElev + Math.max(0, edge.elevationGain), toElev + Math.max(0, -edge.elevationGain));
      const slopeGradePct = edge.distanceKm > 0 ? (Math.abs(edge.elevationGain) / (edge.distanceKm * 1000)) * 100 : 0;
      const isPassCorridor = peakElevOnEdge >= 1450 || 
        edge.highwayName.toLowerCase().includes('pass') || 
        edge.highwayName.toLowerCase().includes('daman') || 
        edge.highwayName.toLowerCase().includes('ridge') ||
        (edge.highwayCode.includes('NH02') && edge.distanceKm > 80);

      // When optimizing for shortest distance, weight primarily by km
      if (preference === 'shortest') {
        edgeWeight = edge.distanceKm * 1.5;
        if (edge.status === 'closed') edgeWeight *= 15.0;
      } else {
        // Real road condition penalties
        if (edge.status === 'caution') edgeWeight *= 1.35;
        if (edge.status === 'obstructed') edgeWeight *= 2.5;
        if (edge.status === 'closed') edgeWeight *= 10.0;

        // Road surface adjustments
        if (edge.surface === 'under_construction') edgeWeight *= 1.4;
        if (edge.surface === 'gravel' || edge.surface === 'offroad_mud') {
          edgeWeight *= vehicle === 'suv_4wd' ? 1.2 : 1.8;
        }

        // Preference adjustments
        if (preference === 'safest') {
          if (edge.status !== 'clear') edgeWeight *= 2.5;
          if (edge.surface === 'under_construction') edgeWeight *= 2.8;
          if (edge.surface === 'offroad_mud' || edge.surface === 'gravel') edgeWeight *= 3.0;
        } else if (preference === 'scenic') {
          if (['NH13', 'NH10', 'NH02', 'NH15', 'NH09', 'NH03'].some(c => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.55;
          }
        } else if (preference === 'ev_optimized') {
          if (['NH04', 'NH05', 'NH01', 'NH10'].some(c => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.8;
          }
        }
      }

      // ==========================================
      // TERRAIN-BASED FILTER ADJUSTMENTS
      // ==========================================

      // 1. Avoid High Mountain Passes (Avoid elevations > 1500m & high passes like Daman NH02, Karnali, etc.)
      if (terrainFilters.avoidHighPasses) {
        if (peakElevOnEdge >= 1800 || (isPassCorridor && peakElevOnEdge >= 1400)) {
          edgeWeight *= 14.0 * (peakElevOnEdge / 1300);
        } else if (peakElevOnEdge >= 1400) {
          edgeWeight *= 6.0;
        } else if (peakElevOnEdge >= 1100 && isPassCorridor) {
          edgeWeight *= 3.0;
        }
      }

      // 2. Require Paved Roads (Strict penalty on gravel, unpaved offroad, or active mud/construction)
      if (terrainFilters.requirePavedOnly) {
        if (edge.surface === 'gravel' || edge.surface === 'offroad_mud') {
          edgeWeight *= 30.0;
        } else if (edge.surface === 'under_construction') {
          edgeWeight *= 8.5;
        } else if (edge.surface === 'asphalt_excellent') {
          edgeWeight *= 0.75; // Heavily incentivize smooth asphalt highways
        } else if (edge.surface === 'blacktopped_fair') {
          edgeWeight *= 0.9;
        }
      }

      // 3. Avoid Steep Incline / Mountain Hairpin Climbs (> 5.5% slope gradient)
      if (terrainFilters.avoidSteepGrades) {
        if (slopeGradePct >= 5.5) {
          edgeWeight *= 5.0 * (slopeGradePct / 4.0);
        } else if (slopeGradePct >= 3.8) {
          edgeWeight *= 2.2;
        }
      }

      // 4. Avoid Active Landslide Zones & Major Hazard Corridors
      if (terrainFilters.avoidActiveLandslideZones) {
        if (edge.status === 'caution') {
          edgeWeight *= 4.5;
        } else if (edge.status === 'obstructed') {
          edgeWeight *= 18.0;
        } else if (edge.status === 'closed') {
          edgeWeight *= 60.0;
        }
        const hasLiveIncident = LIVE_ROAD_INCIDENTS.some(inc => 
          (inc.highwayCode === edge.highwayCode || inc.locationName.toLowerCase().includes(edge.highwayName.toLowerCase())) &&
          (inc.type === 'landslide' || inc.type === 'fallen_rocks' || inc.type === 'flood' || inc.severity === 'severe')
        );
        if (hasLiveIncident) {
          edgeWeight *= 5.0;
        }
      }

      // 5. Maximum Altitude Ceiling Limit (if configured)
      if (terrainFilters.maxElevationM && peakElevOnEdge > terrainFilters.maxElevationM) {
        const excessM = peakElevOnEdge - terrainFilters.maxElevationM;
        edgeWeight *= (12.0 + (excessM / 100) * 3.0);
      }

      // Apply penalty if this edge is in the penalized set (for alternative generation)
      if (penalizedEdgeIds.has(edgeKey) || penalizedEdgeIds.has(`${edge.toId}-${edge.fromId}`)) {
        edgeWeight *= 5.0;
      }

      const totalNewCost = distances.get(minNode)! + edgeWeight;
      if (totalNewCost < distances.get(nextId)!) {
        distances.set(nextId, totalNewCost);
        previous.set(nextId, { nodeId: minNode, edge });
      }
    }
  }

  // Reconstruct path
  const edgesOnPath: GraphEdge[] = [];
  let curr = destinationId;

  while (curr !== originId) {
    const prev = previous.get(curr);
    if (!prev) return null; // Path unreachable
    edgesOnPath.unshift(prev.edge);
    curr = prev.nodeId;
  }

  if (edgesOnPath.length === 0) return null;

  // Compile path details
  let totalDistanceKm = 0;
  let totalMinutes = 0;
  let clearKm = 0;
  let cautionKm = 0;
  let obstructedKm = 0;
  let totalElevationGainM = 0;
  let pathCoordinates: [number, number][] = [];
  const steps: RouteStep[] = [];

  const vehicleConfig = getVehicleCalcConfig(vehicle);

  const segmentsSafety: SegmentSafetyData[] = [];

  edgesOnPath.forEach((edge, idx) => {
    totalDistanceKm += edge.distanceKm;

    let segMinutes = edge.baseTimeMinutes / vehicleConfig.speedMultiplier;
    if (edge.status === 'caution') segMinutes *= 1.25;
    if (edge.status === 'obstructed') segMinutes *= 1.8;

    totalMinutes += Math.round(segMinutes);

    if (edge.status === 'clear') clearKm += edge.distanceKm;
    else if (edge.status === 'caution') cautionKm += edge.distanceKm;
    else obstructedKm += edge.distanceKm;

    if (edge.elevationGain > 0) totalElevationGainM += edge.elevationGain;

    if (idx === 0) {
      pathCoordinates.push(...edge.intermediateCoords);
    } else {
      pathCoordinates.push(...edge.intermediateCoords.slice(1));
    }

    const fromCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId)?.name || edge.fromId;
    const toCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId)?.name || edge.toId;

    let warningText: string | undefined;
    if (edge.status === 'caution') {
      warningText = `Caution: Active road widening / single-lane section on ${edge.highwayName}.`;
    }

    const segSafety = calculateSegmentSafety({
      fromId: edge.fromId,
      toId: edge.toId,
      fromName: fromCity,
      toName: toCity,
      highwayCode: edge.highwayCode,
      highwayName: edge.highwayName,
      distanceKm: edge.distanceKm,
      surface: edge.surface,
      status: edge.status,
      elevationGainM: edge.elevationGain,
      coordinates: edge.intermediateCoords,
    });
    segmentsSafety.push(segSafety);

    const tierInfo = classifyRoadTier(edge.highwayCode, edge.surface);

    steps.push({
      instruction: `Follow ${edge.highwayName} (${edge.highwayCode}) from ${fromCity} to ${toCity}`,
      highwayCode: edge.highwayCode,
      distanceKm: edge.distanceKm,
      durationMinutes: Math.round(segMinutes),
      roadStatus: edge.status,
      surface: edge.surface,
      warning: warningText,
      elevationChangeM: edge.elevationGain,
      safetyData: segSafety,
      roadClassification: tierInfo.tier,
      certificationBadge: tierInfo.badge,
    });
  });

  // Calculate Aerial Straight-Line Distance & Circuity Factor
  const aerialDistanceKm = Math.round(calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) * 10) / 10;
  const circuityFactor = aerialDistanceKm > 0 ? Math.round((totalDistanceKm / aerialDistanceKm) * 100) / 100 : 1.0;

  // Road Network Tier Composition
  let highwayKm = 0;
  let provincialKm = 0;
  let localKm = 0;
  let communityKm = 0;
  steps.forEach((s) => {
    if (s.roadClassification === 'national_highway') highwayKm += s.distanceKm;
    else if (s.roadClassification === 'provincial_feeder') provincialKm += s.distanceKm;
    else if (s.roadClassification === 'community_track') communityKm += s.distanceKm;
    else localKm += s.distanceKm;
  });
  const certifiedPercent = totalDistanceKm > 0 ? Math.round((highwayKm / totalDistanceKm) * 100) : 100;
  const roadTierBreakdown = {
    highwayKm: Math.round(highwayKm * 10) / 10,
    provincialKm: Math.round(provincialKm * 10) / 10,
    localKm: Math.round(localKm * 10) / 10,
    communityKm: Math.round(communityKm * 10) / 10,
    certifiedPercent,
  };

  // Calculate Highway Safety Index (0 - 100) & Road Quality Score
  const routeSafetyIndex = calculateRouteSafetyIndex(segmentsSafety, totalDistanceKm);
  const roadConditionScore = routeSafetyIndex.roadQualityAverage;

  // Fuel calculation
  const fuelLiters = Math.round((totalDistanceKm / vehicleConfig.mileageKmPerUnit) * 10) / 10;
  const fuelCostNpr = Math.round(fuelLiters * getEffectiveFuelRate(vehicle));

  // EV Calculations
  const evKwhRequired = Math.round((totalDistanceKm / 6.2) * 10) / 10;
  const recommendedChargers: EVCharger[] = [];

  const highwayCodesOnPath = Array.from(new Set(edgesOnPath.map((e) => e.highwayCode.split('/')[0])));
  NEPAL_HIGHWAYS.forEach((hw) => {
    if (highwayCodesOnPath.some(c => hw.code === c || hw.code.includes(c))) {
      recommendedChargers.push(...hw.evChargers);
    }
  });

  // Toll calculations (using live toll rates from Roads Board Nepal Gazette)
  const tollVehicleCategory = mapVehicleToTollCategory(vehicle);
  const totalTollCost = calculateTollCost(highwayCodesOnPath, tollVehicleCategory);

  const incidentsOnRoute = LIVE_ROAD_INCIDENTS.filter((inc) => highwayCodesOnPath.includes(inc.highwayCode));

  const elevationsOnRoute = [origin.elevationM, destination.elevationM, ...edgesOnPath.map((e) => e.elevationGain + origin.elevationM)];
  const maxElevationM = Math.max(...elevationsOnRoute);

  const scenicRating = calculateRouteScenicRating(highwayCodesOnPath);

  // Via summary description
  const viaHighways = Array.from(new Set(edgesOnPath.map(e => `${e.highwayName} (${e.highwayCode})`))).join(' ➔ ');
  const viaShort = edgesOnPath.length <= 2 
    ? `via ${edgesOnPath.map(e => e.highwayName).join(' & ')}`
    : `via ${edgesOnPath[0].highwayName} & ${edgesOnPath[edgesOnPath.length - 1].highwayName}`;

  // Default naming and color by preference
  let defaultName = 'Express Highway Corridor';
  let defaultBadge = '🚀 Fastest';
  let defaultColor = '#38bdf8'; // sky-400

  if (preference === 'shortest') {
    defaultName = 'Direct Distance Path';
    defaultBadge = '📏 Shortest';
    defaultColor = '#10b981'; // emerald-500
  } else if (preference === 'scenic') {
    defaultName = 'Scenic Mountain & River Vistas';
    defaultBadge = '🏔️ Most Scenic';
    defaultColor = '#a855f7'; // purple-500
  } else if (preference === 'safest') {
    defaultName = 'Paved & Safety-Prioritized';
    defaultBadge = '🛡️ Safest Surface';
    defaultColor = '#f59e0b'; // amber-500
  } else if (preference === 'ev_optimized') {
    defaultName = 'EV Fast-Charging Corridor';
    defaultBadge = '⚡ EV Priority';
    defaultColor = '#06b6d4'; // cyan-500
  }

  // Check if terrain filters are actively applied and update badge/summary if relevant
  const hasActiveTerrainFilters = Boolean(
    terrainFilters.avoidHighPasses || 
    terrainFilters.requirePavedOnly || 
    terrainFilters.avoidSteepGrades || 
    terrainFilters.avoidActiveLandslideZones ||
    terrainFilters.maxElevationM
  );

  return {
    id: `plan-${originId}-${destinationId}-${preference}-${vehicle}-${edgesOnPath.map(e => e.fromId).join('-')}${hasActiveTerrainFilters ? '-filtered' : ''}`,
    origin,
    destination,
    preference,
    vehicle,
    routeName: overrideMetadata?.name || defaultName,
    routeBadge: overrideMetadata?.badge || defaultBadge,
    routeColor: overrideMetadata?.color || defaultColor,
    viaHighlights: overrideMetadata?.viaHighlights || viaShort,
    scenicRating,
    totalDistanceKm,
    aerialDistanceKm,
    circuityFactor,
    roadTierBreakdown,
    estimatedTimeMinutes: totalMinutes,
    roadConditionScore,
    safetyIndex: routeSafetyIndex,
    statusSummary: {
      clearKm,
      cautionKm,
      obstructedKm
    },
    fuelEstimate: {
      liters: fuelLiters,
      costNpr: Math.round(fuelLiters * getEffectiveFuelRate(vehicle)),
      avgMileageKmPerLiter: vehicleConfig.mileageKmPerUnit
    },
    evEstimate: {
      kwhRequired: evKwhRequired,
      recommendedChargingStops: recommendedChargers,
      batteryUsagePercent: Math.round((evKwhRequired / 50) * 100)
    },
    totalTollCostNpr: totalTollCost,
    elevationGainM: totalElevationGainM,
    maxElevationM,
    incidentsOnRoute,
    steps,
    pathCoordinates,
    appliedTerrainFilters: hasActiveTerrainFilters ? terrainFilters : undefined,
    alternateRouteSummary: {
      name: 'Alternative Highway Bypass',
      distanceDiffKm: 0,
      timeDiffMinutes: 0,
      reason: viaHighways
    },
    dataSource: 'Department of Roads, Nepal (NH01–NH80 Network)',
    dataProvenance: {
      source: 'Department of Roads (DoR Nepal) GIS Network',
      version: 'DoR Official Gazette Highway Network (NH01–NH80)',
      updatedAt: '2026-03-01',
      certifiedAuthority: 'Federal Ministry of Physical Infrastructure & Transport'
    },
    corridorsTraversed: viaHighways,
    aiAdvisory: {
      summary: `Travel route between ${origin.name} and ${destination.name} via ${viaShort} is currently ${roadConditionScore > 75 ? 'Optimal' : 'Moderate with caution zones'}. Total distance is ${totalDistanceKm} km with an estimated drive time of ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.${hasActiveTerrainFilters ? ' (Terrain optimization filters active).' : ''}`,
      riskLevel: roadConditionScore > 75 ? 'Low' : roadConditionScore > 50 ? 'Moderate' : 'High',
      keyRecommendations: [
        terrainFilters.avoidHighPasses ? 'Route optimized to avoid high mountain passes (>1500m) and steep ridge summits.' : 'Maintain headlights on during river canyon curves and foggy morning mountain passes.',
        terrainFilters.requirePavedOnly ? 'Route strictly prioritized on blacktopped & asphalt highway surfaces.' : 'Use lower gear (Engine braking) on steep descents instead of riding foot brakes to prevent brake overheating.',
        vehicle === 'electric_vehicle' ? 'Top up battery at high-capacity DC fast charging hubs before ascending steep ghat passes.' : 'Ensure adequate fuel reserve before entering remote mountain segments.'
      ],
      monsoonOrWeatherWarning: 'Monitor DOR Live alerts for sudden rockfall clearances between 11 AM - 3 PM.',
      bestDepartureWindow: '5:30 AM - 7:00 AM (Recommended to beat heavy freight truck queues)',
      emergencyContacts: ['Nepal Traffic Police: 103', 'Emergency Police Hotline: 100', 'Armed Police Force Highway Rescue: 1114', 'Ambulance: 102']
    }
  };
}

// Generates multiple distinct route options (Fastest, Shortest, Scenic, Safest/Alternative) with terrain filters
export function findAllRouteOptions(
  originId: string,
  destinationId: string,
  vehicle: VehicleType = 'car',
  terrainFilters: TerrainFilterOptions = {}
): RoutePlanResult[] {
  const options: RoutePlanResult[] = [];
  const seenEdgeFingerprints = new Set<string>();

  // Helper to generate unique fingerprint of path
  const getFingerprint = (plan: RoutePlanResult) => {
    return plan.steps.map(s => `${s.highwayCode}-${s.distanceKm}`).join('|');
  };

  // 1. Calculate Fastest Route (Default baseline)
  const fastest = findRouteByPreference(originId, destinationId, 'fastest', vehicle, new Set(), {
    name: 'Express Corridor (Fastest)',
    badge: '🚀 Fastest',
    color: '#38bdf8'
  }, terrainFilters);
  if (fastest) {
    options.push(fastest);
    seenEdgeFingerprints.add(getFingerprint(fastest));
  }

  // 2. Calculate Shortest Route
  const shortest = findRouteByPreference(originId, destinationId, 'shortest', vehicle, new Set(), {
    name: 'Direct Distance (Shortest)',
    badge: '📏 Shortest',
    color: '#10b981'
  }, terrainFilters);
  if (shortest) {
    const fp = getFingerprint(shortest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(shortest);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 3. Calculate Most Scenic Route
  const scenic = findRouteByPreference(originId, destinationId, 'scenic', vehicle, new Set(), {
    name: 'Scenic Ridge & Passes',
    badge: '🏔️ Most Scenic',
    color: '#a855f7'
  }, terrainFilters);
  if (scenic) {
    const fp = getFingerprint(scenic);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(scenic);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 4. Calculate Safest / Paved Surface Route
  const safest = findRouteByPreference(originId, destinationId, 'safest', vehicle, new Set(), {
    name: 'Paved & Safety-Prioritized',
    badge: '🛡️ Safest Surface',
    color: '#f59e0b'
  }, terrainFilters);
  if (safest) {
    const fp = getFingerprint(safest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(safest);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 5. If fewer than 2 distinct options were found (e.g. single corridor), compute a penalized alternative
  if (options.length < 2 && fastest) {
    // Penalize the first 2 edges of the fastest route to find an alternative corridor
    const primaryEdgeKeys = new Set<string>();
    fastest.steps.forEach(step => {
      // Find matching edge keys
      ROAD_NETWORK_EDGES.forEach(e => {
        if (step.highwayCode?.includes(e.highwayCode)) {
          primaryEdgeKeys.add(`${e.fromId}-${e.toId}`);
          primaryEdgeKeys.add(`${e.toId}-${e.fromId}`);
        }
      });
    });

    const alternative = findRouteByPreference(originId, destinationId, 'scenic', vehicle, primaryEdgeKeys, {
      name: 'Alternative Highway Bypass',
      badge: '🔄 Alternative',
      color: '#c084fc'
    }, terrainFilters);
    if (alternative) {
      const fp = getFingerprint(alternative);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(alternative);
        seenEdgeFingerprints.add(fp);
      }
    }
  }

  // If vehicle is EV, ensure EV-optimized route is also considered or labelled
  if (vehicle === 'electric_vehicle') {
    const evRoute = findRouteByPreference(originId, destinationId, 'ev_optimized', vehicle, new Set(), {
      name: 'EV Fast-Charging Network',
      badge: '⚡ EV Priority',
      color: '#06b6d4'
    }, terrainFilters);
    if (evRoute) {
      const fp = getFingerprint(evRoute);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(evRoute);
      }
    }
  }

  return options;
}

export function snapToNearestRoutingCity(city: CityNode): CityNode {
  // Prefer exact id match first
  const exact = CITIES_AND_JUNCTIONS.find((c) => c.id === city.id);
  if (exact) return exact;

  // Prefer same-name match (case-insensitive, ignore parenthetical aliases)
  const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
  const cityName = normalize(city.name);
  const byName = CITIES_AND_JUNCTIONS.find((c) => normalize(c.name) === cityName);
  if (byName) return byName;

  // Score candidates: pure distance, with a bonus for shared highway codes
  // so places on the same corridor (e.g. Bardaghat on NH01) prefer Butwal/Narayanghat
  // over a nearby but off-corridor hub (e.g. Bhairahawa on NH10).
  let best = CITIES_AND_JUNCTIONS[0];
  let bestScore = Infinity;
  const cityHighways = new Set((city.connectedHighways || []).map((h) => h.toUpperCase()));
  for (const c of CITIES_AND_JUNCTIONS) {
    const d = calculateDirectDistanceKm(city.lat, city.lng, c.lat, c.lng);
    const shared = (c.connectedHighways || []).some((h) => cityHighways.has(h.toUpperCase()));
    // Shared-corridor candidates get a 35% effective-distance discount
    const score = shared ? d * 0.65 : d;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// Primary route search API with allRouteOptions bundled
export function findOptimizedRoute(
  originId: string,
  destinationId: string,
  preference: RoutePreference = 'fastest',
  vehicle: VehicleType = 'car',
  terrainFilters: TerrainFilterOptions = {},
  originNode?: CityNode,
  destinationNode?: CityNode
): RoutePlanResult | null {
  // Resolve routing graph nodes. User-selected places that are not in the
  // curated junction graph are snapped for pathfinding only — the report must
  // still show the names the user actually picked.
  const routingOriginId = CITIES_AND_JUNCTIONS.some((c) => c.id === originId)
    ? originId
    : originNode
      ? snapToNearestRoutingCity(originNode).id
      : originId;
  const routingDestId = CITIES_AND_JUNCTIONS.some((c) => c.id === destinationId)
    ? destinationId
    : destinationNode
      ? snapToNearestRoutingCity(destinationNode).id
      : destinationId;

  const applyDisplayNodes = (result: RoutePlanResult | null): RoutePlanResult | null => {
    if (!result) return null;
    return {
      ...result,
      origin: originNode || result.origin,
      destination: destinationNode || result.destination,
    };
  };

  const allOptions = findAllRouteOptions(routingOriginId, routingDestId, vehicle, terrainFilters);
  if (allOptions.length === 0) {
    let origin = CITIES_AND_JUNCTIONS.find((c) => c.id === routingOriginId);
    let destination = CITIES_AND_JUNCTIONS.find((c) => c.id === routingDestId);
    if (!origin && originNode && originNode.lat && originNode.lng) {
      origin = snapToNearestRoutingCity(originNode);
    }
    if (!destination && destinationNode && destinationNode.lat && destinationNode.lng) {
      destination = snapToNearestRoutingCity(destinationNode);
    }
    if (origin && destination) {
      return applyDisplayNodes(
        buildRoadGraphRouteResult(origin, destination, preference, vehicle)
          || buildAerialRouteResult(origin, destination, preference, vehicle)
      );
    }
    return null;
  }

  // Find matching option for current preference, or default to fastest
  let selected = allOptions.find(opt => opt.preference === preference);
  if (!selected) {
    selected = findRouteByPreference(routingOriginId, routingDestId, preference, vehicle, new Set(), undefined, terrainFilters) || allOptions[0];
  }

  // Attach all available route options to the result for easy toggling
  return applyDisplayNodes({
    ...selected,
    allRouteOptions: allOptions.map((opt) => ({
      ...opt,
      origin: originNode || opt.origin,
      destination: destinationNode || opt.destination,
    })),
    appliedTerrainFilters: Object.keys(terrainFilters).some(k => (terrainFilters as any)[k]) ? terrainFilters : undefined
  });
}

