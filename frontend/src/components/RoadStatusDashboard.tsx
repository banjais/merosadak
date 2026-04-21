import React, { useState } from 'react';
import {
  ShieldBan,
  ArrowRightLeft,
  CheckCircle2,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronRight,
  Construction,
  Wrench,
  Calendar,
  Phone,
  Info,
  RotateCw,
  Search,
  X,
  ArrowUpDown,
  Navigation,
  Map as MapIcon,
  Share2,
  Compass
} from 'lucide-react';
import { TravelIncident } from '../types';
import { SourceBadge } from './SourceBadge';

interface RoadStatusDashboardProps {
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onPlanRoute?: (incident: TravelIncident) => void;
}

export const RoadStatusDashboard: React.FC<RoadStatusDashboardProps> = ({
  incidents,
  onSelectIncident,
  onRefresh,
  isRefreshing,
  onPlanRoute
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByDistance, setSortByDistance] = useState(false);

  const handleShare = (e: React.MouseEvent, incident: TravelIncident) => {
    e.stopPropagation();
    const title = incident.title || incident.name || 'Road Incident';
    const lat = incident.lat;
    const lng = incident.lng;
    const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';
    const locationInfo = `${incident.incidentDistrict || ''} ${incident.incidentPlace || ''}`.trim();

    const shareText = `🛣️ *MeroSadak Road Alert*\n*Issue:* ${title}\n*Status:* ${incident.status || 'Alert'}\n*Location:* ${locationInfo || 'Nepal'}${mapsUrl ? `\n📍 *Map:* ${mapsUrl}` : ''}`;

    if (navigator.share) {
      navigator.share({
        title: 'Road Status Update',
        text: shareText,
      }).catch(() => { });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  // Filter for road-specific status incidents
  const roadIncidents = (incidents || []).filter(i =>
    (i.status || i.type || i.severity || '').toLowerCase().match(/block|one|resum|open|clear|normal/)
  );

  const filteredIncidents = roadIncidents.filter(incident => {
    const q = searchQuery.toLowerCase();
    const district = String(incident.incidentDistrict || '').toLowerCase();
    const place = String(incident.incidentPlace || '').toLowerCase();
    const title = String(incident.title || incident.name || '').toLowerCase();
    return district.includes(q) || place.includes(q) || title.includes(q);
  });

  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (sortByDistance) {
      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      return distA - distB;
    }
    return 0;
  });

  // Filter for road-specific status incidents
  // Broaden filter to catch all variants of road status including severity fallbacks and synonyms
  if (roadIncidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 relative">
          <CheckCircle2 className="text-emerald-500" size={40} />
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
        </div>
        <h3 className="text-base font-black text-on-surface uppercase tracking-widest font-headline mb-2">Roads are Clear</h3>
        <p className="text-xs text-on-surface-variant/60 leading-relaxed font-body">
          Our real-time monitoring indicates no major blockages or lane restrictions across the national highway network.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Syncing...' : 'Check for Updates'}
          </button>
        )}
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('block')) return {
      icon: <ShieldBan size={16} />,
      color: 'text-error',
      bg: 'bg-error/10',
      border: 'border-error/20',
      label: 'Blocked'
    };
    if (s.includes('one')) return {
      icon: <ArrowRightLeft size={16} />,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: 'One-Lane'
    };
    return {
      icon: <CheckCircle2 size={16} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: 'Resumed'
    };
  };

  return (
    <div className="space-y-4 pb-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col gap-3 px-1">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={14} />
            <input
              type="text"
              placeholder="Filter by district or place..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-surface-container-high border border-outline/10 text-xs font-medium focus:outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-highest transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setSortByDistance(!sortByDistance)}
            className={`px-3 rounded-2xl border transition-all flex items-center justify-center ${sortByDistance
              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
              : 'bg-surface-container-high border-outline/10 text-on-surface-variant/60 hover:border-primary/30'
              }`}
            title={sortByDistance ? "Sorted by distance" : "Sort by distance"}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low border border-outline/10 text-[10px] font-bold text-on-surface-variant hover:text-primary transition-all disabled:opacity-50"
          >
            <RotateCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Syncing...' : 'Refresh Sheet Data'}
          </button>
        )}
      </div>

      {filteredIncidents.length === 0 && searchQuery && (
        <div className="py-12 text-center">
          <p className="text-xs font-bold text-on-surface-variant/40 italic">No incidents found matching "{searchQuery}"</p>
          <button onClick={() => setSearchQuery('')} className="mt-2 text-[10px] font-black text-primary uppercase">Clear Filter</button>
        </div>
      )}

      {sortedIncidents.map((incident) => {
        const config = getStatusConfig(incident.status || incident.type || incident.severity || '');

        return (
          <div
            key={incident.id}
            onClick={() => onSelectIncident(incident)}
            className={`group relative overflow-hidden rounded-3xl bg-surface-container-low border ${config.border} hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer`}
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.color} shadow-sm`}>
                  {config.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest font-label">{config.label}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SourceBadge source={incident.source} />
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">
                    <Clock size={10} />
                    {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live Update'}
                  </div>
                </div>
              </div>

              <h4 className="text-base font-black text-on-surface group-hover:text-primary transition-colors mb-3 leading-tight font-headline">
                {incident.title || incident.name}
              </h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                    <MapPin size={10} /> Location
                  </div>
                  <p className="text-[11px] font-bold text-on-surface truncate">{incident.incidentDistrict || 'Nepal'}</p>
                  <p className="text-[10px] text-on-surface-variant/60 truncate">{incident.incidentPlace || 'Highway Section'}</p>
                </div>
                {incident.chainage && (
                  <div className="space-y-1 border-l border-outline/10 pl-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                      <Construction size={10} /> Chainage
                    </div>
                    <p className="text-[11px] font-bold text-on-surface">{incident.chainage}</p>
                    <p className="text-[10px] text-on-surface-variant/60">Ref: {incident.road_refno || 'N/A'}</p>
                  </div>
                )}
              </div>

              {(incident.restorationEfforts || incident.remarks) && (
                <div className={`p-3 rounded-2xl ${config.bg} border border-white/5 space-y-2 mb-4`}>
                  <div className="flex items-start gap-2">
                    <Info size={12} className={`${config.color} mt-0.5 shrink-0`} />
                    <p className="text-[10px] leading-relaxed text-on-surface-variant italic font-body">
                      {incident.restorationEfforts || incident.remarks}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline/5">
                <div className="flex items-center gap-4">
                  {incident.blockedHours && (
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-error/80 uppercase">
                      <AlertTriangle size={10} />
                      {incident.blockedHours}H Blocked
                    </div>
                  )}
                  {incident.distance && (
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                      <Navigation size={10} />
                      {incident.distance.toFixed(1)} KM
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onPlanRoute && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlanRoute(incident); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                      title="Get directions"
                    >
                      <Compass size={12} />
                      Directions
                    </button>
                  )}
                  <button
                    onClick={(e) => handleShare(e, incident)}
                    className="p-2 rounded-full bg-surface-container-high hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all shadow-sm"
                    title="Share incident"
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectIncident(incident);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    <MapIcon size={12} />
                    Map View
                  </button>
                  <ChevronRight size={14} className="text-on-surface-variant/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};