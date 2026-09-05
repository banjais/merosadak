import { CorridorTrendData, HourlyTrafficTrend, DayProfileType, TrafficLevel } from '../types';

// Helper to generate 24 hours of travel time trend data based on peak factors
function generate24HourProfile(
  freeFlowMinutes: number,
  distanceKm: number,
  peakHourRanges: { start: number; end: number; multiplier: number; level: TrafficLevel; note: string }[],
  nightDiscount = 0.95
): HourlyTrafficTrend[] {
  const hours: HourlyTrafficTrend[] = [];

  for (let h = 0; h < 24; h++) {
    // Default factor
    let factor = 1.0;
    let level: TrafficLevel = 'smooth';
    let note = 'Free-flowing traffic with minimal slowdowns.';

    // Check night hours (11 PM - 4 AM)
    if (h >= 23 || h <= 4) {
      factor = nightDiscount;
      level = 'smooth';
      note = 'Late night / early morning low-traffic window. Watch for heavy freight trucks.';
    }

    // Check peak matches
    for (const range of peakHourRanges) {
      if (h >= range.start && h <= range.end) {
        // Interpolate or apply peak multiplier
        factor = range.multiplier;
        level = range.level;
        note = range.note;
        break;
      }
    }

    const travelTimeMinutes = Math.round(freeFlowMinutes * factor);
    const delayMinutes = Math.max(0, travelTimeMinutes - freeFlowMinutes);
    const avgSpeedKmh = Math.max(8, Math.round((distanceKm / (travelTimeMinutes / 60))));
    const congestionIndex = Math.min(100, Math.round(((travelTimeMinutes - freeFlowMinutes) / freeFlowMinutes) * 100 * 1.6));

    const ampm = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;

    hours.push({
      hour: h,
      label: ampm,
      travelTimeMinutes,
      freeFlowMinutes,
      delayMinutes,
      avgSpeedKmh,
      congestionIndex: Math.max(5, congestionIndex),
      level,
      advisoryNote: note,
    });
  }

  return hours;
}

// Authentic Historical Trend Profiles for Nepal Highway Corridors
export const HISTORICAL_CORRIDOR_TRENDS: Record<string, CorridorTrendData> = {
  'tr-daunne': {
    corridorId: 'tr-daunne',
    corridorName: 'Daunne Hill Chokepoint (H01)',
    highwayCode: 'H01',
    section: 'Daunne East (Bardaghat) to Dumkibas (14 km)',
    distanceKm: 14,
    freeFlowTimeMinutes: 20,
    peakTimeMinutes: 75,
    bestDepartureWindow: '05:00 AM – 07:30 AM',
    worstDepartureWindow: '03:30 PM – 07:30 PM',
    primaryBottlenecks: [
      'Single-lane alternating stop-and-go at Asian Development Bank road widening cuts',
      'Heavy 10-wheeler Indian transit clunkers crawling uphill at 5-10 km/h',
      'Monsoon slippery mud puddles and axle breakdowns near Daunne Temple summit',
    ],
    historicalTips: [
      'Early morning crossing before 7:30 AM typically saves 45 to 60 minutes of delay.',
      'During evening bus departure surges (4 PM - 7 PM), expect alternating traffic queues extending up to 3 km.',
      'Heavy 4WD or high-clearance vehicles handle muddy switchback shoulders significantly better.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(20, 14, [
        { start: 8, end: 11, multiplier: 2.1, level: 'heavy', note: 'Morning intercity microbus & freight rush.' },
        { start: 12, end: 14, multiplier: 1.6, level: 'moderate', note: 'Mid-day construction machinery movement.' },
        { start: 15, end: 19, multiplier: 3.2, level: 'standstill', note: 'Peak long-haul cargo convoys and alternating 1-way stoppages.' },
        { start: 20, end: 22, multiplier: 2.4, level: 'heavy', note: 'Night tourist & deluxe express bus convoy.' },
      ]),
      friday: generate24HourProfile(20, 14, [
        { start: 8, end: 11, multiplier: 2.3, level: 'heavy', note: 'Pre-weekend cargo dispatches.' },
        { start: 13, end: 15, multiplier: 2.2, level: 'heavy', note: 'Early weekend departure traffic building up.' },
        { start: 16, end: 21, multiplier: 3.8, level: 'standstill', note: 'Severe weekend exodus choke; queues over 4 km.' },
        { start: 22, end: 23, multiplier: 2.7, level: 'heavy', note: 'Overnight long-route sleeper buses.' },
      ]),
      saturday: generate24HourProfile(20, 14, [
        { start: 9, end: 12, multiplier: 1.8, level: 'moderate', note: 'Holiday personal car & motorbike traffic.' },
        { start: 14, end: 18, multiplier: 2.5, level: 'heavy', note: 'Afternoon return flows and local goods carriers.' },
      ]),
      festival: generate24HourProfile(20, 14, [
        { start: 6, end: 22, multiplier: 3.9, level: 'standstill', note: 'Dashain / Tihar peak holiday migration; severe bottlenecks throughout the day.' },
      ]),
    },
  },

  'tr-mugling-abukhaireni': {
    corridorId: 'tr-mugling-abukhaireni',
    corridorName: 'Mugling – Abukhaireni Widening (H04)',
    highwayCode: 'H04',
    section: 'Marshyangdi Bridge to Abukhaireni Bazar (12 km)',
    distanceKm: 12,
    freeFlowTimeMinutes: 15,
    peakTimeMinutes: 48,
    bestDepartureWindow: '06:00 AM – 08:30 AM',
    worstDepartureWindow: '11:30 AM – 03:30 PM & 08:00 PM – 10:30 PM',
    primaryBottlenecks: [
      'Scheduled 20-minute traffic halts for rock blasting and hillside slope stabilization',
      'Narrow Marshyangdi river bridge bottleneck at Mugling junction',
      'Heavy dumper trucks hauling quarry aggregate for highway widening',
    ],
    historicalTips: [
      'Check daily DOR blasting schedules (usually 11:00 AM – 1:00 PM and 3:00 PM – 4:00 PM).',
      'Night departure (8 PM - 11 PM) sees high volumes of Pokhara-bound overnight VIP deluxe buses.',
      'Maintain extra distance near Marshyangdi gorge due to falling loose gravel.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(15, 12, [
        { start: 9, end: 11, multiplier: 1.9, level: 'moderate', note: 'Morning intercity passenger transit stream.' },
        { start: 11, end: 14, multiplier: 2.8, level: 'heavy', note: 'Hill blasting & heavy equipment excavator operations.' },
        { start: 16, end: 19, multiplier: 2.2, level: 'heavy', note: 'Kathmandu-Pokhara tourist & freight convergence.' },
        { start: 20, end: 23, multiplier: 2.6, level: 'heavy', note: 'Night sleeper buses and intercity container trucks.' },
      ]),
      friday: generate24HourProfile(15, 12, [
        { start: 11, end: 15, multiplier: 2.6, level: 'heavy', note: 'Blasting operations and outbound tourist vehicles.' },
        { start: 16, end: 22, multiplier: 3.2, level: 'standstill', note: 'Friday night Pokhara weekend getaway rush.' },
      ]),
      saturday: generate24HourProfile(15, 12, [
        { start: 8, end: 11, multiplier: 1.8, level: 'moderate', note: 'Weekend excursion & family road trips.' },
        { start: 16, end: 20, multiplier: 2.5, level: 'heavy', note: 'Saturday return traffic toward capital/plains.' },
      ]),
      festival: generate24HourProfile(15, 12, [
        { start: 6, end: 23, multiplier: 3.5, level: 'standstill', note: 'Continuous peak movement across Prithvi corridor.' },
      ]),
    },
  },

  'tr-nagdhunga': {
    corridorId: 'tr-nagdhunga',
    corridorName: 'Nagdhunga Inbound/Outbound Valley Pass (H02 / H04)',
    highwayCode: 'H02 / H04',
    section: 'Khanikhola / Naubise to Nagdhunga Tunnel Portal (8 km)',
    distanceKm: 8,
    freeFlowTimeMinutes: 12,
    peakTimeMinutes: 52,
    bestDepartureWindow: '04:30 AM – 06:30 AM & 01:00 PM – 03:00 PM',
    worstDepartureWindow: '06:30 PM – 11:30 PM (Inbound Trucks) & 07:00 AM – 10:30 AM (Outbound Buses)',
    primaryBottlenecks: [
      'Heavy freight trucks restricted from entering Kathmandu valley during daytime queueing up at Naubise until 7 PM',
      'Overloaded tipper and fuel tanker hill climbing on steep 12% Nagdhunga slopes',
      'Security and customs checkpost documentation check at valley checkpoint',
    ],
    historicalTips: [
      'Avoid 7 PM to 10 PM on the uphill climb: hundreds of queued freight trucks enter the valley at once.',
      'Utilize the newly opened Nagdhunga tunnel bypass route whenever operational to bypass 30+ minutes of hairpin crawling.',
      'Check engine coolant levels before tackling the sustained Khanikhola to Nagdhunga steep climb.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(12, 8, [
        { start: 7, end: 10, multiplier: 2.3, level: 'heavy', note: 'Morning outbound long-route bus departure surge.' },
        { start: 18, end: 23, multiplier: 3.8, level: 'standstill', note: 'Cargo truck daytime ban lifted; mass truck uphill crawl into valley.' },
      ]),
      friday: generate24HourProfile(12, 8, [
        { start: 14, end: 19, multiplier: 3.1, level: 'heavy', note: 'Friday valley escape rush toward Chitwan/Pokhara.' },
        { start: 19, end: 23, multiplier: 4.1, level: 'standstill', note: 'Freight release combined with holiday buses.' },
      ]),
      saturday: generate24HourProfile(12, 8, [
        { start: 7, end: 10, multiplier: 2.0, level: 'moderate', note: 'Morning weekend trips and bike convoys.' },
        { start: 17, end: 21, multiplier: 2.8, level: 'heavy', note: 'Returning weekenders and freight flow.' },
      ]),
      festival: generate24HourProfile(12, 8, [
        { start: 5, end: 23, multiplier: 4.2, level: 'standstill', note: 'Massive exodus from Kathmandu; queues can extend past Thankot.' },
      ]),
    },
  },

  'tr-siddhababa': {
    corridorId: 'tr-siddhababa',
    corridorName: 'Siddhababa Rock Shed Zone (H10)',
    highwayCode: 'H10',
    section: 'Chidiya Khola (Butwal) to Dobhan (Palpa) (6 km)',
    distanceKm: 6,
    freeFlowTimeMinutes: 10,
    peakTimeMinutes: 38,
    bestDepartureWindow: '06:00 AM – 08:30 AM',
    worstDepartureWindow: '11:00 AM – 04:30 PM',
    primaryBottlenecks: [
      'Active 1,126m rock-shed tunnel construction work on vertical gorge cliffs',
      'Periodic 15-minute stoppages for rock clearing and crane maneuvers',
      'Single-lane bridge crossing over Dobhan Khola',
    ],
    historicalTips: [
      'Traffic police restrict movement during active heavy rainfall due to rockfall hazard.',
      'Speed limit is strictly enforced at 20 km/h in the construction corridor.',
      'Early morning transit gives optimal visibility and minimal dust kickback.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(10, 6, [
        { start: 9, end: 12, multiplier: 2.2, level: 'moderate', note: 'Construction machinery transit and Palpa morning bus flow.' },
        { start: 13, end: 17, multiplier: 2.9, level: 'heavy', note: 'Rock-shed assembly works and dump truck shuttles.' },
      ]),
      friday: generate24HourProfile(10, 6, [
        { start: 10, end: 17, multiplier: 3.0, level: 'heavy', note: 'Increased weekend tourist travel toward Tansen & Pokhara.' },
      ]),
      saturday: generate24HourProfile(10, 6, [
        { start: 9, end: 13, multiplier: 2.4, level: 'moderate', note: 'Saturday Rani Mahal & Palpa tourist influx.' },
        { start: 16, end: 19, multiplier: 2.2, level: 'moderate', note: 'Return traffic toward Butwal.' },
      ]),
      festival: generate24HourProfile(10, 6, [
        { start: 7, end: 20, multiplier: 3.3, level: 'standstill', note: 'Heavy festival traffic on Siddhartha highway.' },
      ]),
    },
  },

  'tr-narayanghat-mugling': {
    corridorId: 'tr-narayanghat-mugling',
    corridorName: 'Narayanghat – Mugling Trishuli Gorge (H05)',
    highwayCode: 'H05',
    section: 'Aaptari (Bharatpur) to Mugling Bridge (36 km)',
    distanceKm: 36,
    freeFlowTimeMinutes: 45,
    peakTimeMinutes: 110,
    bestDepartureWindow: '05:30 AM – 08:00 AM',
    worstDepartureWindow: '04:30 PM – 08:30 PM',
    primaryBottlenecks: [
      'Tuin Khola bridge construction rock-cutting cutouts',
      'Slow heavy commercial trucks on steep river cliff curves',
      'Landslide clearing machinery deployment near Jalbire / Setidobhan',
    ],
    historicalTips: [
      'Crucial lifeline connecting Kathmandu & Pokhara to southern Terai and India.',
      'Check live monsoon alerts: Tuin Khola and Kalikhola are historically active landslide zones.',
      'Night travel between 1 AM - 4 AM offers smoothest transit but requires high-beam alertness.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(45, 36, [
        { start: 8, end: 11, multiplier: 1.7, level: 'moderate', note: 'Morning freight & bus flow from Terai.' },
        { start: 15, end: 19, multiplier: 2.3, level: 'heavy', note: 'Afternoon container trucks & intercity microbuses.' },
        { start: 20, end: 23, multiplier: 2.1, level: 'heavy', note: 'Long-haul freight and overnight AC bus convoys.' },
      ]),
      friday: generate24HourProfile(45, 36, [
        { start: 14, end: 22, multiplier: 2.5, level: 'heavy', note: 'Heavy weekend tourist & commercial traffic convergence.' },
      ]),
      saturday: generate24HourProfile(45, 36, [
        { start: 9, end: 12, multiplier: 1.5, level: 'smooth', note: 'Moderate family road trips.' },
        { start: 16, end: 19, multiplier: 1.8, level: 'moderate', note: 'Evening return streams.' },
      ]),
      festival: generate24HourProfile(45, 36, [
        { start: 6, end: 23, multiplier: 2.8, level: 'standstill', note: 'Continuous maximum capacity flow during national festivals.' },
      ]),
    },
  },

  'tr-sindhuli-bp': {
    corridorId: 'tr-sindhuli-bp',
    corridorName: 'Sindhuli Gadhi Serpentine Ridge (H13 - BP Highway)',
    highwayCode: 'H13',
    section: 'Nepalthok to Sindhuli Madi (42 km)',
    distanceKm: 42,
    freeFlowTimeMinutes: 60,
    peakTimeMinutes: 125,
    bestDepartureWindow: '06:00 AM – 09:00 AM',
    worstDepartureWindow: '02:00 PM – 06:30 PM',
    primaryBottlenecks: [
      'Continuous hairpin switchbacks with restricted vehicle width (large trucks banned)',
      'Overtaking bottlenecks behind slow hill microbuses on 3.75m narrow carriageway',
      'Rosha Khola flash flood river fords in monsoon',
    ],
    historicalTips: [
      'Heavy multi-axle cargo trucks are legally prohibited; only microbuses, cars, and bikes permitted.',
      'Brake cooling stop recommended at Sindhuli Gadhi crest to prevent mountain brake fade.',
      'Scenic photography stops at Selfiedanda frequently cause mini shoulder congestions on weekends.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(60, 42, [
        { start: 8, end: 11, multiplier: 1.6, level: 'moderate', note: 'Eastern Nepal microbuses heading to Kathmandu.' },
        { start: 13, end: 17, multiplier: 1.9, level: 'heavy', note: 'Mid-day Kathmandu outbound microbuses.' },
      ]),
      friday: generate24HourProfile(60, 42, [
        { start: 12, end: 18, multiplier: 2.2, level: 'heavy', note: 'Friday eastern Terai passenger rush.' },
      ]),
      saturday: generate24HourProfile(60, 42, [
        { start: 9, end: 16, multiplier: 1.8, level: 'moderate', note: 'Weekend motorcycle tours and scenic roadtrippers.' },
      ]),
      festival: generate24HourProfile(60, 42, [
        { start: 5, end: 20, multiplier: 2.6, level: 'standstill', note: 'Massive alternative route diversion during Dashain.' },
      ]),
    },
  },

  'tr-chitwan-express': {
    corridorId: 'tr-chitwan-express',
    corridorName: 'Narayanghat – Butwal Plains (H01)',
    highwayCode: 'H01',
    section: 'Kawasoti to Bardaghat (32 km)',
    distanceKm: 32,
    freeFlowTimeMinutes: 28,
    peakTimeMinutes: 40,
    bestDepartureWindow: 'All day (Free Flow)',
    worstDepartureWindow: '07:30 PM – 09:30 PM (Minor Local Bazar Flow)',
    primaryBottlenecks: [
      'Local market bazars with pedestrian crossings at Kawasoti & Sunwal',
      'Agricultural tractor and slow rickshaw movement in outer lanes',
    ],
    historicalTips: [
      'Newly 4-lane paved surface offers exceptional travel speeds up to 70-80 km/h.',
      'Watch for wildlife crossing signs in buffer forest zones between Narayani river and Kawasoti.',
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(28, 32, [
        { start: 9, end: 11, multiplier: 1.2, level: 'smooth', note: 'Local bazar trading traffic.' },
        { start: 17, end: 20, multiplier: 1.35, level: 'smooth', note: 'Evening commuter movement across market hubs.' },
      ]),
      friday: generate24HourProfile(28, 32, [
        { start: 16, end: 21, multiplier: 1.3, level: 'smooth', note: 'Weekend intercity transit.' },
      ]),
      saturday: generate24HourProfile(28, 32, [
        { start: 10, end: 18, multiplier: 1.15, level: 'smooth', note: 'Smooth holiday flow.' },
      ]),
      festival: generate24HourProfile(28, 32, [
        { start: 7, end: 21, multiplier: 1.5, level: 'moderate', note: 'High volume but remains fast-flowing on 4 lanes.' },
      ]),
    },
  },
};
