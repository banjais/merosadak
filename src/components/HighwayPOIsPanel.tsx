import React, { useState, useEffect } from 'react';
import { HighwayPOI, POICategory } from '../types';
import { Zap, Fuel, Utensils, Mountain, ShieldAlert, Ticket, Star, Phone, CheckCircle2, MapPin, Search, RefreshCw, Activity, BatteryCharging } from 'lucide-react';

interface HighwayPOIsPanelProps {
  pois: HighwayPOI[];
  onSelectPOI: (poi: HighwayPOI) => void;
  selectedPOIId?: string | null;
}

export const HighwayPOIsPanel: React.FC<HighwayPOIsPanelProps> = ({
  pois,
  onSelectPOI,
  selectedPOIId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [evFilterMode, setEvFilterMode] = useState<'all' | 'fast' | 'available'>('all');
  const [isRefreshingAPI, setIsRefreshingAPI] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('Just now');

  const handleRefreshAPI = () => {
    setIsRefreshingAPI(true);
    setTimeout(() => {
      setIsRefreshingAPI(false);
      setLastSynced(new Date().toLocaleTimeString());
    }, 600);
  };

  const getCategoryIcon = (category: POICategory) => {
    switch (category) {
      case 'ev_charger':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'fuel_station':
        return <Fuel className="w-4 h-4 text-emerald-400" />;
      case 'food_rest':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      case 'scenic_pass':
        return <Mountain className="w-4 h-4 text-purple-400" />;
      case 'emergency_dor':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'toll_plaza':
        return <Ticket className="w-4 h-4 text-blue-400" />;
    }
  };

  const categories: { id: string; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🌐' },
    { id: 'ev_charger', label: 'EV Chargers', icon: '⚡' },
    { id: 'food_rest', label: 'Food & Dhabas', icon: '🍲' },
    { id: 'fuel_station', label: 'Fuel Pumps', icon: '⛽' },
    { id: 'scenic_pass', label: 'Viewpoints', icon: '🏔️' },
    { id: 'emergency_dor', label: 'DOR Rescue', icon: '🚨' },
    { id: 'toll_plaza', label: 'Toll Plazas', icon: '🎟️' },
  ];

  const filteredPOIs = pois.filter((poi) => {
    const matchesSearch =
      poi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      poi.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      poi.highwayCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (poi.nepaliName && poi.nepaliName.includes(searchQuery));

    if (!matchesSearch) return false;

    if (selectedCategory !== 'all' && poi.category !== selectedCategory) {
      return false;
    }

    // Additional EV sub-filters if category is ev_charger
    if (poi.category === 'ev_charger' && selectedCategory === 'ev_charger' && poi.evSpecs) {
      if (evFilterMode === 'fast' && poi.evSpecs.powerKw < 60) return false;
      if (evFilterMode === 'available' && poi.evSpecs.availablePorts === 0) return false;
    }

    return true;
  });

  const evChargerCount = pois.filter((p) => p.category === 'ev_charger').length;
  const availableEvPortsCount = pois
    .filter((p) => p.category === 'ev_charger' && p.evSpecs)
    .reduce((acc, p) => acc + (p.evSpecs?.availablePorts || 0), 0);

  return (
    <div className="space-y-4" id="poi-panel-root">
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 p-4 rounded-xl border border-slate-800/80 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Highway POIs & EV Corridors</h3>
              <p className="text-xs text-slate-400">Live DC Fast Chargers, Dhabas & DOR Stations</p>
            </div>
          </div>
          <button
            onClick={handleRefreshAPI}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium transition border border-slate-700"
            title="Refresh live API status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAPI ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Sync API</span>
          </button>
        </div>

        {/* Live Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>API Live Status: Online</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-cyan-400 font-mono font-bold">{availableEvPortsCount} EV Ports Free</span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">Synced: {lastSynced}</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search EV chargers, Malekhu fish, NOC pumps, viewpoints..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          id="poi-search-input"
        />
      </div>

      {/* Category Pills Bar (Icon-First) */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCategory(c.id);
              if (c.id !== 'ev_charger') setEvFilterMode('all');
            }}
            title={c.label}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center space-x-1 shrink-0 ${
              selectedCategory === c.id
                ? 'bg-cyan-600 text-white shadow-sm font-bold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
            id={`filter-poi-${c.id}`}
          >
            <span>{c.icon}</span>
            <span className="text-[11px]">{c.label}</span>
          </button>
        ))}
      </div>

      {/* EV Sub-filter Bar (Visible when EV Chargers category is selected) */}
      {selectedCategory === 'ev_charger' && (
        <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-cyan-900/50 text-xs">
          <span className="text-slate-400 font-medium text-[11px] flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>EV Corridor Filter:</span>
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setEvFilterMode('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                evFilterMode === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              All ({evChargerCount})
            </button>
            <button
              onClick={() => setEvFilterMode('fast')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                evFilterMode === 'fast' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🚀 Fast DC ≥60kW
            </button>
            <button
              onClick={() => setEvFilterMode('available')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                evFilterMode === 'available' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🟢 Available Only
            </button>
          </div>
        </div>
      )}

      {/* POI Cards List */}
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
        {filteredPOIs.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/60 text-slate-500 text-xs">
            No highway points of interest or EV charging stations found matching your criteria.
          </div>
        ) : (
          filteredPOIs.map((poi) => {
            const isSelected = selectedPOIId === poi.id;
            return (
              <div
                key={poi.id}
                onClick={() => onSelectPOI(poi)}
                className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-cyan-950/50 border-cyan-500 ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
                id={`poi-card-${poi.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2.5">
                    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 mt-0.5">
                      {getCategoryIcon(poi.category)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm text-slate-100">{poi.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <span className="font-medium text-slate-300">{poi.locationName}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-mono text-[10px]">
                          {poi.highwayCode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{poi.rating}</span>
                  </div>
                </div>

                {/* EV Specific Specs & Live Availability */}
                {poi.evSpecs && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-cyan-900/40 text-[11px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 flex items-center space-x-1">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{poi.evSpecs.operator}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        poi.evSpecs.availablePorts > 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {poi.evSpecs.availablePorts > 0 ? `🟢 ${poi.evSpecs.availablePorts}/${poi.evSpecs.totalPorts} Ports Free` : '🔴 All Ports Busy'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">Charging Capacity</span>
                        <strong className="text-white font-mono">{poi.evSpecs.powerKw} kW DC Fast Charger</strong>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">Connector Plugs</span>
                        <span className="font-mono text-cyan-400 text-[10px]">{poi.evSpecs.plugs.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toll Plaza Pricing */}
                {poi.tollFeeNpr && (
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/70 text-[11px] grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900 p-1.5 rounded">
                      <span className="text-slate-400 text-[10px] block">Bike</span>
                      <strong className="text-slate-200">NPR {poi.tollFeeNpr.bike}</strong>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded">
                      <span className="text-slate-400 text-[10px] block">Car / Jeep</span>
                      <strong className="text-emerald-400">NPR {poi.tollFeeNpr.car}</strong>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded">
                      <span className="text-slate-400 text-[10px] block">Bus / Truck</span>
                      <strong className="text-amber-400">NPR {poi.tollFeeNpr.bus_truck}</strong>
                    </div>
                  </div>
                )}

                {/* Description */}
                <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
                  {poi.description}
                </p>

                {/* Facility Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {poi.facilities.map((fac, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800/70 text-slate-300 border border-slate-700/50"
                    >
                      ✓ {fac}
                    </span>
                  ))}
                </div>

                {/* Contact Phone if available */}
                {poi.contactNumber && (
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                      <Phone className="w-3 h-3" />
                      <span>{poi.contactNumber}</span>
                    </span>
                    <button className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold">
                      View on Map ➔
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

