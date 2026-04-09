// src/components/HighwayBrowser.tsx
import React, { useState, useMemo } from 'react';
import {
  Route,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Filter,
  MapPin,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useHighways } from '../hooks/useHighways';
import { useNepalData } from '../hooks/useNepalData';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface HighwayBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHighway: (highwayCode: string) => void;
  incidents: any[];
}

export const HighwayBrowser: React.FC<HighwayBrowserProps> = ({
  isOpen,
  onClose,
  onSelectHighway,
  incidents = []
}) => {
  const { highwayList, isLoadingList, listError } = useHighways();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'clear' | 'issues'>('all');

  // Close on Escape key
  useEscapeKey(onClose, isOpen);

  // Calculate highway status based on incidents
  const highwayStatuses = useMemo(() => {
    const statusMap: Record<string, { status: 'clear' | 'issues', incidentCount: number, incidents: any[] }> = {};

    // Initialize all highways as clear
    highwayList.forEach(highway => {
      statusMap[highway.code] = { status: 'clear', incidentCount: 0, incidents: [] };
    });

    // Update status based on incidents
    incidents.forEach(incident => {
      if (incident.road_refno && statusMap[incident.road_refno]) {
        statusMap[incident.road_refno].incidentCount++;
        statusMap[incident.road_refno].incidents.push(incident);
        statusMap[incident.road_refno].status = 'issues';
      }
    });

    return statusMap;
  }, [highwayList, incidents]);

  // Filter highways based on search and status
  const filteredHighways = useMemo(() => {
    return highwayList.filter(highway => {
      const matchesSearch = highway.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (highway.name && highway.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const status = highwayStatuses[highway.code];
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'clear' && status?.status === 'clear') ||
        (statusFilter === 'issues' && status?.status === 'issues');

      return matchesSearch && matchesStatus;
    });
  }, [highwayList, searchQuery, statusFilter, highwayStatuses]);

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    return status === 'issues' ? 'text-red-600' : 'text-emerald-600';
  };

  const getStatusIcon = (status: string) => {
    return status === 'issues' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />;
  };

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-surface rounded-3xl shadow-[0_25px_50px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Route size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Highway Directory</h2>
              <p className="text-sm text-on-surface-variant">{filteredHighways.length} of {highwayList.length} highways</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-outline/10 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-outline/10">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search highways (code or name)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline/20 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface-container-low text-on-surface placeholder-on-surface-variant"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All', count: highwayList.length },
                { id: 'clear', label: 'Clear', count: Object.values(highwayStatuses).filter(s => s.status === 'clear').length },
                { id: 'issues', label: 'Issues', count: Object.values(highwayStatuses).filter(s => s.status === 'issues').length }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id as any)}
                  className={`px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${statusFilter === filter.id
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-surface-container-low border border-outline/20 text-on-surface-variant hover:bg-primary/10'
                    }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Highway List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-on-surface-variant">Loading highways...</span>
            </div>
          ) : listError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle size={48} className="text-error mb-4" />
              <p className="text-on-surface font-bold mb-2">Failed to load highways</p>
              <p className="text-on-surface-variant text-sm mb-4">{listError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredHighways.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Route size={48} className="text-outline/30 mb-4" />
              <p className="text-on-surface-variant font-medium">No highways found</p>
              <p className="text-on-surface-variant/60 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="divide-y divide-outline/5">
              {filteredHighways.map(highway => {
                const status = highwayStatuses[highway.code] || { status: 'clear', incidentCount: 0, incidents: [] };

                return (
                  <button
                    key={highway.code}
                    onClick={() => onSelectHighway(highway.code)}
                    className="w-full p-4 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${status.status === 'issues' ? 'bg-red-50 dark:bg-red-950/50' : 'bg-emerald-50 dark:bg-emerald-950/50'}`}>
                          <div className={getStatusColor(status.status)}>
                            {getStatusIcon(status.status)}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-on-surface">{highway.code}</span>
                            {status.incidentCount > 0 && (
                              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
                                {status.incidentCount} issue{status.incidentCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {highway.name && (
                            <p className="text-sm text-on-surface-variant mt-0.5">{highway.name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <TrendingUp size={14} />
                        <span className="text-sm">View Details</span>
                      </div>
                    </div>

                    {/* Show recent incidents */}
                    {status.incidents.length > 0 && (
                      <div className="mt-3 pl-11">
                        <div className="text-xs text-on-surface-variant/70 mb-2">Recent Issues:</div>
                        <div className="space-y-1">
                          {status.incidents.slice(0, 2).map((incident: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-on-surface-variant">
                              <MapPin size={12} />
                              <span className="truncate">{incident.title}</span>
                              {incident.chainage && <span className="text-on-surface-variant/50">• Ch: {incident.chainage}</span>}
                            </div>
                          ))}
                          {status.incidents.length > 2 && (
                            <div className="text-xs text-on-surface-variant/50">
                              +{status.incidents.length - 2} more issues
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline/10 bg-surface-container-low">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Data updated in real-time</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};