import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { TrafficCorridor, TrafficLevel, DayProfileType, HourlyTrafficTrend } from '../types';
import { HISTORICAL_CORRIDOR_TRENDS } from '../data/travelTimeTrendsData';
import {
  Activity,
  Gauge,
  Clock,
  TrendingDown,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Zap,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Compass,
  BarChart2,
  Calendar,
  Layers,
  ChevronRight,
  Radio,
  Eye,
  Info
} from 'lucide-react';

interface CorridorSubSegment {
  name: string;
  chainage: string;
  liveSpeedKmh: number;
  normalSpeedKmh: number;
  status: TrafficLevel;
  note: string;
}

// Authentic sub-segment speed breakdown for major Nepal corridors
const CORRIDOR_SEGMENTS: Record<string, CorridorSubSegment[]> = {
  'tr-daunne': [
    {
      name: 'Bardaghat Foothills',
      chainage: 'Km 0 - 4',
      liveSpeedKmh: 36,
      normalSpeedKmh: 45,
      status: 'moderate',
      note: 'Approaching hill incline; moderate heavy vehicle queue.',
    },
    {
      name: 'East Ridge Excavation',
      chainage: 'Km 4 - 8',
      liveSpeedKmh: 9,
      normalSpeedKmh: 40,
      status: 'standstill',
      note: 'ADB road widening cliff cut; single-lane alternating stoppages.',
    },
    {
      name: 'Daunne Temple Crest',
      chainage: 'Km 8 - 11',
      liveSpeedKmh: 11,
      normalSpeedKmh: 35,
      status: 'standstill',
      note: 'Mud ruts, steep gradient, crawling 10-wheeler trucks.',
    },
    {
      name: 'Dumkibas Descent',
      chainage: 'Km 11 - 14',
      liveSpeedKmh: 24,
      normalSpeedKmh: 45,
      status: 'heavy',
      note: 'Hairpin downhill corners; speed recovers approaching plains.',
    },
  ],
  'tr-mugling-abukhaireni': [
    {
      name: 'Mugling Bazar Hub',
      chainage: 'Km 0 - 3',
      liveSpeedKmh: 25,
      normalSpeedKmh: 45,
      status: 'heavy',
      note: 'Bridge approach congestion & intercity passenger stops.',
    },
    {
      name: 'Marshyangdi Bluffs',
      chainage: 'Km 3 - 7',
      liveSpeedKmh: 15,
      normalSpeedKmh: 50,
      status: 'heavy',
      note: 'Rock blasting widening area; periodic flagman holds.',
    },
    {
      name: 'Hydro Powerhouse Curve',
      chainage: 'Km 7 - 10',
      liveSpeedKmh: 18,
      normalSpeedKmh: 50,
      status: 'heavy',
      note: 'Heavy dumper truck movement and gravel surface.',
    },
    {
      name: 'Abukhaireni Gateway',
      chainage: 'Km 10 - 12',
      liveSpeedKmh: 30,
      normalSpeedKmh: 45,
      status: 'moderate',
      note: 'Transition back to smooth two-lane blacktop.',
    },
  ],
  'tr-nagdhunga': [
    {
      name: 'Khanikhola Valley Floor',
      chainage: 'Km 0 - 3',
      liveSpeedKmh: 34,
      normalSpeedKmh: 45,
      status: 'moderate',
      note: 'Inbound truck queuing along river bank.',
    },
    {
      name: 'Sisne Khola Tunnel Portal',
      chainage: 'Km 3 - 5',
      liveSpeedKmh: 22,
      normalSpeedKmh: 40,
      status: 'heavy',
      note: 'Slow hill-climb crawl; freight trucks moving under 20 km/h.',
    },
    {
      name: 'Nagdhunga Summit Checkpost',
      chainage: 'Km 5 - 8',
      liveSpeedKmh: 19,
      normalSpeedKmh: 35,
      status: 'heavy',
      note: 'Traffic Police inspection and freight weighing post.',
    },
  ],
  'tr-narayanghat-mugling': [
    {
      name: 'Aaptari (Bharatpur)',
      chainage: 'Km 0 - 10',
      liveSpeedKmh: 40,
      normalSpeedKmh: 55,
      status: 'moderate',
      note: 'Open river valley sector; steady flow.',
    },
    {
      name: 'Jalbire Gorge',
      chainage: 'Km 10 - 20',
      liveSpeedKmh: 30,
      normalSpeedKmh: 55,
      status: 'moderate',
      note: 'Narrow river canyon curves, caution near waterfall spray.',
    },
    {
      name: 'Tuin Khola Bridge Cut',
      chainage: 'Km 20 - 29',
      liveSpeedKmh: 14,
      normalSpeedKmh: 50,
      status: 'standstill',
      note: 'Active bridge construction; alternating one-way convoy.',
    },
    {
      name: 'Mugling South Approach',
      chainage: 'Km 29 - 36',
      liveSpeedKmh: 26,
      normalSpeedKmh: 50,
      status: 'heavy',
      note: 'Truck parking queues before highway junction.',
    },
  ],
  'tr-siddhababa': [
    {
      name: 'Chidiya Khola Gate',
      chainage: 'Km 0 - 2',
      liveSpeedKmh: 28,
      normalSpeedKmh: 45,
      status: 'moderate',
      note: 'Highway police warning post and vehicle staging.',
    },
    {
      name: 'Rock Shed Tunnel Project',
      chainage: 'Km 2 - 4',
      liveSpeedKmh: 15,
      normalSpeedKmh: 40,
      status: 'standstill',
      note: 'Construction zone; strict 20 km/h speed enforcement.',
    },
    {
      name: 'Dobhan Confluence',
      chainage: 'Km 4 - 6',
      liveSpeedKmh: 24,
      normalSpeedKmh: 45,
      status: 'moderate',
      note: 'Pavement graveling and wet mountain runoff.',
    },
  ],
  'tr-sindhuli-bp': [
    {
      name: 'Nepalthok River Run',
      chainage: 'Km 0 - 14',
      liveSpeedKmh: 38,
      normalSpeedKmh: 50,
      status: 'smooth',
      note: 'Wide river plain with smooth Japanese asphalt.',
    },
    {
      name: 'Khurkot Mountain Incline',
      chainage: 'Km 14 - 28',
      liveSpeedKmh: 29,
      normalSpeedKmh: 42,
      status: 'moderate',
      note: 'Hairpin switchbacks, microbus overtaking bottlenecks.',
    },
    {
      name: 'Sindhuli Crest Viewpoint',
      chainage: 'Km 28 - 42',
      liveSpeedKmh: 27,
      normalSpeedKmh: 40,
      status: 'moderate',
      note: 'Narrow serpentine ridge with sightseeing vehicle stops.',
    },
  ],
  'tr-chitwan-express': [
    {
      name: 'Kawasoti 4-Lane Sector',
      chainage: 'Km 0 - 12',
      liveSpeedKmh: 72,
      normalSpeedKmh: 70,
      status: 'smooth',
      note: 'Smooth divided highway; optimal free-flow conditions.',
    },
    {
      name: 'Chormara Bypass',
      chainage: 'Km 12 - 22',
      liveSpeedKmh: 67,
      normalSpeedKmh: 70,
      status: 'smooth',
      note: 'Bypass flyover clear of local town market congestion.',
    },
    {
      name: 'Bardaghat Eastern Link',
      chainage: 'Km 22 - 32',
      liveSpeedKmh: 64,
      normalSpeedKmh: 70,
      status: 'smooth',
      note: 'Approaching Daunne transition zone; deceleration required.',
    },
  ],
};

interface RealTimeTrafficFlowVisualizerProps {
  corridors: TrafficCorridor[];
  onSelectCorridor: (corridor: TrafficCorridor) => void;
  selectedCorridorId?: string | null;
}

export const RealTimeTrafficFlowVisualizer: React.FC<RealTimeTrafficFlowVisualizerProps> = ({
  corridors,
  onSelectCorridor,
  selectedCorridorId,
}) => {
  // Active states
  const [activeCorridorId, setActiveCorridorId] = useState<string>(
    selectedCorridorId || corridors[0]?.id || 'tr-daunne'
  );
  const [dayType, setDayType] = useState<DayProfileType>('weekday');
  const [visualizerMode, setVisualizerMode] = useState<'matrix' | 'timeline' | 'segments'>('matrix');
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [telemetryJitter, setTelemetryJitter] = useState<number>(0);

  // Hover tooltip state for D3
  const [d3Tooltip, setD3Tooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    metrics: Array<{ label: string; value: string; color?: string }>;
    note?: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    metrics: [],
  });

  // Current real-time hour (0 - 23)
  const currentHour = useMemo(() => {
    const h = new Date().getHours();
    return h >= 0 && h < 24 ? h : 11;
  }, []);

  // Update active corridor if prop changes
  useEffect(() => {
    if (selectedCorridorId) {
      setActiveCorridorId(selectedCorridorId);
    }
  }, [selectedCorridorId]);

  // Selected corridor object
  const selectedCorridor = useMemo(() => {
    return (
      corridors.find((c) => c.id === activeCorridorId) ||
      corridors[0]
    );
  }, [corridors, activeCorridorId]);

  // Jitter simulator (real-time telemetry live fluctuations)
  useEffect(() => {
    if (!isSimulatingLive) return;

    const interval = setInterval(() => {
      // Small realistic speed fluctuation (-2 to +2 km/h)
      const jitter = Math.sin(Date.now() / 3000) * 1.5;
      setTelemetryJitter(jitter);
      const now = new Date();
      setLastSyncTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [isSimulatingLive]);

  // Calculate live and historical metrics for each corridor
  const enrichedCorridors = useMemo(() => {
    return corridors.map((corridor) => {
      const trends =
        corridor.trends ||
        HISTORICAL_CORRIDOR_TRENDS[corridor.id] ||
        HISTORICAL_CORRIDOR_TRENDS['tr-daunne'];

      const hourlyList = trends.hourlyProfiles[dayType] || trends.hourlyProfiles.weekday;
      const hourTrend = hourlyList.find((h) => h.hour === currentHour) || hourlyList[10];

      // Live adjusted speed with telemetry jitter
      const baseLiveSpeed = corridor.avgSpeedKmh;
      const liveSpeed = Math.max(
        6,
        Math.round((baseLiveSpeed + (corridor.id === activeCorridorId ? telemetryJitter : 0)) * 10) / 10
      );

      const normalSpeed = corridor.normalSpeedKmh;
      const historicalExpectedSpeed = hourTrend.avgSpeedKmh;

      // Speed variance calculations
      const speedVarianceKmh = Math.round((liveSpeed - normalSpeed) * 10) / 10;
      const speedVariancePercent = Math.round(((liveSpeed - normalSpeed) / normalSpeed) * 100);
      const histSpeedVarianceKmh = Math.round((liveSpeed - historicalExpectedSpeed) * 10) / 10;

      // Flow efficiency ratio: 0 to 100%
      const flowEfficiency = Math.min(100, Math.max(10, Math.round((liveSpeed / normalSpeed) * 100)));

      // Delay impact
      const delayMinutes = corridor.delayMinutes;

      return {
        ...corridor,
        liveSpeed,
        normalSpeed,
        historicalExpectedSpeed,
        speedVarianceKmh,
        speedVariancePercent,
        histSpeedVarianceKmh,
        flowEfficiency,
        delayMinutes,
        hourTrend,
        trends,
      };
    });
  }, [corridors, dayType, currentHour, activeCorridorId, telemetryJitter]);

  // Overall network summary KPIs
  const networkKPIs = useMemo(() => {
    const totalCorridors = enrichedCorridors.length;
    if (totalCorridors === 0) return { avgVariance: 0, worstCorridor: null, totalDelay: 0, avgEfficiency: 0 };

    const sumVariance = enrichedCorridors.reduce((acc, c) => acc + c.speedVarianceKmh, 0);
    const avgVariance = Math.round((sumVariance / totalCorridors) * 10) / 10;

    const sumEfficiency = enrichedCorridors.reduce((acc, c) => acc + c.flowEfficiency, 0);
    const avgEfficiency = Math.round(sumEfficiency / totalCorridors);

    const totalDelay = enrichedCorridors.reduce((acc, c) => acc + c.delayMinutes, 0);

    // Sort by largest speed deficit
    const sortedWorst = [...enrichedCorridors].sort((a, b) => a.speedVariancePercent - b.speedVariancePercent);
    const worstCorridor = sortedWorst[0];

    // Best flow
    const bestCorridor = sortedWorst[sortedWorst.length - 1];

    return {
      avgVariance,
      avgEfficiency,
      totalDelay,
      worstCorridor,
      bestCorridor,
    };
  }, [enrichedCorridors]);

  // -------------------------------------------------------------
  // D3 REF & RENDERING: MULTI-CORRIDOR SPEED VARIANCE MATRIX (DIVERGENCE BARS)
  // -------------------------------------------------------------
  const matrixContainerRef = useRef<HTMLDivElement | null>(null);
  const matrixSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (visualizerMode !== 'matrix' || !matrixSvgRef.current || !matrixContainerRef.current) return;

    const container = matrixContainerRef.current;
    const svg = d3.select(matrixSvgRef.current);
    svg.selectAll('*').remove();

    const width = container.clientWidth || 600;
    const height = Math.max(340, enrichedCorridors.length * 52 + 50);
    svg.attr('width', width).attr('height', height);

    const margin = { top: 25, right: 90, bottom: 25, left: width < 480 ? 120 : 180 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Y Scale: Corridors
    const yScale = d3
      .scaleBand()
      .domain(enrichedCorridors.map((d) => d.id))
      .range([0, innerHeight])
      .padding(0.28);

    // X Scale: Speed Variance (Δ km/h) - from lowest negative (e.g. -45 km/h) to +10 km/h
    const minVar = Math.min(-45, ...enrichedCorridors.map((d) => d.speedVarianceKmh));
    const maxVar = 10;
    const xScale = d3.scaleLinear().domain([minVar, maxVar]).range([0, innerWidth]);

    // Zero line (Normal Speed reference line)
    const zeroX = xScale(0);

    // Subtle background grid lines
    const xTicks = [-40, -30, -20, -10, 0];
    g.selectAll('.grid-line')
      .data(xTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', (d) => (d === 0 ? '#10b981' : '#334155'))
      .attr('stroke-width', (d) => (d === 0 ? 1.5 : 0.8))
      .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3,3'))
      .attr('opacity', (d) => (d === 0 ? 0.8 : 0.4));

    // Zero line label at top
    g.append('text')
      .attr('x', zeroX)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#10b981')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text('0 (Design Speed)');

    // X axis ticks
    g.selectAll('.tick-label')
      .data(xTicks.filter((d) => d !== 0))
      .enter()
      .append('text')
      .attr('class', 'tick-label')
      .attr('x', (d) => xScale(d))
      .attr('y', innerHeight + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => `${d} km/h`);

    // Render Corridor Rows
    enrichedCorridors.forEach((item) => {
      const y = yScale(item.id) || 0;
      const rowHeight = yScale.bandwidth();
      const isSelected = item.id === activeCorridorId;

      const rowG = g
        .append('g')
        .attr('class', `corridor-row-${item.id}`)
        .style('cursor', 'pointer')
        .on('click', () => {
          setActiveCorridorId(item.id);
          onSelectCorridor(item);
        })
        .on('mouseenter', (event) => {
          const [mx, my] = d3.pointer(event, container);
          setD3Tooltip({
            visible: true,
            x: mx,
            y: my,
            title: `${item.highwayCode} - ${item.name}`,
            metrics: [
              { label: 'Live Telemetry Speed', value: `${item.liveSpeed} km/h`, color: '#38bdf8' },
              { label: 'Normal Free-Flow', value: `${item.normalSpeed} km/h`, color: '#94a3b8' },
              { label: 'Speed Variance', value: `${item.speedVarianceKmh} km/h (${item.speedVariancePercent}%)`, color: item.speedVarianceKmh < -20 ? '#f43f5e' : '#fbbf24' },
              { label: 'Transit Delay', value: `+${item.delayMinutes} mins`, color: item.delayMinutes > 0 ? '#f43f5e' : '#10b981' },
              { label: 'Flow Efficiency', value: `${item.flowEfficiency}%`, color: '#10b981' },
            ],
            note: item.cause,
          });
        })
        .on('mousemove', (event) => {
          const [mx, my] = d3.pointer(event, container);
          setD3Tooltip((prev) => ({ ...prev, x: mx, y: my }));
        })
        .on('mouseleave', () => {
          setD3Tooltip((prev) => ({ ...prev, visible: false }));
        });

      // Row background hover highlight
      rowG
        .append('rect')
        .attr('x', -margin.left + 5)
        .attr('y', y - 4)
        .attr('width', width - 10)
        .attr('height', rowHeight + 8)
        .attr('rx', 6)
        .attr('fill', isSelected ? '#0f172a' : 'transparent')
        .attr('stroke', isSelected ? '#f59e0b' : 'transparent')
        .attr('stroke-width', 1)
        .attr('opacity', isSelected ? 0.9 : 0);

      // Corridor Label (Left of chart)
      const labelText = rowG
        .append('text')
        .attr('x', -12)
        .attr('y', y + rowHeight / 2 - 2)
        .attr('text-anchor', 'end')
        .attr('font-size', '11px')
        .attr('font-weight', isSelected ? '800' : '600')
        .attr('fill', isSelected ? '#f59e0b' : '#f1f5f9');

      labelText.append('tspan').text(width < 480 ? item.highwayCode : `${item.highwayCode} `).attr('font-weight', 'bold');
      if (width >= 480) {
        labelText
          .append('tspan')
          .text(item.name.split('(')[0].trim().slice(0, 16))
          .attr('fill', isSelected ? '#fef08a' : '#94a3b8')
          .attr('font-weight', 'normal')
          .attr('font-size', '10px');
      }

      // Sub-label for live speed
      rowG
        .append('text')
        .attr('x', -12)
        .attr('y', y + rowHeight / 2 + 11)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('fill', isSelected ? '#fbbf24' : '#64748b')
        .text(`${item.liveSpeed} km/h (norm ${item.normalSpeed})`);

      // Variance Bar (Divergence from zeroX)
      const barX = Math.min(zeroX, xScale(item.speedVarianceKmh));
      const barWidth = Math.max(3, Math.abs(zeroX - xScale(item.speedVarianceKmh)));

      // Color coding for variance
      let barFill = '#10b981'; // green (slight/no drop)
      let barStroke = '#34d399';
      if (item.speedVariancePercent <= -60) {
        barFill = '#e11d48'; // crimson standstill
        barStroke = '#fda4af';
      } else if (item.speedVariancePercent <= -35) {
        barFill = '#f97316'; // orange heavy
        barStroke = '#fdba74';
      } else if (item.speedVariancePercent <= -15) {
        barFill = '#eab308'; // yellow moderate
        barStroke = '#fde047';
      }

      // Bar rectangle with smooth transition
      rowG
        .append('rect')
        .attr('x', barX)
        .attr('y', y + 3)
        .attr('width', barWidth)
        .attr('height', rowHeight - 6)
        .attr('rx', 4)
        .attr('fill', barFill)
        .attr('opacity', 0.85)
        .attr('stroke', barStroke)
        .attr('stroke-width', 0.7);

      // Historical Benchmark Marker (Diamond / Tick on the bar)
      const histVar = item.historicalExpectedSpeed - item.normalSpeed;
      const histX = xScale(histVar);
      rowG
        .append('line')
        .attr('x1', histX)
        .attr('x2', histX)
        .attr('y1', y)
        .attr('y2', y + rowHeight)
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.9);

      // Live Speed Point (Pulsating Circle at the live variance point)
      const livePointX = xScale(item.speedVarianceKmh);
      rowG
        .append('circle')
        .attr('cx', livePointX)
        .attr('cy', y + rowHeight / 2)
        .attr('r', 4)
        .attr('fill', '#ffffff')
        .attr('stroke', barFill)
        .attr('stroke-width', 2);

      // Live Velocity Flow Line Animation (Simulated animated particle dashes)
      // Faster stroke-dashoffset animation for high speeds, slow for low speeds
      const animSpeedSec = Math.max(0.4, (80 - item.liveSpeed) / 18);
      const flowLine = rowG
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y + rowHeight - 2)
        .attr('y2', y + rowHeight - 2)
        .attr('stroke', barFill)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4, 8')
        .attr('opacity', 0.45)
        .style('animation', `d3FlowStream ${animSpeedSec}s linear infinite`);

      // Variance % Badge on the right
      rowG
        .append('text')
        .attr('x', innerWidth + 12)
        .attr('y', y + rowHeight / 2 + 3)
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .attr('fill', item.speedVarianceKmh < 0 ? (item.speedVariancePercent <= -50 ? '#f43f5e' : '#fbbf24') : '#10b981')
        .text(`${item.speedVariancePercent > 0 ? '+' : ''}${item.speedVariancePercent}%`);
    });
  }, [visualizerMode, enrichedCorridors, activeCorridorId, onSelectCorridor]);

  // -------------------------------------------------------------
  // D3 REF & RENDERING: 24-HOUR CORRIDOR SPEED HORIZON & VELOCITY RIBBON
  // -------------------------------------------------------------
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (visualizerMode !== 'timeline' || !timelineSvgRef.current || !timelineContainerRef.current) return;

    const container = timelineContainerRef.current;
    const svg = d3.select(timelineSvgRef.current);
    svg.selectAll('*').remove();

    const width = container.clientWidth || 600;
    const height = 280;
    svg.attr('width', width).attr('height', height);

    const margin = { top: 25, right: 35, bottom: 35, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Trend profile for selected corridor
    const trend =
      selectedCorridor.trends ||
      HISTORICAL_CORRIDOR_TRENDS[selectedCorridor.id] ||
      HISTORICAL_CORRIDOR_TRENDS['tr-daunne'];

    const hourlyList = trend.hourlyProfiles[dayType] || trend.hourlyProfiles.weekday;

    // Normal speed
    const normalSpeed = selectedCorridor.normalSpeedKmh;

    // Construct live profile by mapping historical data and pinning current hour to live telemetry
    const liveHourlyProfile = hourlyList.map((h) => {
      // If within +/- 1 hour of current hour, interpolate towards live speed
      const diffFromCurrent = Math.abs(h.hour - currentHour);
      let speed = h.avgSpeedKmh;

      if (diffFromCurrent === 0) {
        speed = selectedCorridor.avgSpeedKmh + telemetryJitter;
      } else if (diffFromCurrent === 1) {
        speed = h.avgSpeedKmh * 0.4 + (selectedCorridor.avgSpeedKmh + telemetryJitter) * 0.6;
      }

      return {
        ...h,
        liveSpeed: Math.max(6, Math.round(speed)),
      };
    });

    // Scales
    const xScale = d3.scaleLinear().domain([0, 23]).range([0, innerWidth]);

    const maxSpeedVal = Math.max(normalSpeed * 1.15, ...liveHourlyProfile.map((d) => d.avgSpeedKmh), 60);
    const yScale = d3.scaleLinear().domain([0, maxSpeedVal]).range([innerHeight, 0]);

    // Gradient definitions for Speed Deficit Area
    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'speed-deficit-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.4);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.03);

    // Flow line gradient
    const lineGradient = defs
      .append('linearGradient')
      .attr('id', 'live-speed-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    lineGradient.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8');
    lineGradient.append('stop').attr('offset', `${(currentHour / 24) * 100}%`).attr('stop-color', '#f59e0b');
    lineGradient.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8');

    // Horizontal Y Grid lines
    const yTicks = yScale.ticks(5);
    g.selectAll('.y-grid')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('class', 'y-grid')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.7)
      .attr('stroke-dasharray', '2,3')
      .attr('opacity', 0.4);

    // Y Axis Labels
    g.selectAll('.y-label')
      .data(yTicks)
      .enter()
      .append('text')
      .attr('class', 'y-label')
      .attr('x', -8)
      .attr('y', (d) => yScale(d) + 3)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => `${d}`);

    // X Axis Labels (Every 3 hours: 0, 3, 6, 9, 12, 15, 18, 21)
    const xHourTicks = [0, 3, 6, 9, 12, 15, 18, 21];
    g.selectAll('.x-label')
      .data(xHourTicks)
      .enter()
      .append('text')
      .attr('class', 'x-label')
      .attr('x', (d) => xScale(d))
      .attr('y', innerHeight + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => {
        if (d === 0) return '12 AM';
        if (d === 12) return '12 PM';
        return d > 12 ? `${d - 12} PM` : `${d} AM`;
      });

    // Reference Line: Normal Design Speed
    const normalY = yScale(normalSpeed);
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', normalY)
      .attr('y2', normalY)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.8);

    g.append('text')
      .attr('x', innerWidth - 4)
      .attr('y', normalY - 6)
      .attr('text-anchor', 'end')
      .attr('fill', '#10b981')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text(`Design Free-Flow: ${normalSpeed} km/h`);

    // Speed Deficit Area Generator (between Normal Speed and Live Speed)
    const deficitArea = d3
      .area<any>()
      .x((d) => xScale(d.hour))
      .y0((d) => yScale(normalSpeed))
      .y1((d) => yScale(Math.min(normalSpeed, d.liveSpeed)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(liveHourlyProfile)
      .attr('fill', 'url(#speed-deficit-gradient)')
      .attr('d', deficitArea);

    // Line Generator: Historical Baseline Speed
    const historicalLine = d3
      .line<any>()
      .x((d) => xScale(d.hour))
      .y((d) => yScale(d.avgSpeedKmh))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(liveHourlyProfile)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7)
      .attr('d', historicalLine);

    // Line Generator: Live Speed Profile
    const liveLine = d3
      .line<any>()
      .x((d) => xScale(d.hour))
      .y((d) => yScale(d.liveSpeed))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(liveHourlyProfile)
      .attr('fill', 'none')
      .attr('stroke', 'url(#live-speed-gradient)')
      .attr('stroke-width', 2.8)
      .attr('d', liveLine);

    // Current Hour Scrubber & Live Telemetry Marker
    const currentX = xScale(currentHour);
    const currentLiveSpeed = liveHourlyProfile[currentHour]?.liveSpeed || selectedCorridor.avgSpeedKmh;
    const currentY = yScale(currentLiveSpeed);

    // Vertical line through current hour
    g.append('line')
      .attr('x1', currentX)
      .attr('x2', currentX)
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.85);

    // Radar pulse ring at current point
    g.append('circle')
      .attr('cx', currentX)
      .attr('cy', currentY)
      .attr('r', 9)
      .attr('fill', '#f59e0b')
      .attr('opacity', 0.25)
      .attr('class', 'animate-ping');

    g.append('circle')
      .attr('cx', currentX)
      .attr('cy', currentY)
      .attr('r', 5)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Label on current live point
    g.append('text')
      .attr('x', currentX)
      .attr('y', currentY - 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text(`${currentLiveSpeed} km/h (NOW)`);

    // Interactive Hover Tracking Bar / Overlay
    const bisectHour = d3.bisector((d: any) => d.hour).center;
    const hoverLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0);

    const hoverDot = g.append('circle').attr('r', 4.5).attr('fill', '#38bdf8').style('opacity', 0);

    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const hourFloat = xScale.invert(mx);
        const idx = Math.max(0, Math.min(23, Math.round(hourFloat)));
        const d = liveHourlyProfile[idx];
        if (!d) return;

        const xPos = xScale(d.hour);
        const yPos = yScale(d.liveSpeed);

        hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 0.8);
        hoverDot.attr('cx', xPos).attr('cy', yPos).style('opacity', 1);

        const containerRect = container.getBoundingClientRect();
        const tooltipX = event.clientX - containerRect.left;
        const tooltipY = event.clientY - containerRect.top;

        const deltaKmh = d.liveSpeed - normalSpeed;
        const deltaPercent = Math.round((deltaKmh / normalSpeed) * 100);

        setD3Tooltip({
          visible: true,
          x: tooltipX,
          y: tooltipY,
          title: `${d.label} - ${selectedCorridor.name}`,
          metrics: [
            { label: 'Speed Profile', value: `${d.liveSpeed} km/h`, color: '#38bdf8' },
            { label: 'Historical Benchmark', value: `${d.avgSpeedKmh} km/h`, color: '#94a3b8' },
            { label: 'Variance vs Normal', value: `${deltaKmh} km/h (${deltaPercent}%)`, color: deltaKmh < -15 ? '#f43f5e' : '#fbbf24' },
            { label: 'Estimated Transit Time', value: `${d.travelTimeMinutes} mins`, color: '#cbd5e1' },
          ],
          note: d.advisoryNote,
        });
      })
      .on('mouseleave', () => {
        hoverLine.style('opacity', 0);
        hoverDot.style('opacity', 0);
        setD3Tooltip((prev) => ({ ...prev, visible: false }));
      });
  }, [visualizerMode, selectedCorridor, dayType, currentHour, telemetryJitter]);

  // Sub-segments for the active corridor
  const activeSegments = useMemo(() => {
    return CORRIDOR_SEGMENTS[activeCorridorId] || CORRIDOR_SEGMENTS['tr-daunne'];
  }, [activeCorridorId]);

  return (
    <div className="space-y-4 text-slate-100 max-w-full overflow-x-hidden" id="real-time-traffic-flow-root">
      {/* CSS Animation for SVG Flow Dash Stream */}
      <style>{`
        @keyframes d3FlowStream {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Top Telemetry Header Bar */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Real-Time Traffic Flow & Speed Variances</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>D3 TELEMETRY</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                DoR sensor benchmarks vs live highway velocity • Synced: {lastSyncTime}
              </p>
            </div>
          </div>

          {/* Telemetry Controls (Simulation toggle & refresh) */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto">
            <button
              onClick={() => {
                setTelemetryJitter(Math.random() * 4 - 2);
                const now = new Date();
                setLastSyncTime(
                  now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                );
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1"
              title="Ping Telemetry Stream"
            >
              <RefreshCw className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px]">Ping Stream</span>
            </button>

            <button
              onClick={() => setIsSimulatingLive(!isSimulatingLive)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 border ${
                isSimulatingLive
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={isSimulatingLive ? 'Live Simulation Running' : 'Resume Live Updates'}
            >
              <Radio className={`w-3 h-3 ${isSimulatingLive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-[11px]">{isSimulatingLive ? 'Live Active' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* Day Profile Switcher */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px] font-medium flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Historical Day Baseline:</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'weekday', label: 'Weekday' },
                { id: 'friday', label: 'Friday Rush' },
                { id: 'saturday', label: 'Saturday Weekend' },
                { id: 'festival', label: 'Festival Surge' },
              ] as const
            ).map((day) => (
              <button
                key={day.id}
                onClick={() => setDayType(day.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  dayType === day.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Network KPI Metric Blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Network Variance</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div
            className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
              networkKPIs.avgVariance < -15 ? 'text-rose-400' : 'text-amber-400'
            }`}
          >
            {networkKPIs.avgVariance > 0 ? `+${networkKPIs.avgVariance}` : networkKPIs.avgVariance} km/h
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Vs design capacity speed</p>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Flow Efficiency</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 text-emerald-300">
            {networkKPIs.avgEfficiency}%
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Live velocity efficiency ratio</p>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Severe Chokepoint</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xs font-bold text-white mt-1 truncate">
            {networkKPIs.worstCorridor ? networkKPIs.worstCorridor.highwayCode : 'None'}
          </div>
          <p className="text-[10px] text-rose-400 mt-0.5 font-mono">
            {networkKPIs.worstCorridor ? `${networkKPIs.worstCorridor.speedVariancePercent}% variance` : 'Nominal'}
          </p>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Total Network Delay</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono mt-0.5 text-amber-300">
            +{networkKPIs.totalDelay}m
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Across 7 primary corridors</p>
        </div>
      </div>

      {/* Visualizer Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setVisualizerMode('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              visualizerMode === 'matrix'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>All Corridors Variance (D3)</span>
          </button>

          <button
            onClick={() => setVisualizerMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              visualizerMode === 'timeline'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>24h Velocity Ribbon (D3)</span>
          </button>

          <button
            onClick={() => setVisualizerMode('segments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              visualizerMode === 'segments'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chokepoint Segments</span>
          </button>
        </div>

        {/* Selected Corridor indicator */}
        <div className="text-[11px] text-slate-400 flex items-center space-x-1 font-mono pr-2">
          <span>Active:</span>
          <span className="text-amber-400 font-bold">{selectedCorridor.highwayCode}</span>
        </div>
      </div>

      {/* Corridor Selection Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {enrichedCorridors.map((c) => {
          const isSelected = c.id === activeCorridorId;
          const isSevere = c.speedVariancePercent <= -40;

          return (
            <button
              key={c.id}
              onClick={() => {
                setActiveCorridorId(c.id);
                onSelectCorridor(c);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center space-x-1.5 text-xs ${
                isSelected
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/60 ring-1 ring-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSevere ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`}></span>
              <span>{c.highwayCode}</span>
              <span className="font-mono text-[10px] text-slate-400">({c.liveSpeed} km/h)</span>
            </button>
          );
        })}
      </div>

      {/* VISUALIZER VIEW 1: D3 ALL-CORRIDORS VARIANCE DIVERGENCE SPECTRUM */}
      {visualizerMode === 'matrix' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-3 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                <span>Speed Variance Spectrum (Δ km/h Deficit from Design Speed)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Divergence bars showing live telemetry velocity loss across national highway corridors
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400 self-start sm:self-auto">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                <span>Smooth</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                <span>Moderate</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
                <span>Critical</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full border border-sky-400 bg-sky-400"></span>
                <span>Hist. Benchmark</span>
              </span>
            </div>
          </div>

          {/* D3 Canvas Container */}
          <div ref={matrixContainerRef} className="w-full relative min-h-[340px] overflow-hidden">
            <svg ref={matrixSvgRef} className="w-full h-auto select-none" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span>Click any corridor to view detailed 24h speed ribbon and road segment bottlenecks.</span>
            <button
              onClick={() => onSelectCorridor(selectedCorridor)}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 transition"
            >
              <span>Focus {selectedCorridor.highwayCode} on Map</span>
              <Navigation className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* VISUALIZER VIEW 2: D3 24-HOUR VELOCITY RIBBON (DEEP DIVE) */}
      {visualizerMode === 'timeline' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-3 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                <span>{selectedCorridor.name} — 24-Hour Velocity Ribbon</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Live speed flow vs historical baseline. Red shaded area highlights the Congestion Deficit Zone.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400 self-start sm:self-auto">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-0.5 bg-emerald-400"></span>
                <span>Design Speed</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed border-sky-400"></span>
                <span>Hist. Mean</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-1 bg-amber-400 rounded"></span>
                <span>Live Telemetry</span>
              </span>
            </div>
          </div>

          {/* D3 Canvas Container */}
          <div ref={timelineContainerRef} className="w-full relative min-h-[280px] overflow-hidden">
            <svg ref={timelineSvgRef} className="w-full h-auto select-none" />
          </div>

          {/* Current Corridor Breakdown Card */}
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block">Current Velocity</span>
              <span className="text-sm font-bold text-amber-300">{selectedCorridor.avgSpeedKmh} km/h</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Design Free-Flow</span>
              <span className="text-sm font-bold text-emerald-400">{selectedCorridor.normalSpeedKmh} km/h</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Transit Delay</span>
              <span className="text-sm font-bold text-rose-400">+{selectedCorridor.delayMinutes} mins</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Efficiency Ratio</span>
              <span className="text-sm font-bold text-cyan-400">
                {Math.round((selectedCorridor.avgSpeedKmh / selectedCorridor.normalSpeedKmh) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZER VIEW 3: CORRIDOR PHYSICAL CHOKEPOINT SEGMENTS */}
      {visualizerMode === 'segments' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                <span>{selectedCorridor.name} — Segment Velocity Breakdown</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Physical road subsections showing where velocity bottlenecks occur
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {activeSegments.length} Segments
            </span>
          </div>

          {/* Segment List */}
          <div className="space-y-2">
            {activeSegments.map((seg, idx) => {
              const speedDeficit = seg.liveSpeedKmh - seg.normalSpeedKmh;
              const percentLoss = Math.round((speedDeficit / seg.normalSpeedKmh) * 100);
              const isBottleneck = percentLoss <= -40;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition ${
                    isBottleneck
                      ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-white">{seg.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">({seg.chainage})</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="text-slate-300 font-bold">
                        {seg.liveSpeedKmh} <span className="text-[10px] text-slate-500">/ {seg.normalSpeedKmh} km/h</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          percentLoss <= -40
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : percentLoss <= -15
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {percentLoss}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 pl-7 flex items-center space-x-1.5">
                    <Info className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{seg.note}</span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onSelectCorridor(selectedCorridor)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Inspect {selectedCorridor.name.split('(')[0].trim()} on Map</span>
            </button>
          </div>
        </div>
      )}

      {/* FLOATING D3 HOVER TOOLTIP */}
      {d3Tooltip.visible && (
        <div
          className="pointer-events-none absolute z-50 bg-slate-950/95 border border-slate-700 shadow-2xl rounded-xl p-3 text-xs text-slate-100 max-w-[280px] backdrop-blur-md transition-opacity duration-150"
          style={{
            left: `${Math.min(window.innerWidth - 300, Math.max(10, d3Tooltip.x + 15))}px`,
            top: `${Math.max(10, d3Tooltip.y - 30)}px`,
          }}
        >
          <div className="font-bold text-amber-400 border-b border-slate-800 pb-1.5 mb-1.5 text-[11px] flex items-center space-x-1.5">
            <Activity className="w-3 h-3" />
            <span className="truncate">{d3Tooltip.title}</span>
          </div>
          <div className="space-y-1 font-mono text-[10px]">
            {d3Tooltip.metrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-slate-400">{m.label}:</span>
                <span className="font-bold" style={{ color: m.color || '#f1f5f9' }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
          {d3Tooltip.note && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 font-sans italic">
              {d3Tooltip.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
