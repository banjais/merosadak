import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, pickRouteByCertification } from '../utils/routeOptimizer';
import { preloadRoadGraph } from '../utils/roadGraphRouter';
import { CityNode } from '../types';
import { loadExpandedCities } from '../utils/cityDataLoader';
import { filterCities, searchCitiesWithGeocode, countCityMatches } from '../utils/citySearch';
import {
  isHighwayQuery,
  getHighwayPlaces,
  highwayPlaceToCityNode,
  searchHighways,
  preloadHighwayCatalogue,
  getHighwayCatalogue,
} from '../utils/highwayCatalogue';
import { formatDistanceKm } from '../utils/formatDistance';
import { loadSNHReference, lookupDistanceWithFallback, estimateDistance, getSourceLabel, getEvidenceLevelLabel, getEvidenceLevelColor, SNHReferenceData, DataSourceType, DistanceWithSource, EvidenceLevel } from '../utils/snhLookup';
import { generateProofSheet } from '../utils/proofSheet';
import { sha256Hex } from '../utils/proofLinks';
import { ArrowRight, ArrowUpDown, Search, ArrowLeft, Calculator, ChevronDown, ExternalLink, X, MapPin } from 'lucide-react';
import { CitySuggestionDropdown } from './CityResultRow';
import { HighwayBrowser } from './HighwayBrowser';

/** How many place suggestions a picker shows. See RoutePlanner for the rationale. */
const CITY_SUGGESTION_LIMIT = 8;
import { DataAttribution } from './DataAttribution';
import { SettingsMenu, SettingsButton } from './SettingsMenu';
import { UnifiedRouteReport } from './UnifiedRouteReport';
import { RouteLineDrawing } from './RouteLineDrawing';
import { RouteMapView } from './RouteMapView';

import { TextScale } from '../hooks/useTextScale';
import { useAuth } from '../context/AuthContext';

interface DataSourceSelectorProps {
  selectedSource: DataSourceType;
  onChange: (source: DataSourceType) => void;
  evidenceLevel?: EvidenceLevel;
}

function DataSourceSelector({ selectedSource, onChange, evidenceLevel }: DataSourceSelectorProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sources: Array<{ value: DataSourceType; label: string; url: string; description: string }> = [
    {
      value: 'dor_snh',
      label: 'DoR sources (SNH + highway archive)',
      url: 'https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23',
      description: 'Uses a published SNH pair when available; otherwise computes a route from archived DoR highway geometry.',
    },
    {
      value: 'estimate_aerial',
      label: 'Aerial (Straight-Line)',
      url: '',
      description: 'Geodesic Great Circle distance — no surveyed corridor data available',
    },
  ];

  const openExternalLink = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const selected = sources.find((s) => s.value === selectedSource) || sources[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white hover:border-cyan-500 transition"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[140px]">{selected.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          {sources.map((src) => (
            <div
              key={src.value}
              role="option"
              aria-selected={src.value === selectedSource}
              onClick={() => {
                onChange(src.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs transition cursor-pointer ${
                src.value === selectedSource
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  onClick={(e) => openExternalLink(src.url, e)}
                  className={`flex items-center gap-1 font-medium ${src.url ? 'hover:underline cursor-pointer' : ''}`}
                >
                  {src.label}
                  {src.url && (
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
                  )}
                </span>
                {src.value === selectedSource && evidenceLevel && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded border shrink-0" style={{
                    backgroundColor: `rgba(${getEvidenceLevelColor(evidenceLevel).join(',')}, 0.15)`,
                    borderColor: `rgba(${getEvidenceLevelColor(evidenceLevel).join(',')}, 0.3)`,
                    color: `rgb(${getEvidenceLevelColor(evidenceLevel).join(',')})`,
                  }}>
                    {getEvidenceLevelLabel(evidenceLevel)}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">{src.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A one-character query like "a" is a prefix scan over ~2,400 places, so it gets
 * a wider result window than a specific query. The cap still keeps the dropdown
 * scrollable rather than dumping the whole country.
 */
function suggestionLimitFor(query: string): number {
  const length = query.trim().length;
  if (length <= 1) return 24;
  if (length === 2) return 16;
  return CITY_SUGGESTION_LIMIT;
}

function getCityHighwayLabel(city: CityNode): string {
  return [...new Set([...(city.connectedHighways || []), city.highwayCode].filter((code): code is string => Boolean(code)))].join(' · ');
}

interface HighwaySuggestionGroup {
  code: string;
  name: string;
  route: string;
  placeCount: number;
  places: CityNode[];
}

/** How many corridor places to list under an expanded highway heading. */
const CORRIDOR_PREVIEW_LIMIT = 6;

/**
 * Turns a highway-code query into the "places on this highway" block. Returns an
 * empty list for anything that is not a highway code so ordinary name search is
 * unaffected.
 */
function buildHighwayGroups(query: string): HighwaySuggestionGroup[] {
  if (!isHighwayQuery(query)) return [];
  return searchHighways(query).map((highway) => ({
    code: highway.code,
    name: highway.name,
    route: highway.route,
    placeCount: highway.placeCount,
    places: getHighwayPlaces(highway.code)
      .slice(0, CORRIDOR_PREVIEW_LIMIT)
      .map((place, index) => highwayPlaceToCityNode(place, index)),
  }));
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
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceType>('dor_snh');
  const [mapOpen, setMapOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    loadExpandedCities()
      .then((cities) => setAllCities(cities.length > 0 ? cities : CITIES_AND_JUNCTIONS))
      .catch(() => setAllCities(CITIES_AND_JUNCTIONS));
  }, []);

  // The corridor catalogue is what makes "NH01" or "Bharatpur area" resolvable,
  // so load it alongside the place list and re-render once both are in.
  const [catalogueVersion, setCatalogueVersion] = useState(0);
  const [highwayCount, setHighwayCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    preloadHighwayCatalogue().then(() => {
      if (cancelled) return;
      setCatalogueVersion((version) => version + 1);
      setHighwayCount(getHighwayCatalogue().length);
    });
    return () => {
      cancelled = true;
    };
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

  /**
   * Nominatim fallback for a place the local corpus has never heard of. Gated to
   * 3+ characters so a single keystroke does not fire a network request, and
   * skipped for highway codes, which are answered from the corridor catalogue
   * instead of a map lookup.
   */
  const shouldGeocode = (query: string) =>
    query.trim().length >= 3 && !isHighwayQuery(query);

  useEffect(() => {
    const query = originSearch.trim();
    // Keep the current geocoded pick while the field still shows its name.
    if (!query || query.toLowerCase() === geocodedOrigin?.name.toLowerCase()) {
      setGeocodingOrigin(false);
      return;
    }
    if (!shouldGeocode(query)) { setGeocodedOrigin(null); setGeocodingOrigin(false); return; }
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
    if (!shouldGeocode(query)) { setGeocodedDest(null); setGeocodingDest(false); return; }
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
    // Skip the counterpart endpoint so a zero-distance pair cannot be picked.
    const local = filterCities(allCities, originSearch, suggestionLimitFor(originSearch), {
      excludeIds: destId ? new Set([destId]) : undefined,
    });
    return geocodedOrigin ? [geocodedOrigin, ...local.filter((c) => c.id !== geocodedOrigin.id)] : local;
  }, [allCities, originSearch, geocodedOrigin, destId]);
  const filteredDestCities = useMemo(() => {
    const local = filterCities(allCities, destSearch, suggestionLimitFor(destSearch), {
      excludeIds: originId ? new Set([originId]) : undefined,
    });
    return geocodedDest ? [geocodedDest, ...local.filter((c) => c.id !== geocodedDest.id)] : local;
  }, [allCities, destSearch, geocodedDest, originId]);

  /** Total matches, so a capped list can say how many more there are. */
  const originMatchCount = useMemo(
    () => countCityMatches(allCities, originSearch, { excludeIds: destId ? new Set([destId]) : undefined }),
    [allCities, originSearch, destId]
  );
  const destMatchCount = useMemo(
    () => countCityMatches(allCities, destSearch, { excludeIds: originId ? new Set([originId]) : undefined }),
    [allCities, destSearch, originId]
  );

  /**
   * A highway code ("NH01", "NH44") is not a place name, so it is answered from
   * the corridor catalogue instead of the city list. The first match is expanded
   * into the places that highway actually serves; the rest stay collapsed so a
   * partial "NH4" still shows the likely intended corridor first.
   */
  const originHighwayGroups = useMemo(
    () => buildHighwayGroups(originSearch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originSearch, catalogueVersion]
  );
  const destHighwayGroups = useMemo(
    () => buildHighwayGroups(destSearch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destSearch, catalogueVersion]
  );

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

  const handleDataSourceChange = (source: DataSourceType) => {
    setSelectedDataSource(source);
    if (!origin || !destination) return;

    if (source === 'estimate_aerial') {
      setDistanceWithSource({
        ...estimateDistance(origin.lat, origin.lng, destination.lat, destination.lng),
        source: 'estimate_aerial',
      });
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
    setSelectedDataSource(result?.source === 'estimate_aerial' ? 'estimate_aerial' : 'dor_snh');
  };

  useEffect(() => {
    if (!origin || !destination) {
      setDistanceWithSource(null);
      setSelectedDataSource('dor_snh');
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
    setSelectedDataSource(result?.source === 'estimate_aerial' ? 'estimate_aerial' : 'dor_snh');
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

  useEffect(() => {
    if (!mapOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMapOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mapOpen]);

  useEffect(() => {
    if (!browserOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBrowserOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [browserOpen]);

  /**
   * A place picked from the highway browser becomes the destination when the
   * origin is already set, and the origin otherwise. That way browsing one
   * corridor to learn the road still ends in a working origin/destination pair
   * rather than a half-filled form.
   */
  const handleBrowserSelectPlace = (city: CityNode) => {
    if (originId && originId !== city.id) {
      setDestId(city.id);
      setDestSearch(city.name);
      setShowSearchBars(false);
    } else {
      setOriginId(city.id);
      setOriginSearch(city.name);
    }
    setBrowserOpen(false);
  };

  const handleChangeLocation = () => {
    setMapOpen(false);
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
      lookupResult: distanceWithSource,
      generatedAt: new Date().toISOString(),
      dataHash,
      issuedToName: user?.displayName || undefined,
      issuedToEmail: user?.email || undefined,
    });
  }, [origin, destination, distanceWithSource, snhReference, user]);

  const handleShareReport = useCallback(async () => {
    if (!origin || !destination || !routeResult) return;

    const durationFormatted = `${Math.floor(routeResult.estimatedTimeMinutes / 60)}h ${routeResult.estimatedTimeMinutes % 60}m`;
    const sourceLabel = distanceWithSource ? getSourceLabel(distanceWithSource.source) : 'DoR Nepal Highway GIS';
    const evidenceLabel = distanceWithSource?.evidenceLevel ? getEvidenceLevelLabel(distanceWithSource.evidenceLevel) : '';

    const shareText = `🛣️ NEPAL HIGHWAY TRIP PLAN: ${origin.name} ➔ ${destination.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 From: ${origin.name} (${origin.district} - ${origin.elevationM}m)
🏁 To: ${destination.name} (${destination.district} - ${destination.elevationM}m)
📏 Distance: ${displayedDistance.toFixed(2)} km
⏱️ Duration: ~${durationFormatted}
📊 Source: ${sourceLabel}
${evidenceLabel ? `🔬 Evidence: ${evidenceLabel}` : ''}
${distanceWithSource?.citation ? `📚 Citation: ${distanceWithSource.citation.document}, ${distanceWithSource.citation.table}${distanceWithSource.citation.printedPage ? `, p. ${distanceWithSource.citation.printedPage}` : ''}` : ''}
${distanceWithSource?.highwaysUsed?.length ? `🛣️ Highways: ${distanceWithSource.highwaysUsed.join(' → ')}` : ''}
${distanceWithSource?.note ? `📝 Note: ${distanceWithSource.note}` : ''}
${distanceWithSource?.evidenceLevel !== 'published' ? '⚠️ This distance is computed from source data and is not a DoR-published city-pair figure.' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Not an official Department of Roads document.`;

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
          <div className="min-w-0">
              <h1 className="text-[10px] font-semibold accent-text tracking-[0.2em] uppercase">
                Highway Distance Service
              </h1>
              <p className="text-xl font-black tracking-tight text-white font-display">
                Distance Calculator
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Road distance between Nepali cities and junctions, over Department of Roads highway data
              </p>
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
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Distance Calculator</h2>
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {allCities.length} searchable places
                  </span>
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
                      DoR SNH + highway archive
                    </span>
                  {distanceWithSource && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                        distanceWithSource.evidenceLevel === 'published' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                        distanceWithSource.evidenceLevel === 'estimate' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                        'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    }`}>
                        {getEvidenceLevelLabel(distanceWithSource.evidenceLevel)}
                    </span>
                  )}
                </div>
              </div>
              {highwayCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-300">
                      Don&apos;t know the place name, or which road serves it?
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Browse all {highwayCount} national highways and pick a place on the one you want.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBrowserOpen(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Browse by highway
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-5 relative" ref={originSearchRef}>                  <div className="relative">
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
                    <CitySuggestionDropdown
                      query={originSearch}
                      results={filteredOriginCities}
isSearchingMaps={geocodingOrigin}
                          groupByDistrict
                          highwayGroups={originHighwayGroups}
                          totalMatches={originMatchCount}
                          showTouchLegend
                          onSelect={(city) => handleSelectOrigin(city.id)}
                    />
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
                    <CitySuggestionDropdown
                      query={destSearch}
                      results={filteredDestCities}
isSearchingMaps={geocodingDest}
                          groupByDistrict
                          highwayGroups={destHighwayGroups}
                          totalMatches={destMatchCount}
                          showTouchLegend
                          onSelect={(city) => handleSelectDest(city.id)}
                    />
                  )}
                </div>
              </div>
            </div>
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

              {/* Animated origin → destination route sketch, then the Map option */}
              <RouteLineDrawing
                pathCoordinates={routeResult.pathCoordinates}
                origin={{
                  lat: origin?.lat ?? 0,
                  lng: origin?.lng ?? 0,
                  label: origin?.name || 'Origin',
                }}
                destination={{
                  lat: destination?.lat ?? 0,
                  lng: destination?.lng ?? 0,
                  label: destination?.name || 'Destination',
                }}
                isAerial={Boolean(routeResult.__aerialWarning)}
                onChangeLocation={handleChangeLocation}
                onShowMap={() => setMapOpen(true)}
              />

              {browserOpen && (
                <HighwayBrowser
                  cities={allCities}
                  onSelectPlace={handleBrowserSelectPlace}
                  onClose={() => setBrowserOpen(false)}
                />
              )}

              {mapOpen && (
                <div
                  className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
                  onClick={() => setMapOpen(false)}
                >
                  <div
                    className="relative w-full max-w-3xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setMapOpen(false)}
                      aria-label="Close map"
                      className="absolute -top-2 right-0 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-lg transition hover:bg-slate-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <RouteMapView
                      pathCoordinates={routeResult.pathCoordinates}
                      origin={{
                        lat: origin?.lat ?? 0,
                        lng: origin?.lng ?? 0,
                        label: origin?.name || 'Origin',
                      }}
                      destination={{
                        lat: destination?.lat ?? 0,
                        lng: destination?.lng ?? 0,
                        label: destination?.name || 'Destination',
                      }}
                      isAerial={Boolean(routeResult.__aerialWarning)}
                    />
                  </div>
                </div>
              )}

              <UnifiedRouteReport
              route={routeResult}
              distanceKm={displayedDistance}
              distanceSource={displayedSource}
              distanceEvidence={distanceWithSource?.evidenceLevel || 'route_graph'}
              distanceCitation={distanceWithSource?.citation || null}
              distanceNote={distanceWithSource?.note || null}
              distanceHighways={distanceWithSource?.highwaysUsed || []}
              sourceControl={
                <DataSourceSelector
                  selectedSource={selectedDataSource}
                  onChange={handleDataSourceChange}
                  evidenceLevel={distanceWithSource?.evidenceLevel}
                />
              }
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
