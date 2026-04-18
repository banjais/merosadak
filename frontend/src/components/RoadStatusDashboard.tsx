import React from 'react';
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
  Info
} from 'lucide-react';
import { TravelIncident } from '../types';
import { SourceBadge } from './SourceBadge';

interface RoadStatusDashboardProps {
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
}

export const RoadStatusDashboard: React.FC<RoadStatusDashboardProps> = ({
  incidents,
  onSelectIncident
}) => {
  // Filter for road-specific status incidents
  const roadIncidents = (incidents || []).filter(i =>
    (i.status || i.type || '').toLowerCase().match(/block|one|resum/)
  );

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
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    const s = status?.toLowerCase() || '';
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
      {roadIncidents.map((incident) => {
        const config = getStatusConfig(incident.status || incident.type || '');

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
                </div>
                <ChevronRight size={14} className="text-on-surface-variant/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};