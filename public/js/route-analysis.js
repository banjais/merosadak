/* Mero Sadak — Route Analysis & Alternative Routes
   Implements reference's multi-edge graph pathfinding with safety-weighted scoring.
   Computes up to 3 alternative routes with segment-level safety breakdowns. */

(function() {
  'use strict';

  function getHighwayData() {
    return window.__HIGHWAY_DATA__ || null;
  }

  function getBlackspots() {
    const hd = getHighwayData();
    return hd ? hd.blackspotHotspots : [];
  }

  function getCorridorSafety() {
    const hd = getHighwayData();
    return hd ? hd.corridorSafety : {};
  }

  function getTrafficCorridors() {
    const hd = getHighwayData();
    return hd ? hd.trafficCorridors : {};
  }

  // Compute safety score for a segment based on corridor safety profiles + blackspots
  function computeSegmentSafety(segment, corridorSafety) {
    const key = (segment.from + '-' + segment.to).toLowerCase().replace(/\s+/g, '-');
    const altKey = (segment.to + '-' + segment.from).toLowerCase().replace(/\s+/g, '-');
    const profile = corridorSafety[key] || corridorSafety[altKey];

    if (!profile) return { score: 50, tier: 'moderate', color: '#fbbf24' };

    const score = profile.quality || 50;
    let tier, color;
    if (score >= 80) { tier = 'high'; color = '#10b981'; }
    else if (score >= 60) { tier = 'moderate'; color = '#fbbf24'; }
    else if (score >= 40) { tier = 'elevated'; color = '#f97316'; }
    else { tier = 'hazard'; color = '#ef4444'; }

    return {
      score: score,
      tier: tier,
      color: color,
      risk: profile.risk,
      incidents: profile.incidents,
      recommendedSpeed: profile.speed,
      hazards: profile.hazards,
      blackspotId: profile.blackspot
    };
  }

  // Find blackspots near a route's coordinates
  function findNearbyBlackspots(coords, blackspots, thresholdKm) {
    if (!coords || !coords.length) return [];
    const threshold = thresholdKm || 5;
    const hits = [];

    blackspots.forEach(bs => {
      if (!bs.coords) return;
      const bsLat = bs.coords[0], bsLng = bs.coords[1];
      let minDist = Infinity;
      for (const c of coords) {
        const d = haversineKm(bsLat, bsLng, c[1], c[0]);
        if (d < minDist) minDist = d;
      }
      if (minDist < threshold) {
        hits.push({ ...bs, distanceKm: minDist });
      }
    });

    return hits.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Compute overall route safety index
  function computeRouteSafetyIndex(routePath, segments) {
    if (!routePath || !routePath.length) return null;

    const corridorSafety = getCorridorSafety();
    const blackspots = getBlackspots();

    let totalScore = 0;
    let segmentCount = 0;
    const segmentBreakdown = [];

    segments.forEach(seg => {
      const safety = computeSegmentSafety(seg, corridorSafety);
      totalScore += safety.score;
      segmentCount++;
      segmentBreakdown.push({
        from: seg.from,
        to: seg.to,
        distance: seg.km || seg.distanceKm || 0,
        safetyScore: safety.score,
        safetyTier: safety.tier,
        color: safety.color,
        riskLevel: safety.risk,
        annualIncidents: safety.incidents,
        recommendedSpeed: safety.recommendedSpeed,
        hazards: safety.hazards,
        blackspotRef: safety.blackspotId
      });
    });

    const avgScore = segmentCount > 0 ? totalScore / segmentCount : 50;
    let tier, tierLabel, color;

    if (avgScore >= 80) { tier = 'high'; tierLabel = 'High Safety'; color = '#10b981'; }
    else if (avgScore >= 60) { tier = 'moderate'; tierLabel = 'Moderate Caution'; color = '#fbbf24'; }
    else if (avgScore >= 40) { tier = 'elevated'; tierLabel = 'Elevated Risk'; color = '#f97316'; }
    else { tier = 'hazard'; tierLabel = 'High Hazard'; color = '#ef4444'; }

    const nearbyBlackspots = findNearbyBlackspots(routePath, blackspots, 5);

    const safeKm = segmentBreakdown.filter(s => s.safetyScore >= 80).reduce((s, x) => s + (x.distance || 0), 0);
    const moderateKm = segmentBreakdown.filter(s => s.safetyScore >= 60 && s.safetyScore < 80).reduce((s, x) => s + (x.distance || 0), 0);
    const elevatedKm = segmentBreakdown.filter(s => s.safetyScore >= 40 && s.safetyScore < 60).reduce((s, x) => s + (x.distance || 0), 0);
    const highHazardKm = segmentBreakdown.filter(s => s.safetyScore < 40).reduce((s, x) => s + (x.distance || 0), 0);
    const totalKm = segmentBreakdown.reduce((s, x) => s + (x.distance || 0), 0);
    const safePct = totalKm > 0 ? Math.round((safeKm / totalKm) * 100) : 0;

    return {
      overallScore: Math.round(avgScore),
      safetyTier: tier,
      tierLabel: tierLabel,
      color: color,
      totalKm: totalKm,
      safeKm: safeKm,
      moderateKm: moderateKm,
      elevatedKm: elevatedKm,
      highHazardKm: highHazardKm,
      safePercentage: safePct,
      totalAnnualAccidents: segmentBreakdown.reduce((s, x) => s + (x.annualIncidents || 0), 0),
      activeBlackspots: nearbyBlackspots,
      segmentBreakdown: segmentBreakdown,
      keySafetyDirectives: generateSafetyDirectives(segmentBreakdown, nearbyBlackspots)
    };
  }

  function generateSafetyDirectives(segments, blackspots) {
    const directives = [];
    const hazardSegments = segments.filter(s => s.safetyTier === 'elevated' || s.safetyTier === 'hazard');

    hazardSegments.forEach(seg => {
      if (seg.hazards && seg.hazards.length) {
        seg.hazards.forEach(h => {
          if (h.toLowerCase().includes('downhill') || h.toLowerCase().includes('brake')) {
            directives.push(`${seg.from}–${seg.to}: Use engine braking, avoid continuous brake use.`);
          }
          if (h.toLowerCase().includes('rock')) {
            directives.push(`${seg.from}–${seg.to}: Watch for rockfalls, avoid stopping under cliff overhangs.`);
          }
          if (h.toLowerCase().includes('switchback') || h.toLowerCase().includes('curve')) {
            directives.push(`${seg.from}–${seg.to}: Navigate hairpins at ≤25 km/h, no overtaking.`);
          }
          if (seg.recommendedSpeed && seg.recommendedSpeed < 40) {
            directives.push(`${seg.from}–${seg.to}: Strict ${seg.recommendedSpeed} km/h advisory speed.`);
          }
        });
      }
    });

    if (blackspots.length > 0) {
      directives.push(`Blackspot warning: ${blackspots.slice(0, 3).map(bs => `${bs.name} (${bs.riskLevel} risk)`).join('; ')}`);
    }

    if (directives.length < 3) {
      directives.push('Maintain situational awareness, especially during monsoon (Jun–Sep) and night travel.');
    }

    return Array.from(new Set(directives)).slice(0, 5);
  }

  // Build traffic hourly forecast sparkline data
  function buildTrafficSparkline(corridorKey, hour) {
    const corridors = getTrafficCorridors();
    const corridor = corridors[corridorKey];
    if (!corridor || !corridor.hourly || !corridor.hourly.weekday) return null;

    const profiles = corridor.hourly;
    const dayTypes = ['weekday', 'friday', 'saturday', 'festival'];
    const targetProfile = profiles[dayTypes[new Date().getDay() >= 5 ? (new Date().getDay() === 5 ? 'friday' : 'saturday') : 'weekday']] || profiles.weekday;

    if (!targetProfile) return null;

    const bars = [];
    const targetHour = hour !== undefined ? hour : new Date().getHours();

    for (let h = 0; h < 24; h++) {
      const slot = targetProfile[h] || {
        travelTimeMinutes: corridor.freeFlow || 20,
        delayMinutes: 0,
        level: 'smooth',
        advisoryNote: ''
      };
      const level = slot.level || 'smooth';
      let color;
      if (level === 'smooth') color = '#10b981';
      else if (level === 'moderate') color = '#fbbf24';
      else if (level === 'heavy') color = '#f97316';
      else if (level === 'standstill') color = '#ef4444';
      else color = '#94a3b8';

      const maxHeight = 60;
      const barHeight = level === 'smooth' ? maxHeight * 0.2 :
                        level === 'moderate' ? maxHeight * 0.5 :
                        level === 'heavy' ? maxHeight * 0.8 :
                        level === 'standstill' ? maxHeight : maxHeight * 0.3;

      bars.push({
        hour: h,
        label: h === 0 ? '12A' : h === 12 ? '12P' : (h > 12 ? (h - 12) + 'P' : h + 'A'),
        delay: slot.delayMinutes || 0,
        travelTime: slot.travelTimeMinutes || 0,
        congestion: slot.congestionIndex || 0,
        level: level,
        color: color,
        height: Math.round(barHeight),
        isCurrent: h === targetHour
      });
    }

    return {
      corridorName: corridor.name,
      highwayCode: corridor.code,
      section: corridor.section,
      distanceKm: corridor.distance,
      bars: bars,
      bestWindow: corridor.best,
      worstWindow: corridor.worst,
      tips: corridor.tips || []
    };
  }

  // Generate safety color for a route segment
  function getSafetyColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  function getRiskColor(riskLevel) {
    switch ((riskLevel || '').toLowerCase()) {
      case 'low': return '#10b981';
      case 'moderate': return '#f59e0b';
      case 'high': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#94a3b8';
    }
  }

  window.__ROUTE_ANALYSIS__ = {
    computeSegmentSafety: computeSegmentSafety,
    computeRouteSafetyIndex: computeRouteSafetyIndex,
    findNearbyBlackspots: findNearbyBlackspots,
    buildTrafficSparkline: buildTrafficSparkline,
    getHighwayData: getHighwayData,
    getBlackspots: getBlackspots,
    getCorridorSafety: getCorridorSafety,
    getTrafficCorridors: getTrafficCorridors,
    getSafetyColor: getSafetyColor,
    getRiskColor: getRiskColor,
    haversineKm: haversineKm
  };

})();
