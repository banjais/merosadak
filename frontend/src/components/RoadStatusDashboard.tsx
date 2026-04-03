import React from 'react';
import { ShieldBan, ArrowRightLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { TravelIncident } from '../types';

interface RoadStatusDashboardProps {
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
}

interface StatusGroup {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  items: TravelIncident[];
}

export const RoadStatusDashboard: React.FC<RoadStatusDashboardProps> = ({ incidents, onSelectIncident }) => {
  const roadIncidents = incidents.filter(i => {
    const s = (i.status || i.type || '').toLowerCase();
    return s.includes('block') || s.includes('one') || s.includes('resum') || i.type === 'Road Block' || i.type === 'One-Lane' || i.type === 'Resumed';
  });

  const blocked = roadIncidents.filter(i => {
    const s = (i.status || i.type || '').toLowerCase();
    return s.includes('block') || i.type === 'Road Block';
  });

  const oneLane = roadIncidents.filter(i => {
    const s = (i.status || i.type || '').toLowerCase();
    return s.includes('one') || i.type === 'One-Lane';
  });

  const resumed = roadIncidents.filter(i => {
    const s = (i.status || i.type || '').toLowerCase();
    return (s.includes('resum') || i.type === 'Resumed') && !s.includes('block') && !s.includes('one');
  });

  const groups: StatusGroup[] = [
    {
      label: 'Blocked',
      icon: <ShieldBan size={16} />,
      color: 'text-error',
      bg: 'bg-error/10',
      border: 'border-error/20',
      items: blocked,
    },
    {
      label: 'One-Lane',
      icon: <ArrowRightLeft size={16} />,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      items: oneLane,
    },
    {
      label: 'Resumed',
      icon: <CheckCircle2 size={16} />,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      border: 'border-secondary/20',
      items: resumed,
    },
  ];

  const total = roadIncidents.length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex gap-2">
        {groups.map(g => (
          <div key={g.label} className={`flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl ${g.bg} border ${g.border}`}>
            <span className={`text-lg font-black font-headline ${g.color}`}>{g.items.length}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider font-label ${g.color}`}>{g.label}</span>
          </div>
        ))}
      </div>

      {/* Status groups */}
      {groups.map(g => (
        <div key={g.label}>
          {g.items.length > 0 && (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-1.5 px-1 pt-1`}>
                <span className={g.color}>{g.icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest font-label ${g.color}`}>{g.label} ({g.items.length})</span>
              </div>
              {g.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectIncident(item)}
                  className={`w-full text-left p-3 rounded-xl border ${g.border} bg-white/50 hover:bg-white/80 transition-all hover:scale-[1.01] active:scale-95 group`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${g.bg} ${g.color} font-label`}>
                          {item.status || item.type}
                        </span>
                        {item.road_refno && (
                          <span className="text-[9px] text-on-surface-variant/40 font-mono">{item.road_refno}</span>
                        )}
                      </div>
                      <h5 className="text-xs font-bold text-on-surface mt-1 truncate font-headline">{item.title}</h5>
                      <div className="flex gap-3 mt-0.5">
                        {item.incidentDistrict && (
                          <span className="text-[9px] text-on-surface-variant/50">{item.incidentDistrict}</span>
                        )}
                        {item.chainage && (
                          <span className="text-[9px] text-on-surface-variant/40">Ch: {item.chainage}</span>
                        )}
                        {item.incidentStarted && (
                          <span className="text-[9px] text-on-surface-variant/40">Since: {item.incidentStarted}</span>
                        )}
                      </div>
                      {item.remarks && (
                        <p className="text-[9px] text-on-surface-variant/40 mt-0.5 italic truncate">{item.remarks}</p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-on-surface-variant/20 group-hover:text-primary transition-colors shrink-0 ml-2" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {total === 0 && (
        <div className="text-center py-8 text-on-surface-variant/40 text-xs italic font-body">
          No road incidents from sheet data
        </div>
      )}
    </div>
  );
};
