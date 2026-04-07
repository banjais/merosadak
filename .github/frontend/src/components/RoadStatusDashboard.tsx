// components/RoadStatusDashboard.tsx
import React, { useMemo } from 'react';
import { ShieldBan, ArrowRightLeft, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import { TravelIncident } from '../types';

interface RoadStatusDashboardProps {
  incidents: TravelIncident[];
  onSelectIncident: (incident: TravelIncident) => void;
}

export const RoadStatusDashboard: React.FC<RoadStatusDashboardProps> = ({
  incidents,
  onSelectIncident,
}) => {
  const roadIncidents = useMemo(() => {
    return (incidents || []).filter((i) => {
      const text = `${i.type || ''} ${i.status || ''}`.toLowerCase();
      return text.includes('block') || text.includes('one') || text.includes('resum');
    });
  }, [incidents]);

  const blocked = useMemo(() => 
    roadIncidents.filter((i) => {
      const text = `${i.type || ''} ${i.status || ''}`.toLowerCase();
      return text.includes('block');
    }), [roadIncidents]);

  const oneLane = useMemo(() => 
    roadIncidents.filter((i) => {
      const text = `${i.type || ''} ${i.status || ''}`.toLowerCase();
      return text.includes('one');
    }), [roadIncidents]);

  const resumed = useMemo(() => 
    roadIncidents.filter((i) => {
      const text = `${i.type || ''} ${i.status || ''}`.toLowerCase();
      return text.includes('resum') && !text.includes('block') && !text.includes('one');
    }), [roadIncidents]);

  const groups = [
    {
      label: 'Blocked',
      icon: <ShieldBan size={18} />,
      color: 'text-red-600 dark:text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/50',
      border: 'border-red-200 dark:border-red-800',
      count: blocked.length,
      items: blocked,
    },
    {
      label: 'One-Lane',
      icon: <ArrowRightLeft size={18} />,
      color: 'text-amber-600 dark:text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      border: 'border-amber-200 dark:border-amber-800',
      count: oneLane.length,
      items: oneLane,
    },
    {
      label: 'Resumed',
      icon: <CheckCircle2 size={18} />,
      color: 'text-emerald-600 dark:text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      border: 'border-emerald-200 dark:border-emerald-800',
      count: resumed.length,
      items: resumed,
    },
  ];

  const total = roadIncidents.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle size={32} className="text-amber-500 mb-3" />
        <p className="text-sm font-medium text-on-surface-variant">No road incidents reported</p>
        <p className="text-xs text-on-surface-variant/60 mt-1">Data will appear here when roads are affected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {groups.map((group) => (
          <div
            key={group.label}
            className={`rounded-2xl p-3 text-center border ${group.border} ${group.bg}`}
          >
            <div className={`text-2xl font-bold ${group.color}`}>{group.count}</div>
            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${group.color}`}>
              {group.label}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed List */}
      <div className="space-y-5">
        {groups.map((group) =>
          group.items.length > 0 ? (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={group.color}>{group.icon}</span>
                <span className={`font-bold text-xs uppercase tracking-widest ${group.color}`}>
                  {group.label} • {group.count}
                </span>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectIncident(item)}
                    className={`w-full text-left p-4 rounded-2xl border ${group.border} 
                      bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-gray-800/80 
                      transition-all active:scale-[0.985] group`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-3 py-0.5 rounded-full ${group.bg} ${group.color}`}
                          >
                            {item.status || item.type}
                          </span>
                          {item.road_refno && (
                            <span className="font-mono text-[10px] text-on-surface-variant/60">
                              {item.road_refno}
                            </span>
                          )}
                        </div>

                        <h5 className="font-bold text-sm mt-2 line-clamp-2 text-on-surface">
                          {item.title}
                        </h5>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-on-surface-variant/70">
                          {item.incidentDistrict && <span>{item.incidentDistrict}</span>}
                          {item.chainage && <span>Ch: {item.chainage}</span>}
                          {item.incidentStarted && <span>Since {item.incidentStarted}</span>}
                        </div>

                        {item.remarks && (
                          <p className="mt-2 text-xs italic text-on-surface-variant/60 line-clamp-2">
                            {item.remarks}
                          </p>
                        )}
                      </div>

                      <ChevronRight
                        size={18}
                        className="text-on-surface-variant/30 group-hover:text-primary transition-colors mt-1 flex-shrink-0"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};