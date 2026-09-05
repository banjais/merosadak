import { CITIES_AND_JUNCTIONS, NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';
import { CityNode, VehicleType, RoutePlanResult, EmergencyDistressType } from '../types';
import { calculateDirectDistanceKm } from './routeOptimizer';

export interface NearestLandmarkResult {
  city: CityNode;
  distanceKm: number;
  direction: string;
  nearestHighway?: string;
  dorContact?: string;
}

export const NEPAL_EMERGENCY_HOTLINES = [
  { name: 'Nepal Police Emergency', number: '100', tel: 'tel:100', role: 'General Law & Emergency First Responders', badge: '🚔 100' },
  { name: 'Nepal Traffic Police', number: '103', tel: 'tel:103', role: 'Highway Road Rescue & Traffic Obstructions', badge: '🚦 103' },
  { name: 'Tourist Police Nepal', number: '1144', tel: 'tel:1144', role: 'Foreign Travelers & Trekking Route Assistance', badge: '🏔️ 1144' },
  { name: 'Ambulance (Red Cross)', number: '102', tel: 'tel:102', role: 'Immediate Medical & Trauma Evacuation', badge: '🚑 102' },
  { name: 'Armed Police Force (APF)', number: '1114', tel: 'tel:1114', role: 'Disaster Relief & Landslide Search-and-Rescue', badge: '🛡️ 1114' },
  { name: 'Road Department (DoR)', number: '+977-1-4262693', tel: 'tel:+97714262693', role: 'Heavy Machinery, Road Blockage & Bulldozer Dispatch', badge: '🏗️ DoR' },
];

export const DISTRESS_TYPE_CONFIG: Record<
  EmergencyDistressType,
  { label: string; nepaliLabel: string; iconEmoji: string; description: string; priority: 'Critical' | 'Urgent' | 'High' }
> = {
  accident: {
    label: 'Road Accident / Vehicle Collision',
    nepaliLabel: 'सडक दुर्घटना / गाडी ठोक्किएको',
    iconEmoji: '🚨',
    description: 'Collision, rollover, or passenger injury requiring urgent ambulance / police response',
    priority: 'Critical',
  },
  landslide_obstruction: {
    label: 'Landslide / Rockfall / Mudflow Trapped',
    nepaliLabel: 'पहिरो / ढुङ्गा खसेर थुनिएको',
    iconEmoji: '⛰️',
    description: 'Vehicle trapped between active landslide zones or washed-out road section',
    priority: 'Critical',
  },
  medical: {
    label: 'Acute Medical Emergency / Altitude Sickness',
    nepaliLabel: 'आकस्मिक स्वास्थ्य समस्या / लेक लागेको',
    iconEmoji: '🚑',
    description: 'Severe illness, trauma, breathing distress, or acute mountain sickness (AMS)',
    priority: 'Critical',
  },
  offroad_distress: {
    label: 'Vehicle Slipped Off-Road / Cliff Edge Danger',
    nepaliLabel: 'सडकबाट चिप्लिएको / भीरको जोखिम',
    iconEmoji: '🆘',
    description: 'Vehicle hanging off shoulder, deep mud ditch, or risk of rolling down ridge',
    priority: 'Critical',
  },
  vehicle_breakdown: {
    label: 'Mechanical Failure / Engine / Axle / Brake Breakdown',
    nepaliLabel: 'गाडी बिग्रिएको / इन्जिन वा ब्रेक फेल',
    iconEmoji: '🚙',
    description: 'Severe mechanical breakdown in isolated stretch without cellular workshop support',
    priority: 'Urgent',
  },
  ev_battery_or_fuel: {
    label: 'EV Battery Depleted / Out of Fuel on Remote Pass',
    nepaliLabel: 'इभी चार्ज सकिएको / इन्धन रित्तिएको',
    iconEmoji: '⚡',
    description: 'Battery 0% or zero fuel on high-altitude gradient or isolated highway section',
    priority: 'Urgent',
  },
  mountain_weather: {
    label: 'Severe Blizzard / Flash Flood / Torrential Whiteout',
    nepaliLabel: 'हिमपात / बाढी / भारी वर्षामा अलपत्र',
    iconEmoji: '🌨️',
    description: 'Severe weather whiteout, freezing conditions, zero visibility, or river overflow',
    priority: 'Urgent',
  },
  general_rescue: {
    label: 'General Rescue / Stranded Traveler Assistance',
    nepaliLabel: 'अन्य उद्धार तथा सहयोग',
    iconEmoji: '🚩',
    description: 'Lost route, night isolation, wildlife threat, or urgent traveler support',
    priority: 'High',
  },
};

const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: 'Car / Hatchback / Sedan',
  suv_4wd: 'SUV / 4WD Jeep',
  motorbike: 'Motorcycle / Scooter',
  bus_truck: 'Bus / Heavy Truck',
  electric_vehicle: 'Electric Vehicle (EV)',
};

/**
 * Calculates compass direction (e.g. "North-West") from point A to point B
 */
function getCompassDirection(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return 'North';
  if (normalized >= 22.5 && normalized < 67.5) return 'North-East';
  if (normalized >= 67.5 && normalized < 112.5) return 'East';
  if (normalized >= 112.5 && normalized < 157.5) return 'South-East';
  if (normalized >= 157.5 && normalized < 202.5) return 'South';
  if (normalized >= 202.5 && normalized < 247.5) return 'South-West';
  if (normalized >= 247.5 && normalized < 292.5) return 'West';
  return 'North-West';
}

/**
 * Finds the nearest known Nepal city or junction to the user's coordinates
 */
export function findNearestLandmark(lat: number, lng: number): NearestLandmarkResult {
  let nearestCity = CITIES_AND_JUNCTIONS[0];
  let minDistance = Infinity;

  for (const city of CITIES_AND_JUNCTIONS) {
    const dist = calculateDirectDistanceKm(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestCity = city;
    }
  }

  const direction = getCompassDirection(nearestCity.lat, nearestCity.lng, lat, lng);

  // Find nearest highway from connected highways or proximity
  let nearestHwy: string | undefined;
  if (nearestCity.connectedHighways && nearestCity.connectedHighways.length > 0) {
    const hwy = NEPAL_HIGHWAYS.find((h) => nearestCity.connectedHighways.includes(h.code));
    if (hwy) {
      nearestHwy = `${hwy.code} ${hwy.name}`;
    }
  }

  return {
    city: nearestCity,
    distanceKm: Math.round(minDistance * 10) / 10,
    direction,
    nearestHighway: nearestHwy,
    dorContact: 'Traffic Hotline: 103 / Police: 100',
  };
}

/**
 * Formats coordinates for high-clarity emergency broadcast
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latStr = Math.abs(lat).toFixed(5) + (lat >= 0 ? '°N' : '°S');
  const lngStr = Math.abs(lng).toFixed(5) + (lng >= 0 ? '°E' : '°W');
  return `${latStr}, ${lngStr}`;
}

export interface GenerateSosMessageOptions {
  lat: number;
  lng: number;
  accuracyM?: number;
  altitudeM?: number;
  distressType: EmergencyDistressType;
  customNotes?: string;
  vehicleType: VehicleType;
  vehiclePlateNumber?: string;
  passengerCount?: number;
  activeRoute?: RoutePlanResult | null;
  batteryPercent?: number | null;
}

/**
 * Generates full comprehensive Search & Rescue (SAR) message
 */
export function generateFullSosMessage(options: GenerateSosMessageOptions): string {
  const {
    lat,
    lng,
    accuracyM,
    altitudeM,
    distressType,
    customNotes,
    vehicleType,
    vehiclePlateNumber,
    passengerCount = 1,
    activeRoute,
    batteryPercent,
  } = options;

  const now = new Date();
  const timeFormatted = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const distress = DISTRESS_TYPE_CONFIG[distressType];
  const landmark = findNearestLandmark(lat, lng);
  const coordsFormatted = formatCoordinates(lat, lng);
  const mapLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

  let routeInfo = 'Independent / Local Highway Movement';
  if (activeRoute) {
    routeInfo = `${activeRoute.origin.name} ➔ ${activeRoute.destination.name} (${activeRoute.routeName || 'Recommended Corridor'})`;
  }

  const lines = [
    `🚨 *EMERGENCY SOS RESCUE DISPATCH - NEPAL HIGHWAY* 🚨`,
    `⚠️ PRIORITY: ${distress.priority.toUpperCase()} | TIME: ${timeFormatted} NPT`,
    ``,
    `📍 *PRECISE GPS LOCATION / COORDINATES*:`,
    `• Lat/Lng: ${lat.toFixed(5)}, ${lng.toFixed(5)} (${coordsFormatted})`,
    `• Accuracy: ±${accuracyM ? Math.round(accuracyM) : 15} meters${altitudeM ? ` | Alt: ${Math.round(altitudeM)}m ASL` : ''}`,
    `• 🗺️ Live Map Pin: ${mapLink}`,
    ``,
    `🏔️ *NEAREST HIGHWAY LANDMARK*:`,
    `• Location: ~${landmark.distanceKm} km ${landmark.direction} of ${landmark.city.name} (${landmark.city.district} District, ${landmark.city.province} Province)`,
    landmark.nearestHighway ? `• Highway Corridor: ${landmark.nearestHighway}` : '',
    ``,
    `🚙 *VEHICLE & PASSENGER INFORMATION*:`,
    `• Vehicle: ${VEHICLE_LABELS[vehicleType] || vehicleType}`,
    vehiclePlateNumber ? `• Plate/Reg No: ${vehiclePlateNumber.toUpperCase()}` : '',
    `• Persons Onboard: ${passengerCount} passenger${passengerCount > 1 ? 's' : ''}`,
    batteryPercent != null ? `• Device Battery: ${batteryPercent}%` : '',
    ``,
    `🛣️ *ACTIVE ROUTE CORRIDOR*:`,
    `• Route: ${routeInfo}`,
    ``,
    `⚠️ *DISTRESS NATURE & DETAILS*:`,
    `• Category: ${distress.iconEmoji} ${distress.label}`,
    `• Nepali: ${distress.nepaliLabel}`,
    customNotes ? `• Additional Note: ${customNotes}` : '• Additional Note: Immediate roadside assistance requested.',
    ``,
    `📞 *NEPAL HIGHWAY RESCUE HOTLINES*:`,
    `• Police: 100 | Traffic: 103 | Tourist Police: 1144 | Ambulance: 102 | APF Rescue: 1114`,
    `[Generated via Mero Sadak Nepal Highway SOS]`
  ];

  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Generates compact SMS format (<160-300 chars) for weak 2G / SMS emergency transmission
 */
export function generateCompactSms(options: GenerateSosMessageOptions): string {
  const { lat, lng, distressType, customNotes, passengerCount = 1, vehicleType } = options;
  const distress = DISTRESS_TYPE_CONFIG[distressType];
  const landmark = findNearestLandmark(lat, lng);
  const mapLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

  return `SOS NEPAL RESCUE: ${distress.iconEmoji} ${distress.label}. Loc: ${lat.toFixed(5)},${lng.toFixed(5)} (~${landmark.distanceKm}km ${landmark.direction} of ${landmark.city.name}). People: ${passengerCount}. Vehicle: ${vehicleType}. ${customNotes ? `Note: ${customNotes}. ` : ''}Map: ${mapLink} Police:100/103`;
}

/**
 * Audio SOS Siren & High-Frequency Acoustic Alarm Synthesizer using Web Audio API
 */
export type SosAlarmMode = 'high_frequency' | 'morse_sos' | 'two_tone_siren';

class SosAudioBeacon {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentMode: SosAlarmMode = 'high_frequency';
  private timer: number | null = null;
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  private initContext(): AudioContext | null {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  /**
   * Starts high-frequency acoustic alarm (2800 Hz - 3600 Hz piercing mountain acoustic signaling)
   */
  start(mode: SosAlarmMode = 'high_frequency') {
    this.stop();

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      this.isPlaying = true;
      this.currentMode = mode;

      if (mode === 'high_frequency') {
        this.runHighFrequencyAlarm(ctx);
      } else if (mode === 'two_tone_siren') {
        this.runTwoToneSiren(ctx);
      } else {
        this.runMorseSos(ctx);
      }
    } catch (err) {
      console.warn('[SOS Audio Beacon] Web Audio playback error:', err);
    }
  }

  /**
   * Rapid piercing high-frequency acoustic alarm (2.8 kHz to 3.6 kHz sweep)
   * specifically calibrated to penetrate river valleys, monsoon rain, and engine rumble.
   */
  private runHighFrequencyAlarm(ctx: AudioContext) {
    const playWarbleCycle = () => {
      if (!this.isPlaying || !this.ctx || this.ctx.state === 'closed') return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // High-penetration frequency modulation 2800Hz -> 3600Hz -> 2800Hz
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.linearRampToValueAtTime(3600, now + 0.15);
      osc.frequency.linearRampToValueAtTime(2800, now + 0.30);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.setValueAtTime(0.5, now + 0.28);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);

      this.timer = window.setTimeout(playWarbleCycle, 340);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playWarbleCycle());
    } else {
      playWarbleCycle();
    }
  }

  /**
   * Alternating two-tone high-decibel mountain acoustic siren (2400 Hz and 3200 Hz)
   */
  private runTwoToneSiren(ctx: AudioContext) {
    let toggle = false;
    const playTone = () => {
      if (!this.isPlaying || !this.ctx || this.ctx.state === 'closed') return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = toggle ? 3200 : 2400;
      toggle = !toggle;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);

      this.timer = window.setTimeout(playTone, 420);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playTone());
    } else {
      playTone();
    }
  }

  /**
   * Standard Morse Code SOS: ... --- ... (880 Hz / 1200 Hz tone)
   */
  private runMorseSos(ctx: AudioContext) {
    // Morse Code SOS: dot=100ms, dash=300ms
    const pattern = [
      100, 100, 100, 100, 100, 300, // S (...)
      300, 100, 300, 100, 300, 300, // O (---)
      100, 100, 100, 100, 100, 700, // S (...)
    ];

    let step = 0;
    const playNext = () => {
      if (!this.isPlaying || !this.ctx || this.ctx.state === 'closed') return;
      const isSound = step % 2 === 0;
      const duration = pattern[step];

      if (isSound && (ctx.state === 'running' || ctx.state === 'suspended')) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration / 1000);
      }

      step = (step + 1) % pattern.length;
      this.timer = window.setTimeout(playNext, duration);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playNext());
    } else {
      playNext();
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.oscillatorNode) {
      try {
        this.oscillatorNode.stop();
        this.oscillatorNode.disconnect();
      } catch {}
      this.oscillatorNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }

  isActive() {
    return this.isPlaying;
  }

  getMode(): SosAlarmMode {
    return this.currentMode;
  }
}

export const sosAudioBeacon = new SosAudioBeacon();
