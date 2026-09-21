import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { preloadRoadGraph } from '../utils/roadGraphRouter';
import { CityNode } from '../types';
import { loadExpandedCities } from '../utils/cityDataLoader';
import { filterCities } from '../utils/citySearch';
import { formatDistanceKm } from '../utils/formatDistance';
import { loadSNHReference, lookupSNHDistance, lookupDistanceWithFallback, getSourceLabel, getSourceDescription, getEvidenceLevelLabel, getEvidenceLevelColor, DistanceLookupResult, SNHReferenceData, DataSourceType, DistanceWithSource, EvidenceLevel } from '../utils/snhLookup';
import { generateProofSheet } from '../utils/proofSheet';
import { ArrowRight, ArrowUpDown, Search, ArrowLeft, Award, Edit3, Calculator, Download, Loader, FileText, Database, ChevronDown, ExternalLink } from 'lucide-react';
import { DataAttribution } from './DataAttribution';
import { SettingsMenu, SettingsButton } from './SettingsMenu';
import { DistanceMatrixData } from '../types';
import { isDistanceMatrixData, exportDistanceMatrixPdf } from '../utils/distanceMatrix';

import { TextScale } from '../hooks/useTextScale';

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
      value: 'snh_published',
      label: 'DoR Published SNH 2022/23',
      url: 'https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23',
      description: 'Official Department of Roads published distances from Statistics of National Highway 2022/23',
    },
    {
      value: 'dor_geojson_linksum',
      label: 'DoR Archives GeoJSON (Link-Sum)',
      url: 'https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement',
      description: 'DoR Archives survey link geometry — distance summed from per-link chainage in highway GeoJSON files',
    },
    {
      value: 'estimate_aerial',
      label: 'Estimate (Aerial Line-of-Sight)',
      url: '',
      description: 'Aerial line-of-sight distance (geodesic great circle). No surveyed corridor data available.',
    },
  ];

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
        <span className="truncate max-w-[180px]">{selected.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          {sources.map((src) => (
            <button
              key={src.value}
              type="button"
              onClick={() => {
                onChange(src.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs transition ${
                src.value === selectedSource
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  {src.label}
                  {src.url && (
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
                  )}
                </a>
                {src.value === selectedSource && evidenceLevel && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded border" style={{
                    backgroundColor: `rgba(${getEvidenceLevelColor(evidenceLevel).join(',')}, 0.15)`,
                    borderColor: `rgba(${getEvidenceLevelColor(evidenceLevel).join(',')}, 0.3)`,
                    color: `rgb(${getEvidenceLevelColor(evidenceLevel).join(',')})`,
                  }}>
                    {getEvidenceLevelLabel(evidenceLevel)}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">{src.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [matrixData, setMatrixData] = useState<DistanceMatrixData | null>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [snhReference, setSnhReference] = useState<SNHReferenceData | null>(null);
  const [snhLookupResult, setSnhLookupResult] = useState<DistanceLookupResult | null>(null);
  const [distanceWithSource, setDistanceWithSource] = useState<DistanceWithSource | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceType>('snh_published');

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

  const origin = originId ? allCities.find((c) => c.id === originId) : undefined;
  const destination = destId ? allCities.find((c) => c.id === destId) : undefined;

  useEffect(() => {
    function handleCloseOnOutsideClick(event: MouseEvent) {
      if (originSearchRef.current && !originSearchRef.current.contains(event.target as Node)) {
        setOriginDropdownOpen(false);
        setOriginSearch(origin?.name ?? '');
      }
      if (destSearchRef.current && !destSearchRef.current.contains(event.target as Node)) {
        setDestDropdownOpen(false);
        setDestSearch(destination?.name ?? '');
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

  const filteredOriginCities = filterCities(allCities, originSearch);
  const filteredDestCities = filterCities(allCities, destSearch);

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
    setOriginSearch(destination?.name ?? '');
    setDestSearch(origin?.name ?? '');
  };

  const routeResult = useMemo(
    () => originId && destId && originId !== destId && origin && destination
      ? findOptimizedRoute(originId, destId, 'fastest', 'car', {}, origin, destination)
      : null,
    [originId, destId, roadGraphVersion, origin, destination]
  );
  const aerialDistance = useMemo(
    () => origin && destination
      ? calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng)
      : 0,
    [origin, destination]
  );

  const displayedDistance = useMemo(() => {
    if (!origin || !destination) return routeResult?.totalDistanceKm || 0;
    if (!distanceWithSource) return routeResult?.totalDistanceKm || 0;
    return distanceWithSource.distanceKm;
  }, [origin, destination, distanceWithSource, routeResult]);

  const displayedSource = useMemo(() => {
    if (distanceWithSource) return distanceWithSource.source;
    return 'snh_published' as DataSourceType;
  }, [distanceWithSource]);

  const handleDataSourceChange = (source: DataSourceType) => {
    setSelectedDataSource(source);
    if (!origin || !destination || !snhReference || !distanceWithSource) return;

    if (source === 'snh_published') {
      const pub = lookupSNHDistance(origin.name, destination.name, snhReference);
      if (pub) {
        setDistanceWithSource({
          distanceKm: pub.distanceKm,
          evidenceLevel: 'published',
          source: 'snh_published',
          citation: pub.citation,
          linkChain: pub.linkChain,
          publishedDistanceKm: pub.publishedDistanceKm,
        });
      }
    } else if (source === 'estimate_aerial') {
      if (origin.lat && destination.lat) {
        const est = lookupDistanceWithFallback(
          origin.name,
          destination.name,
          origin.lat,
          origin.lng,
          destination.lat,
          destination.lng,
          snhReference
        );
        if (est) {
          setDistanceWithSource({ distanceKm: est.distanceKm, evidenceLevel: 'estimate', source: 'estimate_aerial', citation: est.citation, isUncertain: est.isUncertain });
        }
      }
    }
  };

  useEffect(() => {
    if (origin && destination && snhReference) {
      const lookup = lookupSNHDistance(origin.name, destination.name, snhReference);
      setSnhLookupResult(lookup);

      const result = lookupDistanceWithFallback(
        origin.name,
        destination.name,
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        snhReference
      );
      setDistanceWithSource(result);

      if (result) {
        setSelectedDataSource(result.source);
      } else {
        setSelectedDataSource('snh_published');
      }
    } else if (!origin || !destination) {
      setSnhLookupResult(null);
      setDistanceWithSource(null);
    }
  }, [origin, destination, snhReference]);

  const handleSelectOrigin = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId);
    setOriginId(cityId);
    setOriginSearch(city?.name || '');
    setOriginDropdownOpen(false);
  };

  const handleSelectDest = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId);
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

  const loadMatrixData = useCallback(async () => {
    if (matrixData) return matrixData;
    setIsMatrixLoading(true);
    try {
      const res = await fetch('/data/distance-matrix.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (isDistanceMatrixData(json)) {
        setMatrixData(json);
        return json;
      }
    } catch (e) {
      console.error('Failed to load distance matrix:', e);
    } finally {
      setIsMatrixLoading(false);
    }
    return null;
  }, [matrixData]);

  const handleExportPdf = async () => {
    const data = await loadMatrixData();
    if (data) exportDistanceMatrixPdf(data);
  };

  const handleExportProofSheet = useCallback(async () => {
    if (!origin || !destination || !distanceWithSource) return;
    let dataHash = 'snh-reference.json';
    if (snhReference) {
      let hash = 0;
      const text = JSON.stringify(snhReference);
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      dataHash = Math.abs(hash).toString(36);
    }
    await generateProofSheet({
      from: origin.name,
      to: destination.name,
      fromDistrict: origin.district,
      toDistrict: destination.district,
      lookupResult: distanceWithSource,
      generatedAt: new Date().toISOString(),
      dataHash,
    });
  }, [origin, destination, distanceWithSource, snhReference]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Page Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition"
              title="Back to Main App"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-400 tracking-wider">
                MERO SADAK
              </h1>
              <p className="text-xl font-black tracking-tight text-white font-display">
                Distance Calculator
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Search Bar Card - Hidden when report is shown */}
          {showSearchBars && (
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">Distance Calculator</h2>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isMatrixLoading}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 transition text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50"
                  title="Download Nepal Full Distance Matrix (A4 PDF, multi-page)"
                >
                  {isMatrixLoading ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Full Matrix PDF</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-5 space-y-1.5 relative" ref={originSearchRef}>
                  <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                    <Search className="w-3.5 h-3.5 text-emerald-400" />
                    <span>From (Origin)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      ref={originInputRef}
                      value={originSearch || (origin?.name ?? '')}
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
                  </div>
                  {originDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-1">
                      {filteredOriginCities.length > 0 ? (
                        filteredOriginCities.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelectOrigin(city.id)}
                            className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                                {city.name}
                                {city.cityType && (
                                  <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                    {city.cityType}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {city.district} District • {city.province} Province
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

                <div className="md:col-span-5 space-y-1.5 relative" ref={destSearchRef}>
                  <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>To (Destination)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      ref={destInputRef}
                      type="text"
                      value={destSearch || (destination?.name ?? '')}
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
                  </div>
                  {destDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-1">
                      {filteredDestCities.length > 0 ? (
                        filteredDestCities.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelectDest(city.id)}
                            className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                                {city.name}
                                {city.cityType && (
                                  <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                    {city.cityType}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {city.district} District • {city.province} Province
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
          )}

          {/* Calculation Result Display - Shown only when route is found */}
          {!showSearchBars && (
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white">{origin?.name ?? 'Select origin'}</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                  <span className="text-lg font-bold text-white">{destination?.name ?? 'Select destination'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleChangeLocation}
                    title="Change location"
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1.5 text-xs font-medium"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Change Location</span>
                  </button>
                  <DataSourceSelector
                    selectedSource={selectedDataSource}
                    onChange={handleDataSourceChange}
                    evidenceLevel={distanceWithSource?.evidenceLevel}
                  />
                  {distanceWithSource && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: `rgba(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')}, 0.15)`,
                        borderColor: `rgba(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')}, 0.3)`,
                        color: `rgb(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')})`,
                      }}
                    >
                      {getEvidenceLevelLabel(distanceWithSource.evidenceLevel)}
                    </span>
                  )}
                </div>
              </div>

              {/* 4-Card Multi-Metric Grid (International Standard) */}
              {(() => {
                const detourPercent = aerialDistance > 0
                  ? Math.round(((routeResult!.totalDistanceKm - aerialDistance) / aerialDistance) * 100)
                  : 0;
                const circuityRatio = routeResult!.circuityFactor
                  ? routeResult!.circuityFactor.toFixed(2)
                  : aerialDistance > 0
                  ? (routeResult!.totalDistanceKm / aerialDistance).toFixed(2)
                  : '1.00';

                 return (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                     {/* Card 1: Road Driving Distance (Primary Hero) */}
                     <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30 shadow-sm relative overflow-hidden">
                       <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                         <span>Road Driving Distance</span>
                         <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Primary</span>
                       </div>
                        <div className="text-2xl font-black text-emerald-400 mt-1 font-display flex items-baseline gap-2">
                          {distanceWithSource ? (
                            <span>{formatDistanceKm(distanceWithSource.distanceKm)} <span className="text-sm font-normal text-slate-400">km</span></span>
                          ) : (
                            <span>{formatDistanceKm(routeResult!.totalDistanceKm)} <span className="text-sm font-normal text-slate-400">km</span></span>
                          )}
                          {distanceWithSource && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                              style={{
                                backgroundColor: `rgba(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')}, 0.15)`,
                                borderColor: `rgba(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')}, 0.3)`,
                                color: `rgb(${getEvidenceLevelColor(distanceWithSource.evidenceLevel).join(',')})`,
                              }}
                            >
                              {getEvidenceLevelLabel(distanceWithSource.evidenceLevel)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                          <span>⏱️ ~{Math.floor(routeResult!.estimatedTimeMinutes / 60)}h {routeResult!.estimatedTimeMinutes % 60}m driving</span>
                        </div>
                        {distanceWithSource && distanceWithSource.citation && (
                          <div className="text-[9px] text-slate-500 mt-1 space-y-0.5">
                            <div>{getSourceLabel(distanceWithSource.source)} — {distanceWithSource.citation.table || 'N/A'}{distanceWithSource.citation.row ? ` row ${distanceWithSource.citation.row}` : ''}{distanceWithSource.citation.printedPage ? `, p.${distanceWithSource.citation.printedPage}` : ''}</div>
                            {distanceWithSource.isUncertain && (
                              <div className="text-amber-400">⚠ Aerial estimate only — road distance will be longer</div>
                            )}
                          </div>
                        )}
                        {!distanceWithSource && snhLookupResult && snhLookupResult.citation && (
                          <div className="text-[9px] text-slate-500 mt-1 space-y-0.5">
                            <div>SNH 2022/23, {snhLookupResult.citation.table}{snhLookupResult.citation.row ? ` row ${snhLookupResult.citation.row}` : ''}, p.{snhLookupResult.citation.printedPage} (PDF p.{snhLookupResult.citation.pdfPage})</div>
                            {snhLookupResult.isUncertain && (
                              <div className="text-amber-400">⚠ Has unreconciled component</div>
                            )}
                          </div>
                        )}
                     </div>

                     {/* Card 2: Direct Aerial Distance */}
                     <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                       <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                         <span>Direct (Aerial) Line</span>
                         <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">Line-of-Sight</span>
                       </div>
                       <div className="text-2xl font-black text-cyan-400 mt-1 font-display">
                         {formatDistanceKm(aerialDistance)} <span className="text-sm font-normal text-slate-400">km</span>
                       </div>
                       <div className="text-[11px] text-slate-500 mt-1">
                         As the crow flies (geodesic)
                       </div>
                     </div>

                    {/* Card 3: Mountain Circuity / Detour Factor */}
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Mountain Detour Ratio</span>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Circuity</span>
                      </div>
                      <div className="text-2xl font-black text-amber-400 mt-1 font-display">
                        +{detourPercent}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {circuityRatio}× terrain winding index
                      </div>
                    </div>

                    {/* Card 4: Elevation Delta */}
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Elevation Delta</span>
                        <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">ASL</span>
                      </div>
                      <div className="text-2xl font-black text-purple-400 mt-1 font-display flex items-baseline space-x-1">
                        <span>{destination!.elevationM - origin!.elevationM > 0 ? `+${destination!.elevationM - origin!.elevationM}` : destination!.elevationM - origin!.elevationM}</span>
                        <span className="text-sm font-normal text-slate-400">m</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {origin!.elevationM}m ➔ {destination!.elevationM}m
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Road Network Composition & Multi-Tier Classification */}
              {routeResult!.roadTierBreakdown && (
                <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center space-x-1.5">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Road Network Certification Composition</span>
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px]">
                      {routeResult!.roadTierBreakdown.certifiedPercent}% DoR Certified Highway
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${routeResult!.roadTierBreakdown.certifiedPercent}%` }}
                      title={`DoR Certified: ${formatDistanceKm(routeResult!.roadTierBreakdown.highwayKm)} km`}
                    />
                    {routeResult!.roadTierBreakdown.certifiedPercent < 100 && (
                      <div
                        className="bg-cyan-500 h-full transition-all"
                        style={{ width: `${100 - routeResult!.roadTierBreakdown.certifiedPercent}%` }}
                        title={`Provincial / Palika / Link Roads: ${formatDistanceKm(routeResult!.roadTierBreakdown.localKm + routeResult!.roadTierBreakdown.provincialKm + routeResult!.roadTierBreakdown.communityKm)} km`}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span>Federal Highway: <strong>{formatDistanceKm(routeResult!.roadTierBreakdown.highwayKm)} km</strong></span>
                    </span>
                    {(routeResult!.roadTierBreakdown.provincialKm > 0 || routeResult!.roadTierBreakdown.localKm > 0) && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                        <span>Local / Palika Links: <strong>{formatDistanceKm(routeResult!.roadTierBreakdown.provincialKm + routeResult!.roadTierBreakdown.localKm)} km</strong></span>
                      </span>
                    )}
                    {routeResult!.roadTierBreakdown.communityKm > 0 && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        <span>Unpaved Track: <strong>{formatDistanceKm(routeResult!.roadTierBreakdown.communityKm)} km</strong></span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Step summary of highways traversed with Certification Badges */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Corridors Traversed & Road Tiers:
                </div>
                <div className="flex flex-wrap gap-2">
                  {routeResult!.steps.map((st, i) => (
                    <div key={i} className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span className="text-slate-200 font-medium">{st.instruction}</span>
                      <span className="text-slate-500 font-semibold">({formatDistanceKm(st.distanceKm)} km)</span>
                      {st.certificationBadge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          st.roadClassification === 'national_highway'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : st.roadClassification === 'provincial_feeder'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : st.roadClassification === 'community_track'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        }`}>
                          {st.certificationBadge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Official Source of Truth & Provenance Footer */}
              <DataAttribution
                source={routeResult!.dataProvenance?.source || 'Department of Roads (DoR Nepal) GIS Network'}
                updatedAt={routeResult!.dataProvenance?.updatedAt || '2026-03-01'}
                note="Official statutory road distances certified along surveyed national highway centerlines (NH01-NH80). Direct aerial distance computed via Geodesic Great Circle."
                href="https://dor.gov.np"
              />

              {/* SNH Evidence & Proof Sheet */}
              {distanceWithSource && (
                <div className="pt-2 border-t border-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified against {getSourceLabel(distanceWithSource.source)} — {getSourceDescription(distanceWithSource.source)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportProofSheet}
                      title="Generate printable proof sheet for bank / official use"
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 transition text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Proof Sheet (PDF)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
