import React, { useState, useMemo, useEffect } from 'react';
import { useOffline } from '../context/OfflineContext';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';
import { RoutePlanResult, HighwaySegment } from '../types';
import { SelectedSegmentWithHighway, generateTilesForSegments } from '../utils/offlineSync';
import {
  Wifi,
  WifiOff,
  CloudDownload,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  Compass,
  Zap,
  ShieldCheck,
  Mountain,
  Route,
  CheckSquare,
  Square,
  ArrowRight,
  Radio,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OfflineManagerModalProps {
  activeRoute?: RoutePlanResult | null;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({ activeRoute }) => {
  const {
    isOnline,
    isSimulatedOffline,
    setSimulatedOffline,
    cacheStats,
    isSyncing,
    syncProgress,
    downloadOfflinePack,
    cacheSegments,
    clearCache,
    refreshStats,
    isOfflineManagerOpen,
    setIsOfflineManagerOpen,
    cachedSegmentIds,
  } = useOffline();

  // All highway segments flattened with parent highway information
  const allSegmentsWithHighway: SelectedSegmentWithHighway[] = useMemo(() => {
    const list: SelectedSegmentWithHighway[] = [];
    NEPAL_HIGHWAYS.forEach((hw) => {
      hw.segments.forEach((seg) => {
        list.push({
          segment: seg,
          highwayCode: hw.code,
          highwayName: hw.name,
        });
      });
    });
    return list;
  }, []);

  // Set of selected segment IDs for targeted caching
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(() => {
    // Default to Prithvi Highway segments (H04) as popular mountain corridor
    const initial = new Set<string>();
    const h04 = NEPAL_HIGHWAYS.find((h) => h.code === 'H04');
    if (h04) {
      h04.segments.forEach((s) => initial.add(s.id));
    }
    return initial;
  });

  // Filter & Search states
  const [selectedHighwayFilter, setSelectedHighwayFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHighwayPresets, setShowHighwayPresets] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'segments' | 'full_pack'>('segments');
  const [lastCacheSuccess, setLastCacheSuccess] = useState<{ count: number; tiles: number; time: string } | null>(null);

  // When an activeRoute is provided or changes, offer or auto-select active route segments
  useEffect(() => {
    if (activeRoute && activeRoute.steps && activeRoute.steps.length > 0) {
      const matchedIds = new Set<string>();
      const routeHwNames = activeRoute.steps.map((s) => s.highwayName?.toLowerCase() || '');

      allSegmentsWithHighway.forEach(({ segment, highwayCode, highwayName }) => {
        const hwCodeLower = highwayCode.toLowerCase();
        const hwNameLower = highwayName.toLowerCase();
        const matchesStep = routeHwNames.some(
          (name) => name.includes(hwCodeLower) || hwNameLower.includes(name) || name.includes(hwNameLower)
        );
        if (matchesStep) {
          matchedIds.add(segment.id);
        }
      });

      if (matchedIds.size > 0) {
        setSelectedSegmentIds(matchedIds);
      }
    }
  }, [activeRoute, allSegmentsWithHighway]);

  // Track completion to celebrate success
  useEffect(() => {
    if (syncProgress && syncProgress.stage === 'complete') {
      setLastCacheSuccess({
        count: syncProgress.currentSegmentIndex || selectedSegmentIds.size,
        tiles: syncProgress.total,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
  }, [syncProgress, selectedSegmentIds.size]);

  if (!isOfflineManagerOpen) return null;

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Toggle single segment selection
  const toggleSegmentSelection = (segmentId: string) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  // Preset selector helper
  const selectByHighway = (highwayCode: string) => {
    const next = new Set(selectedSegmentIds);
    allSegmentsWithHighway
      .filter((item) => item.highwayCode === highwayCode)
      .forEach((item) => next.add(item.segment.id));
    setSelectedSegmentIds(next);
  };

  const selectOnlyHighway = (highwayCode: string) => {
    const next = new Set<string>();
    allSegmentsWithHighway
      .filter((item) => item.highwayCode === highwayCode)
      .forEach((item) => next.add(item.segment.id));
    setSelectedSegmentIds(next);
  };

  const selectAllSegments = () => {
    const all = new Set<string>();
    allSegmentsWithHighway.forEach((item) => all.add(item.segment.id));
    setSelectedSegmentIds(all);
  };

  const clearSegmentSelection = () => {
    setSelectedSegmentIds(new Set());
  };

  // Filtered segments according to active highway filter and search query
  const filteredSegments = allSegmentsWithHighway.filter((item) => {
    const matchesHighway = selectedHighwayFilter === 'ALL' || item.highwayCode === selectedHighwayFilter;
    if (!matchesHighway) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.segment.from.toLowerCase().includes(q) ||
      item.segment.to.toLowerCase().includes(q) ||
      item.highwayName.toLowerCase().includes(q) ||
      item.highwayCode.toLowerCase().includes(q) ||
      item.segment.surface.toLowerCase().includes(q)
    );
  });

  // Calculate stats for currently selected segments
  const selectedSegmentsData = allSegmentsWithHighway.filter((item) => selectedSegmentIds.has(item.segment.id));
  const totalSelectedDistanceKm = selectedSegmentsData.reduce((acc, it) => acc + it.segment.distanceKm, 0);

  // Calculate estimated tiles & download size for the selection
  const estimatedTilesCount = useMemo(() => {
    if (selectedSegmentsData.length === 0) return 0;
    const tileUrls = generateTilesForSegments(selectedSegmentsData.map((it) => it.segment));
    return tileUrls.length;
  }, [selectedSegmentsData]);

  // ~25 KB per tile + 15 KB route data per segment
  const estimatedSizeMb = useMemo(() => {
    const bytes = estimatedTilesCount * 25000 + selectedSegmentsData.length * 15000;
    return (bytes / (1024 * 1024)).toFixed(2);
  }, [estimatedTilesCount, selectedSegmentsData.length]);

  // Bandwidth savings comparison against full 45 MB pack
  const bandwidthSavingsPercent = useMemo(() => {
    const fullSizeMb = 45;
    const currentSizeMb = parseFloat(estimatedSizeMb);
    if (currentSizeMb <= 0) return 0;
    const savings = Math.max(0, Math.round(((fullSizeMb - currentSizeMb) / fullSizeMb) * 100));
    return savings;
  }, [estimatedSizeMb]);

  // Handle caching selected segments
  const handleCacheSelected = async () => {
    if (selectedSegmentsData.length === 0 || isSyncing) return;
    setLastCacheSuccess(null);
    await cacheSegments(selectedSegmentsData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/40 text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-600/30">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Mountain Offline GIS & Tile Pack
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  v1.2 GIS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cache map tiles, road telemetry, and route data for low-connectivity Himalayan corridors
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOfflineManagerOpen(false)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Live Network & Service Worker Status Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              className={`p-3.5 rounded-2xl border transition ${
                isOnline
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isOnline ? 'Online (Connected)' : 'Mountain Mode (Offline)'}
                  </span>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {isOnline
                  ? 'Live DOR hazard updates and cloud tile server reachable.'
                  : 'Operating in disconnected mountain mode with local storage.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Service Worker</span>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    cacheStats.isServiceWorkerActive ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {cacheStats.isServiceWorkerActive
                  ? 'Active: Intercepting tile requests & routing offline.'
                  : 'Ready: Browser CacheStorage & IndexedDB operational.'}
              </p>
            </div>
          </div>

          {/* Offline Cache Stats Overview */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
              <span>Local Offline Footprint</span>
              <button
                onClick={refreshStats}
                className="text-slate-400 hover:text-emerald-400 flex items-center space-x-1 text-[11px] transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Map Tiles</span>
                <strong className="text-sm sm:text-base text-emerald-400 font-mono font-bold block mt-0.5">
                  {cacheStats.tilesCount}
                </strong>
                <span className="text-[9px] text-slate-500 block">Cached</span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Segments</span>
                <strong className="text-sm sm:text-base text-cyan-400 font-mono font-bold block mt-0.5">
                  {cacheStats.cachedSegmentsCount || cachedSegmentIds.length}
                </strong>
                <span className="text-[9px] text-slate-500 block">Ready Offline</span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage</span>
                <strong className="text-sm sm:text-base text-purple-400 font-mono font-bold block mt-0.5">
                  {cacheStats.approxStorageSizeMb} MB
                </strong>
                <span className="text-[9px] text-slate-500 block">Disk Space</span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Last Synced</span>
                <strong className="text-[11px] text-amber-300 font-semibold block truncate mt-1">
                  {formatDate(cacheStats.lastSyncTimestamp)}
                </strong>
              </div>
            </div>
          </div>

          {/* LOW-CONNECTIVITY REGION ADVISORY */}
          <div className="bg-gradient-to-r from-teal-950/40 via-slate-950/60 to-emerald-950/40 border border-teal-500/20 rounded-2xl p-3.5 flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
              <Radio className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span>Low-Connectivity Mountain Optimization</span>
                <span className="px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded text-[9px] font-mono lowercase">
                  low-bandwidth
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                In deep gorges like Trishuli, Marshyangdi, or Karnali, cellular signals drop to 2G or zero bars.
                Targeted segment caching downloads <strong>up to 95% less data</strong> than the full country map, storing exact vector paths, elevation grades, and zoom 8–11 tiles right on your device.
              </p>
            </div>
          </div>

          {/* TAB SELECTION: Targeted Highway Segments vs. Full Pack */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('segments')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'segments'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>Targeted Highway Segments</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {selectedSegmentIds.size}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('full_pack')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'full_pack'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Nepal Pack (~45 MB)</span>
            </button>
          </div>

          {/* VIEW 1: TARGETED HIGHWAY SEGMENTS SELECTOR */}
          {activeTab === 'segments' && (
            <div className="space-y-3.5">
              {/* Active Route Quick Preset Banner (if route exists) */}
              {activeRoute && (
                <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 truncate">
                    <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-xs font-bold text-indigo-200 block truncate">
                        Active Planned Route: {activeRoute.origin?.name} → {activeRoute.destination?.name}
                      </span>
                      <span className="text-[10px] text-indigo-300/80">
                        {activeRoute.totalDistanceKm} km • {activeRoute.estimatedTimeMinutes} mins • {activeRoute.routeName || 'Mountain Corridor'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const matched = new Set<string>();
                      const routeHwNames = activeRoute.steps.map((s) => s.highwayName?.toLowerCase() || '');
                      allSegmentsWithHighway.forEach(({ segment, highwayCode, highwayName }) => {
                        const hwCodeLower = highwayCode.toLowerCase();
                        const hwNameLower = highwayName.toLowerCase();
                        if (
                          routeHwNames.some(
                            (name) => name.includes(hwCodeLower) || hwNameLower.includes(name) || name.includes(hwNameLower)
                          )
                        ) {
                          matched.add(segment.id);
                        }
                      });
                      setSelectedSegmentIds(matched);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shrink-0 transition"
                  >
                    Select Route Segments
                  </button>
                </div>
              )}

              {/* Highway Preset Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Corridor Bundles:</span>
                  </span>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      onClick={selectAllSegments}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      Select All ({allSegmentsWithHighway.length})
                    </button>
                    <span>•</span>
                    <button
                      onClick={clearSegmentSelection}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => selectOnlyHighway('H04')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H04 Prithvi</span>
                    <span className="text-[9px] text-slate-400">(Kathmandu–Pokhara)</span>
                  </button>

                  <button
                    onClick={() => selectOnlyHighway('H05')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H05 Narayanghat-Mugling</span>
                  </button>

                  <button
                    onClick={() => selectOnlyHighway('H13')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H13 BP Highway</span>
                  </button>

                  <button
                    onClick={() => selectOnlyHighway('H02')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H02 Tribhuvan</span>
                  </button>

                  <button
                    onClick={() => selectOnlyHighway('H10')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H10 Karnali</span>
                  </button>

                  <button
                    onClick={() => selectOnlyHighway('H01')}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700/60 border border-slate-700 rounded-xl text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <span>H01 East-West</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by pass, town or highway (e.g. Mugling, Galchhi, Daman)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Highway Filter Selector */}
                <select
                  value={selectedHighwayFilter}
                  onChange={(e) => setSelectedHighwayFilter(e.target.value)}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Highways ({allSegmentsWithHighway.length} segments)</option>
                  <option value="H04">H04 Prithvi Highway</option>
                  <option value="H05">H05 Narayanghat-Mugling</option>
                  <option value="H13">H13 BP Highway</option>
                  <option value="H02">H02 Tribhuvan Highway</option>
                  <option value="H01">H01 Mahendra / East-West</option>
                  <option value="H10">H10 Karnali Highway</option>
                  <option value="H03">H03 Araniko Highway</option>
                  <option value="H06">H06 Mechi Highway</option>
                </select>
              </div>

              {/* Scrollable Segment Checklist */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2 max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
                {filteredSegments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No highway segments match "{searchQuery}".
                  </div>
                ) : (
                  filteredSegments.map(({ segment, highwayCode, highwayName }) => {
                    const isSelected = selectedSegmentIds.has(segment.id);
                    const isCached = cachedSegmentIds.includes(segment.id);

                    return (
                      <div
                        key={segment.id}
                        onClick={() => toggleSegmentSelection(segment.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-emerald-950/30 border-emerald-600/40 text-slate-100'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div className="text-emerald-400 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700 shrink-0">
                                {highwayCode}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {segment.from}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-xs font-bold text-white truncate">
                                {segment.to}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5 truncate">
                              <span>{segment.distanceKm} km</span>
                              <span>•</span>
                              <span className="capitalize">{segment.surface.replace('_', ' ')}</span>
                              <span>•</span>
                              <span>⛰️ {segment.elevationStartM}m → {segment.elevationEndM}m</span>
                            </div>

                            {segment.currentIssue && (
                              <div className="text-[10px] text-amber-400/90 italic truncate mt-0.5">
                                Alert: {segment.currentIssue}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status tags & Cache badge */}
                        <div className="flex flex-col items-end space-y-1 shrink-0">
                          {isCached ? (
                            <span className="px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 rounded-md text-[9px] font-bold flex items-center space-x-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Offline Ready</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/50 text-slate-400 rounded-md text-[9px]">
                              Cloud only
                            </span>
                          )}

                          <span className="text-[9px] text-slate-500 font-mono">
                            ~{Math.max(12, Math.round(segment.coordinates.length * 3.5 + 4))} tiles
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selection Summary Bar */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                    <span>Selected: {selectedSegmentsData.length} segments</span>
                    <span className="text-slate-400">({totalSelectedDistanceKm} km total)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                    <span className="text-teal-400 font-mono font-semibold">
                      Est. {estimatedTilesCount} tiles • {estimatedSizeMb} MB
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">
                      {bandwidthSavingsPercent}% data savings vs full pack
                    </span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={handleCacheSelected}
                  disabled={isSyncing || selectedSegmentsData.length === 0}
                  className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition flex items-center space-x-2 shadow-md shadow-emerald-600/20 active:scale-[0.98]"
                >
                  <CloudDownload className="w-4 h-4" />
                  <span>
                    {isSyncing
                      ? 'Caching Selected Segments...'
                      : `Cache ${selectedSegmentsData.length} Selected Segments (${estimatedSizeMb} MB)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: FULL NEPAL PACK OPTION */}
          {activeTab === 'full_pack' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Full Nepal Strategic Highway Pack</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Downloads all zoom 6–9 tiles across Nepal and high-density zoom 10 tiles for all 33 highway corridors, mountain passes, and strategic border junctions (~45 MB).
                  </p>
                  <div className="mt-2 flex items-center space-x-3 text-[11px] text-slate-400">
                    <span>• All 33 Highway Segments</span>
                    <span>• 16 Weather Nodes</span>
                    <span>• 50+ Mountain Passes</span>
                  </div>
                </div>
              </div>

              <button
                onClick={downloadOfflinePack}
                disabled={isSyncing}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center space-x-2 shadow-md"
              >
                <CloudDownload className="w-4 h-4 text-purple-400" />
                <span>{isSyncing ? 'Synchronizing Highway Network...' : 'Download Full Nepal Offline Pack (~45 MB)'}</span>
              </button>
            </div>
          )}

          {/* SUCCESS BANNER WHEN CACHING COMPLETE */}
          {lastCacheSuccess && !isSyncing && (
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-center justify-between animate-in fade-in duration-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">Caching Complete ({lastCacheSuccess.time}):</span>
                  <span className="text-emerald-300/90 ml-1">
                    {lastCacheSuccess.count} highway segments and {lastCacheSuccess.tiles} tiles are now available 100% offline.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLastCacheSuccess(null)}
                className="text-emerald-400 hover:text-white text-xs p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* DEDICATED PROGRESS BAR COMPONENT (VISUALIZING CACHING PROCESS) */}
          {isSyncing && syncProgress && (
            <div className="bg-slate-950 border border-emerald-500/50 rounded-2xl p-4 space-y-3 shadow-lg shadow-emerald-950/50">
              {/* Progress Stage Tracker Pipeline */}
              <div className="grid grid-cols-3 gap-2 text-center pb-1">
                {/* Stage 1: Route Data */}
                <div
                  className={`p-2 rounded-xl border text-[11px] font-semibold transition flex flex-col items-center justify-center ${
                    syncProgress.stage === 'route_data'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 animate-pulse'
                      : syncProgress.processed > 0 && syncProgress.stage !== 'error'
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400/80'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <Route className="w-3.5 h-3.5 mb-1" />
                  <span className="truncate w-full text-[10px]">1. Route Vectors</span>
                </div>

                {/* Stage 2: Map Tiles */}
                <div
                  className={`p-2 rounded-xl border text-[11px] font-semibold transition flex flex-col items-center justify-center ${
                    syncProgress.stage === 'tiles'
                      ? 'bg-teal-950/60 border-teal-500 text-teal-300 animate-pulse'
                      : syncProgress.stage === 'apis' || syncProgress.stage === 'complete'
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400/80'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 mb-1" />
                  <span className="truncate w-full text-[10px]">2. Map Tiles</span>
                </div>

                {/* Stage 3: Telemetry & POIs */}
                <div
                  className={`p-2 rounded-xl border text-[11px] font-semibold transition flex flex-col items-center justify-center ${
                    syncProgress.stage === 'apis'
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 animate-pulse'
                      : syncProgress.stage === 'complete'
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mb-1" />
                  <span className="truncate w-full text-[10px]">3. Safety Telemetry</span>
                </div>
              </div>

              {/* Progress Header Info */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>
                    {syncProgress.stage === 'route_data' && 'Packaging Segment Geometry & Elevation...'}
                    {syncProgress.stage === 'tiles' && 'Fetching & Caching Cartographic Tiles...'}
                    {syncProgress.stage === 'apis' && 'Synchronizing Weather Nodes & Road Alerts...'}
                    {syncProgress.stage === 'complete' && 'Caching Finalized!'}
                    {syncProgress.stage === 'error' && 'Sync Encountered Interruption'}
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {syncProgress.percentage}%
                </span>
              </div>

              {/* The Visual Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5 relative">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50 relative overflow-hidden"
                  style={{ width: `${Math.max(4, syncProgress.percentage)}%` }}
                >
                  {/* Subtle moving shine effect */}
                  <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_ease-in-out_infinite]" />
                </div>
              </div>

              {/* Progress Details / Live Task Description */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <p className="truncate flex-1 pr-2">
                  {syncProgress.currentTask}
                </p>
                <div className="font-mono text-slate-400 shrink-0">
                  {syncProgress.processed} / {syncProgress.total} items
                </div>
              </div>

              {/* Throughput and Data Transfer Gauge */}
              {syncProgress.bytesCached !== undefined && syncProgress.bytesCached > 0 && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-900 pt-1.5 font-mono">
                  <span>
                    Cached: {(syncProgress.bytesCached / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  {syncProgress.totalBytesEst && (
                    <span>
                      Est. Total: {(syncProgress.totalBytesEst / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SIMULATION AND CACHE UTILITY STRIP */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* Simulation Toggle Switch */}
            <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-950/70 hover:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 transition select-none flex-1">
              <input
                type="checkbox"
                checked={isSimulatedOffline}
                onChange={(e) => setSimulatedOffline(e.target.checked)}
                className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700 rounded focus:ring-emerald-500 focus:ring-1"
              />
              <div className="text-left">
                <span className="text-xs font-semibold text-slate-200 block">
                  Simulate Remote Mountain Mode (Offline Test)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Cuts network requests to verify offline tiles & client-side Dijkstra
                </span>
              </div>
            </label>

            {/* Clear Offline Cache Button */}
            <button
              onClick={clearCache}
              disabled={isSyncing}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-xl text-xs font-semibold border border-slate-800 hover:border-red-800/40 transition flex items-center justify-center space-x-1.5 shrink-0"
              title="Purges all cached tiles and highway telemetry"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cache</span>
            </button>
          </div>

          {/* MOUNTAIN TRAVEL GUIDE & EXPLANATION */}
          <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>How Targeted Highway Caching Works in Low-Connectivity Gorges:</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              1. <strong>Gorge-Bounding Coordinates</strong>: We compute only the specific tile grid squares that intersect your selected corridor at zooms 8 (valley overview), 9–10 (river hairpins), and 11 (pass summits).
            </p>
            <p className="leading-relaxed text-[11px]">
              2. <strong>Zero-Latency Local Route Calculation</strong>: Elevation gradients, speed models, and waypoint coordinates are bundled into browser storage, allowing instant Dijkstra re-routing without contacting any external server.
            </p>
            <p className="leading-relaxed text-[11px]">
              3. <strong>Service Worker Tile Interception</strong>: When cell towers vanish in deep canyons like Mugling or Benighat, the Service Worker intercepts Leaflet tile requests and serves them from CacheStorage with 0ms lag.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                cacheStats.isReadyForOffline ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-medium text-slate-300">
              {cacheStats.isReadyForOffline
                ? 'Ready for offline Himalayan transit'
                : 'No offline cache available yet'}
            </span>
          </div>

          <button
            onClick={() => setIsOfflineManagerOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
