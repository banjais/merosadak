import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, pickRouteByCertification } from '../utils/routeOptimizer';
import { preloadRoadGraph } from '../utils/roadGraphRouter';
import { CityNode } from '../types';
import { loadExpandedCities } from '../utils/cityDataLoader';
import { filterCities, searchCitiesWithGeocode } from '../utils/citySearch';
import { formatDistanceKm } from '../utils/formatDistance';
import { loadSNHReference, lookupDistanceWithFallback, getSourceLabel, getEvidenceLevelLabel, SNHReferenceData, DataSourceType, DistanceWithSource } from '../utils/snhLookup';
import { generateProofSheet } from '../utils/proofSheet';
import { summarizeRouteHighways } from '../utils/routeHighwaySummary';
import { sha256Hex } from '../utils/proofLinks';
import { ArrowRight, ArrowUpDown, Search, ArrowLeft, Calculator, Loader2, X } from 'lucide-react';
import { SettingsMenu, SettingsButton } from './SettingsMenu';
import { UnifiedRouteReport } from './UnifiedRouteReport';

import { TextScale } from '../hooks/useTextScale';
import { useAuth } from '../context/AuthContext';

function getCityHighwayLabel(city: CityNode): string {
  return [...new Set([...(city.connectedHighways || []), city.highwayCode].filter((code): code is string => Boolean(code)))].join(' · ');
}

function getCityPlaceType(city: CityNode): string {
  if (city.district && city.name.trim().toLowerCase() === city.district.trim().toLowerCase()) {
    return 'City reference point';
  }
  if (city.cityType === 'Geocoded') return 'Map search result';
  return city.cityType || 'Mapped place';
}

function getCityDisplayName(city: CityNode): string {
  if (city.cityType === 'Airport' && city.shortName) {
    return `${city.shortName} Airport · ${city.name}`;
  }
  return city.name;
}

function getCityAreaLabel(city: CityNode): string {
  if (!city.district) return 'Administrative area not verified';
  const area = `${city.district} District`;
  if (city.name.trim().toLowerCase() === city.district.trim().toLowerCase()) {
    return `${area} · one point, not district-wide`;
  }
  return city.province ? `${area} · ${city.province} Province` : area;
}

function getCityRoadReference(city: CityNode): string {
  const highways = getCityHighwayLabel(city);
  if (highways) return `Highway codes listed: ${highways}`;
  return 'No highway code recorded · route connection is checked after selection';
}

interface DistanceCalculatorPageProps {
  onBack?: () => void;
  textScale?: TextScale;
  onTextScaleChange?: (scale: TextScale) => void;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
}

export const DistanceCalculatorPage: React.FC<DistanceCalculatorPageProps> = ({ onBack, textScale, onTextScaleChange, accentColor, onAccentColorChange }) => {
  const [originId, setOriginId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [showSearchBars, setShowSearchBars] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearch, setOriginSearch] = useState<string>('');
  const [destSearch, setDestSearch] = useState<string>('');
  const [allCities, setAllCities] = useState<CityNode[]>(CITIES_AND_JUNCTIONS);
  const originSearchRef = useRef<HTMLDivElement>(null);
  const destSearchRef = useRef<HTMLDivElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const [snhReference, setSnhReference] = useState<SNHReferenceData | null>(null);
  const [distanceWithSource, setDistanceWithSource] = useState<DistanceWithSource | null>(null);

  useEffect(() => {
    loadExpandedCities()
      .then((cities) => setAllCities(cities.length > 0 ? cities : CITIES_AND_JUNCTIONS))
      .catch(() => setAllCities(CITIES_AND_JUNCTIONS));
  }, []);

  useEffect(() => {
    loadSNHReference().then(setSnhReference);
  }, []);

  // Auto-focus destination input after origin is selected
  const prevOriginId = useRef<string>('');
  useEffect(() => {
    if (originId && prevOriginId.current === '') {
      prevOriginId.current = originId;
      setTimeout(() => {
        destInputRef.current?.focus();
      }, 100);
    } else if (originId) {
      prevOriginId.current = originId;
    }
  }, [originId]);

  // Geocode fallback: unknown places (hamlets, junctions) are resolved via
  // Nominatim so the calculator covers the same ground as the Route Planner.
  // Declared before `origin`/`destination`, which read these.
  const [geocodedOrigin, setGeocodedOrigin] = useState<CityNode | null>(null);
  const [geocodedDest, setGeocodedDest] = useState<CityNode | null>(null);
  const [geocodingOrigin, setGeocodingOrigin] = useState(false);
  const [geocodingDest, setGeocodingDest] = useState(false);

  const origin = originId ? allCities.find((c) => c.id === originId) || geocodedOrigin : undefined;
  const destination = destId ? allCities.find((c) => c.id === destId) || geocodedDest : undefined;

  useEffect(() => {
    function handleCloseOnOutsideClick(event: MouseEvent) {
      if (originSearchRef.current && !originSearchRef.current.contains(event.target as Node)) {
        setOriginDropdownOpen(false);
      }
      if (destSearchRef.current && !destSearchRef.current.contains(event.target as Node)) {
        setDestDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleCloseOnOutsideClick);
    return () => document.removeEventListener('mousedown', handleCloseOnOutsideClick);
  }, [origin?.name, destination?.name]);

  const roadGraphLoadedRef = useRef(false);
  const [roadGraphVersion, setRoadGraphVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    preloadRoadGraph().then(() => {
      if (cancelled) return;
      if (!roadGraphLoadedRef.current) {
        roadGraphLoadedRef.current = true;
        setRoadGraphVersion((version) => version + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = originSearch.trim();
    // Keep the current geocoded pick while the field still shows its name.
    if (!query || query.toLowerCase() === geocodedOrigin?.name.toLowerCase()) {
      setGeocodingOrigin(false);
      return;
    }
    if (filterCities(allCities, query).length > 0) { setGeocodedOrigin(null); setGeocodingOrigin(false); return; }
    let cancelled = false;
    setGeocodingOrigin(true);
    const timer = setTimeout(async () => {
      const results = await searchCitiesWithGeocode(allCities, query, 1);
      if (cancelled) return;
      setGeocodedOrigin(results[0] || null);
      setGeocodingOrigin(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [originSearch, allCities, geocodedOrigin]);

  useEffect(() => {
    const query = destSearch.trim();
    if (!query || query.toLowerCase() === geocodedDest?.name.toLowerCase()) {
      setGeocodingDest(false);
      return;
    }
    if (filterCities(allCities, query).length > 0) { setGeocodedDest(null); setGeocodingDest(false); return; }
    let cancelled = false;
    setGeocodingDest(true);
    const timer = setTimeout(async () => {
      const results = await searchCitiesWithGeocode(allCities, query, 1);
      if (cancelled) return;
      setGeocodedDest(results[0] || null);
      setGeocodingDest(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [destSearch, allCities, geocodedDest]);

  const filteredOriginCities = useMemo(() => {
    const local = filterCities(allCities, originSearch);
    return geocodedOrigin ? [geocodedOrigin, ...local.filter((c) => c.id !== geocodedOrigin.id)] : local;
  }, [allCities, originSearch, geocodedOrigin]);
  const filteredDestCities = useMemo(() => {
    const local = filterCities(allCities, destSearch);
    return geocodedDest ? [geocodedDest, ...local.filter((c) => c.id !== geocodedDest.id)] : local;
  }, [allCities, destSearch, geocodedDest]);

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
    setOriginSearch(destination?.name ?? '');
    setDestSearch(origin?.name ?? '');
  };

  const routeResult = useMemo(
    () => {
      if (!(originId && destId && originId !== destId && origin && destination)) return null;
      const plan = findOptimizedRoute(originId, destId, 'fastest', 'car', {}, origin, destination);
      return plan ? pickRouteByCertification(plan) : null;
    },
    [originId, destId, roadGraphVersion, origin, destination]
  );
  const displayedDistance = useMemo(() => {
    if (!origin || !destination) return 0;
    if (!distanceWithSource) return 0;
    return distanceWithSource.distanceKm;
  }, [origin, destination, distanceWithSource]);

  const displayedSource = useMemo(() => {
    if (distanceWithSource) return distanceWithSource.source;
    return 'dor_snh' as DataSourceType;
  }, [distanceWithSource]);

  useEffect(() => {
    if (!origin || !destination) {
      setDistanceWithSource(null);
      return;
    }

    const result = lookupDistanceWithFallback(
        origin.name,
        destination.name,
        origin.id,
        destination.id,
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        snhReference
      );
    setDistanceWithSource(result);
  }, [origin, destination, snhReference, routeResult]);

  const handleSelectOrigin = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId)
      || (geocodedOrigin?.id === cityId ? geocodedOrigin : undefined);
    setOriginId(cityId);
    setOriginSearch(city?.name || '');
    setOriginDropdownOpen(false);
  };

  const handleSelectDest = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId)
      || (geocodedDest?.id === cityId ? geocodedDest : undefined);
    setDestId(cityId);
    setDestSearch(city?.name || '');
    setDestDropdownOpen(false);
    setShowSearchBars(false);
  };

  const handleChangeLocation = () => {
    setOriginId('');
    setDestId('');
    setOriginSearch('');
    setDestSearch('');
    setOriginDropdownOpen(false);
    setDestDropdownOpen(false);
    setShowSearchBars(true);
    setTimeout(() => originInputRef.current?.focus(), 100);
  };

  const { user } = useAuth();

  const handleExportProofSheet = useCallback(async () => {
    if (!origin || !destination || !distanceWithSource) return;
    const sourceData = distanceWithSource.source === 'dor_geojson'
      ? await fetch('/data/road-graph.json').then((response) => response.ok ? response.text() : '').catch(() => '')
      : distanceWithSource.source === 'dor_snh'
        ? JSON.stringify(snhReference || '')
        : `unverified-aerial:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    const dataHash = sourceData ? (await sha256Hex(sourceData)).slice(0, 12) : 'unavailable';
    await generateProofSheet({
      from: origin.name,
      to: destination.name,
      fromDistrict: origin.district,
      toDistrict: destination.district,
      fromCoordinates: { lat: origin.lat, lng: origin.lng },
      toCoordinates: { lat: destination.lat, lng: destination.lng },
      lookupResult: distanceWithSource,
      routeHighways: routeResult ? summarizeRouteHighways(routeResult.steps) : undefined,
      generatedAt: new Date().toISOString(),
      dataHash,
      issuedToName: user?.displayName || undefined,
      issuedToEmail: user?.email || undefined,
    });
  }, [origin, destination, distanceWithSource, routeResult, snhReference, user]);

  const handleShareReport = useCallback(async () => {
    if (!origin || !destination || !routeResult) return;

    const sourceLabel = distanceWithSource ? getSourceLabel(distanceWithSource.source) : 'DoR Nepal Highway GIS';
    const sourceAndEvidence = distanceWithSource?.evidenceLevel
      ? `${sourceLabel} (${getEvidenceLevelLabel(distanceWithSource.evidenceLevel)})`
      : sourceLabel;
    const routeHighways = summarizeRouteHighways(routeResult.steps);
    const highwayDetails = routeHighways.map((segment) =>
      `${segment.highwayName} (${segment.highwayCode}; ${segment.roadClass}; ${segment.surface.replaceAll('_', ' ')}; ${segment.distanceKm.toFixed(1)} km)`
    );

    const shareText = `ROAD DISTANCE: ${origin.name} to ${destination.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Distance: ${displayedDistance.toFixed(2)} km
Distance source & evidence: ${sourceAndEvidence}
${distanceWithSource?.citation ? `📚 Citation: ${distanceWithSource.citation.document}, ${distanceWithSource.citation.table}${distanceWithSource.citation.printedPage ? `, p. ${distanceWithSource.citation.printedPage}` : ''}` : ''}
${highwayDetails.length ? `🛣️ Route planner GIS path:\n${highwayDetails.map((highway) => `   • ${highway}`).join('\n')}\nThese route details are not a segment-by-segment verification or breakdown of the selected distance.` : distanceWithSource?.highwaysUsed?.length ? `🛣️ Highways: ${distanceWithSource.highwaysUsed.join(' → ')}` : ''}
${distanceWithSource?.note ? `📝 Note: ${distanceWithSource.note}` : ''}
${distanceWithSource?.evidenceLevel !== 'published' ? '⚠️ This distance is computed from source data and is not a DoR-published city-pair figure.' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by MEROSADAK. The route path is provided for context and may use separate data from the selected distance. Not issued by the Department of Roads.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Distance: ${origin.name} to ${destination.name}`,
          text: shareText,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    await navigator.clipboard.writeText(shareText);
  }, [origin, destination, routeResult, displayedDistance, distanceWithSource]);

  const handlePrintReport = useCallback(async () => {
    window.print();
  }, []);

  const handleDownloadReport = useCallback(async () => {
    await handleExportProofSheet();
  }, [handleExportProofSheet]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Page Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition"
              title="Back to Main App"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md logo-shadow">
              <Calculator className="w-5 h-5 logo-icon" />
            </div>
            <div>
              <h1 className="text-sm font-semibold accent-text tracking-wider">
                MEROSADAK
              </h1>
              <p className="text-xl font-black tracking-tight text-white font-display">
                DISTANCE CALCULATOR
              </p>
            </div>
          </div>
          {/* Three-dot Settings Menu (no bell notification) */}
          <div className="relative ml-auto">
            <SettingsButton
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
            />

            <SettingsMenu
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              onOpenChange={setIsSettingsOpen}
              showTextSize={true}
              showAccentColor={true}
              textScale={textScale}
              onTextScaleChange={onTextScaleChange}
              accentColor={accentColor}
              onAccentColorChange={onAccentColorChange}
                    />
                    {originSearch && originId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOriginSearch(''); setOriginId(''); setOriginDropdownOpen(false); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                        title="Clear origin"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto scrollbar-paddle">
        <div className="space-y-6">
          {/* Search Bar Card - Hidden when report is shown */}
          {showSearchBars && (
            <>
              <p className="px-1 text-sm text-slate-400">
              Search {allCities.length.toLocaleString()} mapped places. Select a point—not a whole district—and check the calculated route and distance evidence.
              </p>
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-5 relative" ref={originSearchRef}>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      ref={originInputRef}
                      value={originSearch}
                      onChange={(event) => {
                        setOriginSearch(event.target.value);
                        setOriginDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setOriginSearch('');
                        setOriginDropdownOpen(true);
                      }}
                      placeholder="Search origin..."
                      autoComplete="off"
                       className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                    />
                    {originSearch && originId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOriginSearch(''); setOriginId(''); setOriginDropdownOpen(false); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                        title="Clear origin"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {originDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[9999] max-h-64 overflow-y-auto space-y-1">
                      {geocodingOrigin ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Searching maps...
                        </div>
                      ) : filteredOriginCities.length > 0 ? (
                        filteredOriginCities.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelectOrigin(city.id)}
                            className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                                {getCityDisplayName(city)}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {getCityPlaceType(city)} · {getCityAreaLabel(city)}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {getCityRoadReference(city)}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                              {city.elevationM}m ASL
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-xs text-slate-500">
                          No matching locations found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 flex justify-center pt-1 md:pt-4">
                  <button
                    onClick={swapCities}
                    title="Swap origin and destination"
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow-md active:scale-95"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="md:col-span-5 relative" ref={destSearchRef}>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      ref={destInputRef}
                      type="text"
                      value={destSearch}
                      onChange={(event) => {
                        setDestSearch(event.target.value);
                        setDestDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setDestSearch('');
                        setDestDropdownOpen(true);
                      }}
                      placeholder="Search destination..."
                      autoComplete="off"
                       className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                    />
                    {destSearch && destId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDestSearch(''); setDestId(''); setDestDropdownOpen(false); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                        title="Clear destination"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {destDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[9999] max-h-64 overflow-y-auto space-y-1">
                      {geocodingDest ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Searching maps...
                        </div>
                      ) : filteredDestCities.length > 0 ? (
                        filteredDestCities.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelectDest(city.id)}
                            className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                                {getCityDisplayName(city)}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {getCityPlaceType(city)} · {getCityAreaLabel(city)}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {getCityRoadReference(city)}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                              {city.elevationM}m ASL
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-xs text-slate-500">
                          No matching locations found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </>
          )}

          {/* Calculation Result Display - Shown only when route is found */}
          {!showSearchBars && routeResult && (
            <>
              {/* Aerial warning banner */}
              {routeResult.__aerialWarning && (
                <div className="bg-amber-900/90 border border-amber-500/40 text-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2.5 text-sm">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.8 0h13.6c.55 0 1-.45 1-1V7c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1z" />
                  </svg>
                  <span>
                    <strong className="font-bold">Aerial approximation only.</strong> No surveyed DoR highway corridor covers this origin-destination pair. The distance shown is a straight-line estimate — actual road distance will be longer, especially in mountain terrain.
                  </span>
                </div>
              )}

              <div className="card p-0 overflow-hidden">
                <img
                  src="/assets/photos/distance-calculator.svg"
                  alt="A route connecting two map locations, measured in kilometres"
                  className="block w-full max-h-64 object-contain"
                />
              </div>

              <UnifiedRouteReport
              route={routeResult}
              distanceKm={displayedDistance}
              distanceSource={displayedSource}
              distanceCalculatorMode
              distanceEvidence={distanceWithSource?.evidenceLevel || 'route_graph'}
              distanceCitation={distanceWithSource?.citation || null}
              distanceNote={distanceWithSource?.note || null}
              distanceHighways={distanceWithSource?.highwaysUsed || []}
              onChangeLocation={handleChangeLocation}
              onPrint={handlePrintReport}
              onShare={handleShareReport}
              onDownloadReport={handleDownloadReport}
              userIdentity={{ name: user?.displayName || undefined, email: user?.email || undefined }}
            />
          </>
          )}
        </div>
      </main>
    </div>
  );
};
