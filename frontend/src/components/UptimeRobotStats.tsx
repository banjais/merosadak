import React, { useState, useEffect } from "react";
import { Activity, ExternalLink, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { apiFetch } from "../api";

interface MonitorStats {
  name: string;
  url: string;
  status: "up" | "down" | "paused" | "not_checked" | "unknown";
  uptime: number;
  responseTime: number;
  lastDownTime?: string;
  sslExpiry?: string;
  sslDaysRemaining?: number;
}

interface MonitoringStatus {
  status: "operational" | "degraded" | "down";
  monitors: MonitorStats[];
  overallUptime: number;
  lastUpdated: string;
}

interface UptimeRobotStatsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UptimeRobotStats: React.FC<UptimeRobotStatsProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMonitoringStatus();
    }
  }, [isOpen]);

  const fetchMonitoringStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<{ success: boolean; data: MonitoringStatus }>("/v1/monitoring/status");
      
      if (result.success && result.data) {
        setStatus(result.data);
      } else {
        setError("Failed to fetch monitoring status");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch monitoring status");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (monitorStatus: string) => {
    switch (monitorStatus) {
      case "up":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "down":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getOverallStatusColor = (monitorStatus: string) => {
    switch (monitorStatus) {
      case "operational":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "down":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return "text-green-500";
    if (uptime >= 95) return "text-yellow-500";
    return "text-red-500";
  };

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(2)}%`;
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 500) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-2xl font-bold text-white">System Status</h2>
                <p className="text-green-100 text-sm">Real-time monitoring & uptime stats</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          ) : status ? (
            <div className="p-6 space-y-6">
              {/* Overall Status */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overall Status</h3>
                  <span className={`text-2xl font-bold ${getOverallStatusColor(status.status)}`}>
                    {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
                    <p className={`text-3xl font-bold ${getUptimeColor(status.overallUptime)}`}>
                      {formatUptime(status.overallUptime)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatLastUpdated(status.lastUpdated)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Monitors */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monitors</h3>
                <div className="space-y-3">
                  {status.monitors.map((monitor, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(monitor.status)}
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{monitor.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {monitor.url}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Uptime</p>
                          <p className={`font-semibold ${getUptimeColor(monitor.uptime)}`}>
                            {formatUptime(monitor.uptime)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Response Time</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatResponseTime(monitor.responseTime)}
                          </p>
                        </div>
                      </div>

                      {monitor.sslDaysRemaining !== undefined && monitor.sslDaysRemaining < 30 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            ⚠️ SSL certificate expires in {monitor.sslDaysRemaining} days
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Public Status Page */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-300">Public Status Page</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      View detailed uptime statistics and history
                    </p>
                  </div>
                  <a
                    href="https://uptimerobot.com/ZaSzISaXMt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    <span className="text-sm">View Status</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <a
            href="https://uptimerobot.com/ZaSzISaXMt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            uptimerobot.com/ZaSzISaXMt
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
