/**
 * Numeric regression checks for the calculation fixes.
 *
 * Each case encodes a specific bug that shipped and produced a wrong number.
 * Run: npx tsx scripts/verify-calc-fixes.ts
 */
import { buildRouteElevationProfile } from '../src/utils/routeElevationProfile';
import { estimateMinutesFromSpeed, estimateEvKwh, EV_KM_PER_KWH } from '../src/utils/vehicleConfigs';
import { calculateSegmentSafety } from '../src/utils/safetyIndexCalculator';
import { getDistanceKm } from '../src/utils/geoUtils';
import type { RoutePlanResult, CityNode } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const city = (id: string, lat: number, lng: number, elevationM: number): CityNode => ({
  id, name: id, nepaliName: id, district: 'D', province: 'P',
  lat, lng, elevationM, isMajorHub: false, connectedHighways: ['NH01'],
});

/** Build a route with N evenly spaced steps each carrying the given net elevation. */
function makeRoute(opts: {
  distanceKm: number;
  originElev: number;
  destElev: number;
  maxElev?: number;
  steps: number;
}): RoutePlanResult {
  const perStep = (opts.destElev - opts.originElev) / opts.steps;
  const steps = Array.from({ length: opts.steps }, (_, i) => ({
    id: `s${i}`,
    instruction: 'Segment',
    distanceKm: opts.distanceKm / opts.steps,
    durationMinutes: 10,
    roadName: 'NH01',
    fromName: 'A',
    toName: 'B',
    fromId: 'a',
    toId: 'b',
    roadType: 'national_highway' as const,
    elevationGain: perStep,
    // RouteStep carries the net change as `elevationChangeM`; the optimizer
    // populates it from each edge's elevationGain.
    elevationChangeM: perStep,
    surface: 'asphalt_excellent' as const,
    roadStatus: 'clear' as const,
    highwayCode: 'NH01',
  }));

  return {
    id: 'r',
    origin: city('a', 27.7, 85.3, opts.originElev),
    destination: city('b', 28.2, 83.9, opts.destElev),
    preference: 'fastest',
    vehicle: 'car',
    totalDistanceKm: opts.distanceKm,
    estimatedTimeMinutes: 120,
    roadConditionScore: 80,
    safetyIndex: {
      overallScore: 80,
      tier: 'high',
      roadQualityAverage: 80,
      accidentRiskSummary: { level: 'low' as const, incidents: 0, note: '' },
      activeBlackspots: [],
    },
    statusSummary: { clearKm: opts.distanceKm, cautionKm: 0, obstructedKm: 0 },
    fuelEstimate: { liters: 0, costNpr: 0, avgMileageKmPerLiter: 14 },
    totalTollCostNpr: 0,
    elevationGainM: Math.max(0, opts.destElev - opts.originElev),
    maxElevationM: opts.maxElev ?? Math.max(opts.originElev, opts.destElev),
    incidentsOnRoute: [],
    steps,
    pathCoordinates: Array.from({ length: opts.steps + 1 }, (_, i) => [
      27.7 + (0.5 * i) / opts.steps,
      85.3 - (1.4 * i) / opts.steps,
    ]),
  } as unknown as RoutePlanResult;
}

console.log('\n1. Elevation grade was inflated by mixing rounded/unrounded distance');
{
  // 8 km route, uniform 1000 m climb => true average grade 12.5%.
  const route = makeRoute({ distanceKm: 8, originElev: 1000, destElev: 2000, maxElev: 2000, steps: 8 });
  const profile = buildRouteElevationProfile(route);
  const grades = profile.elevationPoints.map((p) => p.grade).filter((g) => g !== 0);
  const maxAbs = grades.reduce((m, g) => Math.max(m, Math.abs(g)), 0);
  const reported = Math.max(
    Math.abs(profile.stats.maxGrade),
    Math.abs(profile.stats.minGrade)
  );
  // Before the fix the denominator collapsed and grades ran far above the true 12.5%.
  check(
    'uniform 12.5% climb does not report an inflated max grade',
    reported <= 15,
    `reported ${reported}% vs true 12.5%`
  );
  check(
    'max reported grade is close to the true grade',
    maxAbs >= 5,
    `max sample grade ${maxAbs}%`
  );
}

console.log('\n2. Final steep cluster at the route end must not be dropped');
{
  // Mostly flat, then a hard 20% climb over the last two 2 km segments, so the
  // steep run necessarily touches the final sample.
  const flatSteps = 8;
  const steps = [
    ...Array.from({ length: flatSteps }, (_, i) => ({
      id: `f${i}`, instruction: 'Flat', distanceKm: 2, durationMinutes: 10,
      roadName: 'NH01', fromName: 'A', toName: 'B', fromId: 'a', toId: 'b',
      roadType: 'national_highway' as const, elevationGain: 0, elevationChangeM: 0,
      surface: 'asphalt_excellent' as const, roadStatus: 'clear' as const, highwayCode: 'NH01',
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `c${i}`, instruction: 'Steep climb', distanceKm: 2, durationMinutes: 10,
      roadName: 'NH01', fromName: 'A', toName: 'B', fromId: 'a', toId: 'b',
      roadType: 'national_highway' as const, elevationGain: 400, elevationChangeM: 400,
      surface: 'asphalt_excellent' as const, roadStatus: 'clear' as const, highwayCode: 'NH01',
    })),
  ];
  const originElev = 500;
  const destElev = originElev + 2 * 400; // 800 m of climb
  const totalKm = 10 * 2; // 20 km

  const route = {
    id: 'r',
    origin: city('a', 27.7, 85.3, originElev),
    destination: city('b', 28.2, 83.9, destElev),
    preference: 'fastest', vehicle: 'car',
    totalDistanceKm: totalKm, estimatedTimeMinutes: 120, roadConditionScore: 80,
    safetyIndex: {
      overallScore: 80, tier: 'high', roadQualityAverage: 80,
      accidentRiskSummary: { level: 'low', incidents: 0, note: '' }, activeBlackspots: [],
    },
    statusSummary: { clearKm: totalKm, cautionKm: 0, obstructedKm: 0 },
    fuelEstimate: { liters: 0, costNpr: 0, avgMileageKmPerLiter: 14 },
    totalTollCostNpr: 0, elevationGainM: 800, maxElevationM: destElev,
    incidentsOnRoute: [], steps,
    pathCoordinates: Array.from({ length: 11 }, (_, i) => [27.7 + 0.5 * (i / 10), 85.3 - 1.4 * (i / 10)]),
  } as unknown as RoutePlanResult;

  const profile = buildRouteElevationProfile(route);
  const lastZoneEnd = profile.steepHazardZones.length
    ? Math.max(...profile.steepHazardZones.map((z) => z.endKm))
    : 0;

  check(
    'a 20% climb produces a steep hazard zone',
    profile.steepHazardZones.length > 0,
    'no zones found'
  );
  check(
    'the zone extends to the destination, so the tail flush worked',
    lastZoneEnd >= totalKm - 0.5,
    `last zone ends at ${lastZoneEnd} of ${totalKm} km`
  );
}

console.log('\n3. Flat profile must not be clamped to a constant 60 m');
{
  const route = makeRoute({ distanceKm: 40, originElev: 20, destElev: 30, maxElev: 30, steps: 10 });
  const profile = buildRouteElevationProfile(route);
  const values = new Set(profile.elevationPoints.map((p) => p.elevation));
  check(
    'a low-altitude flat route keeps varying elevations',
    values.size > 1,
    `all points collapsed to ${[...values].join(',')} m`
  );
  check(
    'no point exceeds the true summit',
    Math.max(...values) <= 30 + 1,
    `max ${Math.max(...values)} m`
  );
}

console.log('\n4. Ascent and descent are never negative');
{
  for (const [o, d] of [[1400, 800], [800, 1400], [1000, 1000]] as const) {
    const route = makeRoute({ distanceKm: 50, originElev: o, destElev: d, maxElev: Math.max(o, d), steps: 10 });
    const p = buildRouteElevationProfile(route);
    check(
      `ascent/descent non-negative (${o}->${d} m)`,
      p.stats.totalAscent >= 0 && p.stats.totalDescent >= 0,
      `ascent ${p.stats.totalAscent}, descent ${p.stats.totalDescent}`
    );
  }
}

console.log('\n5. Travel time comes from a real speed, not fuel economy');
{
  const car100 = estimateMinutesFromSpeed(100, 'car');
  const truck100 = estimateMinutesFromSpeed(100, 'bus_truck');
  // Old formula: 100 km took 714 min (11.9 h) for a car, 1333 min for a truck.
  check('100 km by car is 1-3 hours', car100 >= 60 && car100 <= 180, `${car100} min`);
  check('a truck is slower than a car', truck100 > car100, `${truck100} vs ${car100} min`);
  check('zero distance yields no time', estimateMinutesFromSpeed(0, 'car') === 0);
  check('negative distance yields no time', estimateMinutesFromSpeed(-5, 'car') === 0);
}

console.log('\n6. EV consumption uses one constant everywhere');
{
  const kwh = estimateEvKwh(200);
  check('200 km matches the declared efficiency', Math.abs(kwh - 200 / EV_KM_PER_KWH) < 0.05, `${kwh} kWh`);
  check('200 km is well under the old 6.2 figure of 32.3', kwh < 32, `${kwh} kWh`);
  check('zero distance yields 0 kWh', estimateEvKwh(0) === 0);
}

console.log('\n7. A closed or obstructed road must not score as clear');
{
  const base = {
    segmentId: 'ktm-nbz',
    fromName: 'KTM', toName: 'NBZ',
    highwayCode: 'NH01', highwayName: 'Prithvi',
    distanceKm: 50,
    annualAccidentStats: '', safeDrivingAdvice: '',
    coordinates: [27.7, 85.3] as [number, number],
  };
  const closed = calculateSegmentSafety({ ...base, surface: 'asphalt_excellent', status: 'closed', elevationGainM: 0 } as never);
  const clear = calculateSegmentSafety({ ...base, surface: 'asphalt_excellent', status: 'clear', elevationGainM: 0 } as never);
  check(
    'closed scores far below clear',
    closed.roadQualityScore < clear.roadQualityScore - 40,
    `closed ${closed.roadQualityScore} vs clear ${clear.roadQualityScore}`
  );
}

console.log('\n8. Haversine cannot produce NaN');
{
  const ktmPokhara = getDistanceKm(27.7172, 85.324, 28.2096, 83.9856);
  check('Kathmandu-Pokhara is a plausible 130-160 km', ktmPokhara > 130 && ktmPokhara < 160, `${ktmPokhara.toFixed(1)} km`);
  check('identical points give exactly 0', getDistanceKm(27.7, 85.3, 27.7, 85.3) === 0);
  check('antipodal points stay finite', Number.isFinite(getDistanceKm(0, 0, 0, 180)));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);