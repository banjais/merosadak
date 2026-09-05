import React, { useState, useMemo } from 'react';
import { HighwayWeatherNode } from '../types';
import {
  CloudRain,
  Sun,
  CloudFog,
  Cloud,
  Zap,
  AlertTriangle,
  Wind,
  Eye,
  Droplets,
  Thermometer,
  Gauge,
  CloudLightning,
  Locate,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  RefreshCw,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { WeatherSparklineChart } from './WeatherSparklineChart';

interface WeatherPassesPanelProps {
  weatherNodes: HighwayWeatherNode[];
  onSelectNode: (node: HighwayWeatherNode) => void;
  selectedNodeId?: string | null;
  onRefreshWeather?: () => void;
  isRefreshing?: boolean;
}

interface SevereWeatherAlertItem {
  node: HighwayWeatherNode;
  severity: 'critical' | 'high' | 'moderate';
  severityLabel: string;
  recommendedSpeedKmH: string;
  speedCutBadge: string;
  hazardDescription: string;
  conditionName: string;
  conditionEmoji: string;
  roadGripLabel: string;
}

export const WeatherPassesPanel: React.FC<WeatherPassesPanelProps> = ({
  weatherNodes,
  onSelectNode,
  selectedNodeId,
  onRefreshWeather,
  isRefreshing = false,
}) => {
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSevereAdvisoryExpanded, setIsSevereAdvisoryExpanded] = useState<boolean>(true);

  // Compute Active Severe Weather Hazards & DoR Advisories across all mountain passes
  const severeWeatherAlerts: SevereWeatherAlertItem[] = useMemo(() => {
    const alerts: SevereWeatherAlertItem[] = [];

    weatherNodes.forEach((wx) => {
      const isCritical =
        wx.landslideRisk === 'severe' ||
        wx.condition === 'thunderstorm' ||
        wx.roadGrip === 'mud_slippery';

      const isHigh =
        !isCritical &&
        (wx.landslideRisk === 'high' ||
          wx.condition === 'rain_monsoon' ||
          wx.visibilityKm <= 2.0 ||
          wx.rainProbabilityPercent >= 75);

      const isModerate =
        !isCritical &&
        !isHigh &&
        (wx.landslideRisk === 'moderate' ||
          wx.condition === 'dense_fog' ||
          wx.condition === 'mountain_shower' ||
          wx.roadGrip === 'fog_low_visibility' ||
          wx.roadGrip === 'wet_caution' ||
          wx.rainProbabilityPercent >= 50);

      const conditionEmoji =
        wx.condition === 'thunderstorm'
          ? '⛈️'
          : wx.condition === 'rain_monsoon'
          ? '🌧️'
          : wx.condition === 'mountain_shower'
          ? '🌦️'
          : wx.condition === 'dense_fog'
          ? '🌫️'
          : wx.condition === 'sunny'
          ? '☀️'
          : '⛅';

      const conditionName =
        wx.condition === 'thunderstorm'
          ? 'Thunderstorm'
          : wx.condition === 'rain_monsoon'
          ? 'Monsoon Rain'
          : wx.condition === 'mountain_shower'
          ? 'Mountain Shower'
          : wx.condition === 'dense_fog'
          ? 'Dense Mountain Fog'
          : wx.condition === 'sunny'
          ? 'Clear / Sunny'
          : 'Overcast';

      const roadGripLabel =
        wx.roadGrip === 'mud_slippery'
          ? 'Mud & Slippery'
          : wx.roadGrip === 'wet_caution'
          ? 'Wet • Low Grip'
          : wx.roadGrip === 'fog_low_visibility'
          ? 'Fog • Low Vis'
          : 'Dry & Clear';

      if (isCritical) {
        alerts.push({
          node: wx,
          severity: 'critical',
          severityLabel: 'CRITICAL HAZARD',
          recommendedSpeedKmH: '≤ 20 km/h',
          speedCutBadge: '🔻 65% Cut',
          hazardDescription: 'Active mudslide danger & heavy runoff. 4WD and low gear descent mandatory.',
          conditionName,
          conditionEmoji,
          roadGripLabel,
        });
      } else if (isHigh) {
        alerts.push({
          node: wx,
          severity: 'high',
          severityLabel: 'HIGH RISK ALERT',
          recommendedSpeedKmH: '≤ 35 km/h',
          speedCutBadge: '🔻 45% Cut',
          hazardDescription: 'Monsoon hillside wash & reduced traction. Double braking distance to 75m.',
          conditionName,
          conditionEmoji,
          roadGripLabel,
        });
      } else if (isModerate) {
        alerts.push({
          node: wx,
          severity: 'moderate',
          severityLabel: 'MODERATE CAUTION',
          recommendedSpeedKmH: '≤ 45 km/h',
          speedCutBadge: '🔻 25% Cut',
          hazardDescription: 'Reduced optical visibility & damp hairpins. Low-beam fog lights ON.',
          conditionName,
          conditionEmoji,
          roadGripLabel,
        });
      }
    });

    const severityPriority = { critical: 0, high: 1, moderate: 2 };
    return alerts.sort((a, b) => severityPriority[a.severity] - severityPriority[b.severity]);
  }, [weatherNodes]);

  const worstSeverity = severeWeatherAlerts.length > 0 ? severeWeatherAlerts[0].severity : null;
  const overallRecommendedSpeed =
    worstSeverity === 'critical'
      ? 'Max 15 – 20 km/h'
      : worstSeverity === 'high'
      ? 'Max 30 – 35 km/h'
      : worstSeverity === 'moderate'
      ? 'Max 40 – 45 km/h'
      : 'Normal Speed';

  const getWeatherIcon = (condition: HighwayWeatherNode['condition']) => {
    switch (condition) {
      case 'sunny':
        return <Sun className="w-5 h-5 text-amber-400" />;
      case 'rain_monsoon':
        return <CloudRain className="w-5 h-5 text-blue-400 animate-pulse" />;
      case 'dense_fog':
        return <CloudFog className="w-5 h-5 text-slate-300" />;
      case 'mountain_shower':
        return <CloudRain className="w-5 h-5 text-cyan-400" />;
      case 'thunderstorm':
        return <Zap className="w-5 h-5 text-purple-400 animate-bounce" />;
      case 'cloudy':
      default:
        return <Cloud className="w-5 h-5 text-slate-400" />;
    }
  };

  const getGripBadge = (grip: HighwayWeatherNode['roadGrip']) => {
    switch (grip) {
      case 'dry_excellent':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            High Traction • Dry
          </span>
        );
      case 'wet_caution':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Wet • Reduced Grip
          </span>
        );
      case 'mud_slippery':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Mud Slush • Very Slippery
          </span>
        );
      case 'fog_low_visibility':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Fog Hazard • Low Vis
          </span>
        );
    }
  };

  const filteredNodes = weatherNodes.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.highwayCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.nepaliName.includes(searchQuery);

    if (!matchesSearch) return false;
    if (filterCondition === 'all') return true;
    if (filterCondition === 'rain' && (node.condition === 'rain_monsoon' || node.condition === 'mountain_shower' || node.condition === 'thunderstorm')) return true;
    if (filterCondition === 'fog' && node.condition === 'dense_fog') return true;
    if (filterCondition === 'hazard' && (node.landslideRisk === 'high' || node.landslideRisk === 'severe')) return true;
    return true;
  });

  return (
    <div className="space-y-4" id="weather-panel-root">
      {/* Header Summary & Real-Time Sync Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 p-4 rounded-xl border border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CloudFog className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">Highway Passes &amp; Micro-Weather</h3>
                <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>LIVE SENSORS</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Open-Meteo &amp; calibrated DHM Nepal station feeds</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onRefreshWeather && (
              <button
                onClick={onRefreshWeather}
                disabled={isRefreshing}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition disabled:opacity-50"
                id="btn-refresh-weather-telemetry"
                title="Fetch latest meteorological telemetry for all Nepal mountain passes"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
              </button>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
              {weatherNodes.length} Stations Active
            </span>
          </div>
        </div>

        {/* Live Status Sub-strip */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Telemetry active • Automatic 1-min resilient fallback</span>
          </div>
          <span className="font-mono text-slate-400">DHM Station Coordinates</span>
        </div>
      </div>

      {/* Severe Weather & DoR Mountain Safety Advisory (Exclusive to Weather Tab) */}
      {severeWeatherAlerts.length > 0 && (
        <div
          id="weather-severe-advisory-card"
          className={`rounded-2xl border backdrop-blur-md overflow-hidden transition-all shadow-xl ${
            worstSeverity === 'critical'
              ? 'bg-slate-950/95 border-rose-600/70 shadow-rose-950/50'
              : worstSeverity === 'high'
              ? 'bg-slate-950/95 border-amber-500/70 shadow-amber-950/40'
              : 'bg-slate-950/95 border-sky-500/70 shadow-sky-950/40'
          }`}
        >
          {/* Advisory Header Banner */}
          <div
            onClick={() => setIsSevereAdvisoryExpanded(!isSevereAdvisoryExpanded)}
            className={`p-3.5 flex items-center justify-between border-b cursor-pointer transition select-none ${
              worstSeverity === 'critical'
                ? 'bg-gradient-to-r from-rose-950/90 to-slate-950 border-rose-900/60 hover:from-rose-900/90'
                : worstSeverity === 'high'
                ? 'bg-gradient-to-r from-amber-950/90 to-slate-950 border-amber-900/60 hover:from-amber-900/90'
                : 'bg-gradient-to-r from-sky-950/90 to-slate-950 border-sky-900/60 hover:from-sky-900/90'
            }`}
            id="toggle-severe-advisory"
          >
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  worstSeverity === 'critical'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : worstSeverity === 'high'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-sky-500 text-slate-950'
                }`}
              >
                {worstSeverity === 'critical' ? (
                  <CloudLightning className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Severe Mountain Weather Bulletins
                  </h4>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                      worstSeverity === 'critical'
                        ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                        : worstSeverity === 'high'
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                        : 'bg-sky-500/30 text-sky-200 border border-sky-400/40'
                    }`}
                  >
                    {worstSeverity === 'critical' ? 'Critical' : worstSeverity === 'high' ? 'High Alert' : 'Advisory'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {severeWeatherAlerts.length} active mountain pass hazard alerts detected
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                {severeWeatherAlerts.length} PASSES
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                {isSevereAdvisoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded Advisory Details */}
          {isSevereAdvisoryExpanded && (
            <div className="p-3.5 space-y-3 bg-slate-950/80 animate-fadeIn">
              {/* DoR Speed Cut Recommendation Card */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  worstSeverity === 'critical'
                    ? 'bg-rose-950/40 border-rose-800/60'
                    : worstSeverity === 'high'
                    ? 'bg-amber-950/40 border-amber-800/60'
                    : 'bg-sky-950/40 border-sky-800/60'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      worstSeverity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300'
                        : worstSeverity === 'high'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      DoR Mandatory Speed Advisory
                    </span>
                    <strong className="text-sm font-black text-white block truncate">
                      {overallRecommendedSpeed}
                    </strong>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      worstSeverity === 'critical'
                        ? 'bg-rose-500 text-white'
                        : worstSeverity === 'high'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    {worstSeverity === 'critical'
                      ? '🔻 65% Speed Cut'
                      : worstSeverity === 'high'
                      ? '🔻 45% Speed Cut'
                      : '🔻 25% Speed Cut'}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                    Mountain Corridor Limit
                  </span>
                </div>
              </div>

              {/* Severe Passes Mini-Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
                  <span>CRITICAL MOUNTAIN PASS HAZARDS</span>
                  <span className="text-emerald-400 font-mono">DHM TELEMETRY</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {severeWeatherAlerts.map((alert) => (
                    <div
                      key={alert.node.id}
                      onClick={() => onSelectNode(alert.node)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer group ${
                        alert.severity === 'critical'
                          ? 'bg-slate-900/80 border-rose-900/50 hover:border-rose-500/70'
                          : alert.severity === 'high'
                          ? 'bg-slate-900/80 border-amber-900/50 hover:border-amber-500/70'
                          : 'bg-slate-900/80 border-sky-900/50 hover:border-sky-500/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-sm">{alert.conditionEmoji}</span>
                            <span className="font-bold text-xs text-white group-hover:text-amber-300 transition-colors">
                              {alert.node.name}
                            </span>
                            <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              ▲{alert.node.elevationM}m
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 font-mono">
                              {alert.node.highwayCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                            {alert.hazardDescription}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${
                              alert.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : alert.severity === 'high'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            }`}
                          >
                            {alert.recommendedSpeedKmH}
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-1">
                            {alert.roadGripLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Chips & Search */}
      <div className="space-y-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search mountain pass, gorge, or highway (e.g. Daunne, Nagdhunga)..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          id="weather-search-input"
        />

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'all', icon: '🌐', label: 'All Passes' },
            { id: 'rain', icon: '🌧️', label: 'Monsoon Rain' },
            { id: 'fog', icon: '🌫️', label: 'Dense Fog' },
            { id: 'hazard', icon: '⚠️', label: 'High Risk' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterCondition(f.id)}
              title={`${f.label} Passes`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center space-x-1 shrink-0 ${
                filterCondition === f.id
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
              id={`filter-weather-${f.id}`}
            >
              <span>{f.icon}</span>
              <span className="text-[11px]">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Weather Node Cards List */}
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
        {filteredNodes.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/60 text-slate-500 text-xs">
            No mountain pass weather stations found matching your criteria.
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node)}
                className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
                id={`weather-card-${node.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2.5">
                    <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 mt-0.5">
                      {getWeatherIcon(node.condition)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm text-slate-100">{node.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {node.highwayCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span>{node.nepaliName}</span>
                        <span>•</span>
                        <span className="text-slate-300 font-medium">Alt: {node.elevationM}m</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-extrabold text-white flex items-center justify-end">
                      <Thermometer className="w-3.5 h-3.5 text-rose-400 mr-0.5" />
                      {node.tempC}°C
                    </div>
                    <span className="text-[10px] text-slate-500 block">{node.lastUpdated}</span>
                  </div>
                </div>

                {/* Weather Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800/70 text-[11px]">
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Droplets className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>Rain: <strong className="text-slate-200">{node.rainProbabilityPercent}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Eye className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Vis: <strong className="text-slate-200">{node.visibilityKm} km</strong></span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Wind className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Wind: <strong className="text-slate-200">{node.windSpeedKmh} km/h</strong></span>
                  </div>
                </div>

                {/* Road Grip & Landslide Warning */}
                <div className="flex items-center justify-between mt-3">
                  {getGripBadge(node.roadGrip)}
                  {node.landslideRisk === 'high' || node.landslideRisk === 'severe' ? (
                    <span className="flex items-center space-x-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{node.landslideRisk === 'severe' ? 'Critical Slope' : 'Landslide Alert'}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Safe Slope Stability</span>
                  )}
                </div>

                {/* Summary Advisory */}
                <p className="mt-2.5 text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50 leading-relaxed">
                  {node.summary}
                </p>

                {/* D3 24-Hour Sparkline Trend Chart (shown when selected) */}
                {isSelected && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <WeatherSparklineChart weatherNode={node} />
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
