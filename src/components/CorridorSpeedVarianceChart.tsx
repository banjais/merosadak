import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { TrafficCorridor, DayProfileType, TrafficLevel } from '../types';
import { HISTORICAL_CORRIDOR_TRENDS } from '../data/travelTimeTrendsData';
import {
  Activity,
  Gauge,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Calendar,
  Sparkles,
  Layers,
  Info,
  Zap,
  ChevronRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export interface SpeedVarianceDataPoint {
  index: number;
  label: string; // e.g., "08:00 (8 AM)" or "Km 12 (Jalbire)"
  subLabel?: string;
  historicalSpeedKmh: number;
  realTimeSpeedKmh: number;
  normalSpeedKmh: number;
  varianceKmh: number; // realTime - historical
  variancePercent: number; // ((realTime - historical) / historical) * 100
  level: TrafficLevel;
  delayMinutes: number;
  advisory: string;
  isCurrent?: boolean;
}

interface CorridorSpeedVarianceChartProps {
  selectedCorridor: TrafficCorridor;
  allCorridors?: TrafficCorridor[];
  onSelectCorridor?: (corridor: TrafficCorridor) => void;
  dayType?: DayProfileType;
  onDayTypeChange?: (day: DayProfileType) => void;
}

// Sub-segment breakdown for distance-based chainage view
const CORRIDOR_CHAINAGE_PROFILES: Record<
  string,
  { name: string; km: number; historicalSpeed: number; realTimeSpeed: number; note: string }[]
> = {
  'tr-daunne': [
    { name: 'Bardaghat Foothills', km: 0, historicalSpeed: 42, realTimeSpeed: 36, note: 'Approaching hill incline; freight truck queue' },
    { name: 'Khursani Khola Ascent', km: 3, historicalSpeed: 38, realTimeSpeed: 24, note: 'Early switchback bends; climbing heavy vehicles' },
    { name: 'East Ridge Excavation', km: 6, historicalSpeed: 32, realTimeSpeed: 9, note: 'ADB highway 4-lane widening cliff cut; single-lane alternating stoppages' },
    { name: 'Daunne Temple Crest', km: 9, historicalSpeed: 30, realTimeSpeed: 11, note: 'Mud ruts, steep gradient, crawling 10-wheeler trucks' },
    { name: 'Ghyampesal Hairpins', km: 11, historicalSpeed: 35, realTimeSpeed: 18, note: 'Downhill hairpins, gravel surface' },
    { name: 'Dumkibas Plains Gateway', km: 14, historicalSpeed: 45, realTimeSpeed: 32, note: 'Approaching plains, speed recovers steadily' }
  ],
  'tr-mugling-abukhaireni': [
    { name: 'Mugling Bridge Hub', km: 0, historicalSpeed: 45, realTimeSpeed: 25, note: 'Bridge approach congestion & junction stops' },
    { name: 'Marshyangdi Bluffs', km: 4, historicalSpeed: 48, realTimeSpeed: 15, note: 'Rock blasting widening area; periodic flagman holds' },
    { name: 'Powerhouse Curve', km: 7, historicalSpeed: 46, realTimeSpeed: 18, note: 'Heavy dumper truck movement and rough gravel surface' },
    { name: 'Markichok Quarry Zone', km: 9, historicalSpeed: 48, realTimeSpeed: 24, note: 'Heavy construction vehicles crossing' },
    { name: 'Abukhaireni Gateway', km: 12, historicalSpeed: 46, realTimeSpeed: 34, note: 'Transition back to smooth two-lane blacktop' }
  ],
  'tr-nagdhunga': [
    { name: 'Khanikhola Valley Floor', km: 0, historicalSpeed: 42, realTimeSpeed: 34, note: 'Inbound truck queuing along river bank' },
    { name: 'Jhapre Khola S-Bends', km: 2, historicalSpeed: 38, realTimeSpeed: 28, note: 'Steep hill incline starting' },
    { name: 'Sisne Khola Tunnel Portal', km: 5, historicalSpeed: 35, realTimeSpeed: 20, note: 'Slow hill-climb crawl; freight trucks moving under 20 km/h' },
    { name: 'Khatripauwa Curve', km: 6.5, historicalSpeed: 32, realTimeSpeed: 16, note: 'Single-lane bottleneck due to drainage repair' },
    { name: 'Nagdhunga Summit Checkpost', km: 8, historicalSpeed: 30, realTimeSpeed: 14, note: 'Traffic Police inspection and freight weighing post' }
  ],
  'tr-narayanghat-mugling': [
    { name: 'Aaptari (Bharatpur)', km: 0, historicalSpeed: 52, realTimeSpeed: 44, note: 'Open river valley sector; steady flow' },
    { name: 'Jugedi Bazaar', km: 9, historicalSpeed: 50, realTimeSpeed: 40, note: 'Local market traffic and tea stalls' },
    { name: 'Dasdhunga Memorial Cut', km: 16, historicalSpeed: 52, realTimeSpeed: 36, note: 'River bluffs; moderate curvature' },
    { name: 'Jalbire Gorge', km: 22, historicalSpeed: 48, realTimeSpeed: 30, note: 'Narrow river canyon curves, caution near waterfall spray' },
    { name: 'Tuin Khola Bridge Cut', km: 29, historicalSpeed: 46, realTimeSpeed: 14, note: 'Active bridge construction; alternating one-way convoy' },
    { name: 'Mugling South Approach', km: 36, historicalSpeed: 45, realTimeSpeed: 26, note: 'Truck parking queues before highway junction' }
  ],
  'tr-siddhababa': [
    { name: 'Chidiya Khola Gate', km: 0, historicalSpeed: 38, realTimeSpeed: 32, note: 'Entrance to Tinau gorge rock shed construction zone' },
    { name: 'Tinau River S-Curves', km: 2, historicalSpeed: 34, realTimeSpeed: 22, note: 'Single-lane rock tunnel scaffolding' },
    { name: 'Rock Shed Tunnel Project', km: 4, historicalSpeed: 30, realTimeSpeed: 15, note: 'Major rockfall protection tunnel works; alternating holds' },
    { name: 'Dobhan Suspension Junction', km: 6, historicalSpeed: 36, realTimeSpeed: 28, note: 'Transition to Palpa mountain grade' }
  ]
};

export const CorridorSpeedVarianceChart: React.FC<CorridorSpeedVarianceChartProps> = ({
  selectedCorridor,
  allCorridors,
  onSelectCorridor,
  dayType: externalDayType,
  onDayTypeChange,
}) => {
  const [internalDayType, setInternalDayType] = useState<DayProfileType>('weekday');
  const dayType = externalDayType || internalDayType;
  const setDayType = onDayTypeChange || setInternalDayType;

  // View dimension: 24h Timeline vs Distance Chainage (Km)
  const [viewDimension, setViewDimension] = useState<'timeline' | 'chainage'>('timeline');

  // Chart feature visibility toggles
  const [showVarianceArea, setShowVarianceArea] = useState<boolean>(true);
  const [showNormalBenchmark, setShowNormalBenchmark] = useState<boolean>(true);

  // Hover state for interactive tooltip and highlight
  const [hoveredPoint, setHoveredPoint] = useState<SpeedVarianceDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // References for D3 rendering
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Current system hour
  const currentHour = useMemo(() => {
    const h = new Date().getHours();
    return h >= 0 && h < 24 ? h : 11;
  }, []);

  // Retrieve historical trend data for selected corridor
  const trendProfile = useMemo(() => {
    return (
      selectedCorridor.trends ||
      HISTORICAL_CORRIDOR_TRENDS[selectedCorridor.id] ||
      HISTORICAL_CORRIDOR_TRENDS['tr-daunne']
    );
  }, [selectedCorridor]);

  // Construct data points based on viewDimension
  const dataPoints: SpeedVarianceDataPoint[] = useMemo(() => {
    if (viewDimension === 'timeline') {
      const hourlyList = trendProfile.hourlyProfiles[dayType] || trendProfile.hourlyProfiles.weekday;

      return hourlyList.map((h, idx) => {
        const isCurrent = h.hour === currentHour;
        const diffFromCurrent = Math.abs(h.hour - currentHour);

        // Derive authentic real-time telemetry speed:
        // Pinned to selectedCorridor.avgSpeedKmh at currentHour, smoothly interpolating to earlier/future hours
        let realTimeSpeed = h.avgSpeedKmh;
        if (diffFromCurrent === 0) {
          realTimeSpeed = selectedCorridor.avgSpeedKmh;
        } else if (diffFromCurrent === 1) {
          realTimeSpeed = Math.round(h.avgSpeedKmh * 0.35 + selectedCorridor.avgSpeedKmh * 0.65);
        } else if (diffFromCurrent === 2) {
          realTimeSpeed = Math.round(h.avgSpeedKmh * 0.6 + selectedCorridor.avgSpeedKmh * 0.4);
        } else if (diffFromCurrent <= 4) {
          // Congestion propagation window
          const weight = (5 - diffFromCurrent) * 0.12;
          realTimeSpeed = Math.round(h.avgSpeedKmh * (1 - weight) + selectedCorridor.avgSpeedKmh * weight);
        }

        // Clamp minimum realistic mountain crawling speed
        realTimeSpeed = Math.max(6, Math.min(80, realTimeSpeed));

        const historicalSpeed = h.avgSpeedKmh;
        const varianceKmh = realTimeSpeed - historicalSpeed;
        const variancePercent = historicalSpeed > 0 ? Math.round((varianceKmh / historicalSpeed) * 100) : 0;

        let level: TrafficLevel = 'smooth';
        if (realTimeSpeed <= 15) level = 'standstill';
        else if (realTimeSpeed <= 25) level = 'heavy';
        else if (realTimeSpeed <= 38) level = 'moderate';

        return {
          index: idx,
          label: `${h.label} (${String(h.hour).padStart(2, '0')}:00)`,
          subLabel: isCurrent ? 'Live Telemetry Right Now' : h.hour < currentHour ? 'Past Monitored Hour' : 'Projected Forecast',
          historicalSpeedKmh: historicalSpeed,
          realTimeSpeedKmh: realTimeSpeed,
          normalSpeedKmh: selectedCorridor.normalSpeedKmh,
          varianceKmh,
          variancePercent,
          level,
          delayMinutes: Math.max(0, Math.round(((historicalSpeed - realTimeSpeed) / Math.max(10, historicalSpeed)) * 30)),
          advisory: h.advisoryNote || (varianceKmh < -15 ? 'Significant transit slowdown reported by field probes.' : 'Nominal corridor transit flow.'),
          isCurrent,
        };
      });
    } else {
      // Chainage distance view
      const chainageList =
        CORRIDOR_CHAINAGE_PROFILES[selectedCorridor.id] ||
        CORRIDOR_CHAINAGE_PROFILES['tr-daunne'];

      return chainageList.map((pt, idx) => {
        const historicalSpeed = pt.historicalSpeed;
        const realTimeSpeed = pt.realTimeSpeed;
        const varianceKmh = realTimeSpeed - historicalSpeed;
        const variancePercent = historicalSpeed > 0 ? Math.round((varianceKmh / historicalSpeed) * 100) : 0;

        let level: TrafficLevel = 'smooth';
        if (realTimeSpeed <= 15) level = 'standstill';
        else if (realTimeSpeed <= 25) level = 'heavy';
        else if (realTimeSpeed <= 38) level = 'moderate';

        return {
          index: idx,
          label: `${pt.name} (Km ${pt.km})`,
          subLabel: `Chainage distance: ${pt.km} km from corridor origin`,
          historicalSpeedKmh: historicalSpeed,
          realTimeSpeedKmh: realTimeSpeed,
          normalSpeedKmh: selectedCorridor.normalSpeedKmh,
          varianceKmh,
          variancePercent,
          level,
          delayMinutes: Math.max(0, Math.round(((historicalSpeed - realTimeSpeed) / Math.max(10, historicalSpeed)) * 15)),
          advisory: pt.note,
          isCurrent: idx === 2, // Highlight primary choke point
        };
      });
    }
  }, [viewDimension, trendProfile, dayType, currentHour, selectedCorridor]);

  // Key metrics calculated across data points
  const summaryMetrics = useMemo(() => {
    if (!dataPoints.length) return null;

    // Current hour / focal point
    const currentPoint = dataPoints.find((p) => p.isCurrent) || dataPoints[0];

    // Point with largest negative variance (worst slowdown)
    const worstPoint = [...dataPoints].sort((a, b) => a.varianceKmh - b.varianceKmh)[0];

    // Point with highest speed / best flow
    const bestPoint = [...dataPoints].sort((a, b) => b.realTimeSpeedKmh - a.realTimeSpeedKmh)[0];

    // Average variance
    const avgVariance = Math.round(
      dataPoints.reduce((acc, p) => acc + p.varianceKmh, 0) / dataPoints.length
    );

    return {
      currentPoint,
      worstPoint,
      bestPoint,
      avgVariance,
    };
  }, [dataPoints]);

  // -------------------------------------------------------------
  // D3 RENDERING ENGINE: DUAL LINE CHART & INTERACTIVE VARIANCES
  // -------------------------------------------------------------
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || dataPoints.length === 0) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = container.clientWidth || 640;
    const height = 310;
    svg.attr('width', width).attr('height', height);

    const margin = { top: 28, right: 35, bottom: 42, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale
    const xScale = d3
      .scaleLinear()
      .domain([0, dataPoints.length - 1])
      .range([0, innerWidth]);

    // Y Scale (Speed in km/h)
    const maxSpeed = Math.max(
      selectedCorridor.normalSpeedKmh * 1.15,
      ...dataPoints.map((d) => Math.max(d.realTimeSpeedKmh, d.historicalSpeedKmh)),
      55
    );
    const yScale = d3.scaleLinear().domain([0, maxSpeed]).nice().range([innerHeight, 0]);

    // Defs & Gradients
    const defs = svg.append('defs');

    // Deficit area gradient (rose / red)
    const deficitGradient = defs
      .append('linearGradient')
      .attr('id', 'variance-deficit-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    deficitGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.35);
    deficitGradient.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.04);

    // Surplus area gradient (emerald / green)
    const surplusGradient = defs
      .append('linearGradient')
      .attr('id', 'variance-surplus-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    surplusGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.35);
    surplusGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.04);

    // Glow filter for real-time speed stroke
    const filter = defs.append('filter').attr('id', 'cyan-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d) => d);

    // Background Horizontal Gridlines
    const yTicks = yScale.ticks(5);
    const gridGroup = g.append('g').attr('class', 'grid-lines');
    yTicks.forEach((tickVal) => {
      gridGroup
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(tickVal))
        .attr('y2', yScale(tickVal))
        .attr('stroke', '#334155')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-dasharray', '3,4');
    });

    // Normal / Design Benchmark Line
    if (showNormalBenchmark && selectedCorridor.normalSpeedKmh) {
      const normalY = yScale(selectedCorridor.normalSpeedKmh);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', normalY)
        .attr('y2', normalY)
        .attr('stroke', '#64748b')
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', normalY - 6)
        .attr('text-anchor', 'end')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(`Design Speed: ${selectedCorridor.normalSpeedKmh} km/h`);
    }

    // Area Generator for Speed Variance
    if (showVarianceArea) {
      // Area where RealTime < Historical (Deficit - Red/Rose)
      const deficitAreaGenerator = d3
        .area<SpeedVarianceDataPoint>()
        .x((d) => xScale(d.index))
        .y0((d) => yScale(d.historicalSpeedKmh))
        .y1((d) => yScale(Math.min(d.historicalSpeedKmh, d.realTimeSpeedKmh)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dataPoints)
        .attr('fill', 'url(#variance-deficit-gradient)')
        .attr('d', deficitAreaGenerator);

      // Area where RealTime > Historical (Surplus - Green/Emerald)
      const surplusAreaGenerator = d3
        .area<SpeedVarianceDataPoint>()
        .x((d) => xScale(d.index))
        .y0((d) => yScale(d.historicalSpeedKmh))
        .y1((d) => yScale(Math.max(d.historicalSpeedKmh, d.realTimeSpeedKmh)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dataPoints)
        .attr('fill', 'url(#variance-surplus-gradient)')
        .attr('d', surplusAreaGenerator);
    }

    // Line Generator: Historical Average Speed
    const historicalLineGenerator = d3
      .line<SpeedVarianceDataPoint>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.historicalSpeedKmh))
      .curve(d3.curveMonotoneX);

    // Line Generator: Real-Time Speed
    const realTimeLineGenerator = d3
      .line<SpeedVarianceDataPoint>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.realTimeSpeedKmh))
      .curve(d3.curveMonotoneX);

    // Draw Historical Line (Amber Dashed)
    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.2)
      .attr('stroke-dasharray', '5,4')
      .attr('stroke-opacity', 0.85)
      .attr('d', historicalLineGenerator);

    // Draw Real-Time Line (Vibrant Cyan Solid with Glow)
    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#cyan-glow)')
      .attr('d', realTimeLineGenerator);

    // Subtle Dots on Points
    dataPoints.forEach((pt) => {
      const cx = xScale(pt.index);
      const cyHist = yScale(pt.historicalSpeedKmh);
      const cyReal = yScale(pt.realTimeSpeedKmh);

      // Historical dot
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cyHist)
        .attr('r', 2.5)
        .attr('fill', '#f59e0b')
        .attr('opacity', 0.7);

      // Real-time dot
      const isDelayed = pt.varianceKmh < -10;
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cyReal)
        .attr('r', pt.isCurrent ? 5 : 3.5)
        .attr('fill', isDelayed ? '#f43f5e' : '#06b6d4')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5);
    });

    // Current Time Vertical Marker (if in timeline view)
    if (viewDimension === 'timeline') {
      const currentPt = dataPoints.find((p) => p.isCurrent);
      if (currentPt) {
        const curX = xScale(currentPt.index);
        const curLine = g.append('g').attr('class', 'current-hour-marker');

        curLine
          .append('line')
          .attr('x1', curX)
          .attr('x2', curX)
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', '#06b6d4')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.8);

        curLine
          .append('rect')
          .attr('x', curX - 18)
          .attr('y', -20)
          .attr('width', 36)
          .attr('height', 16)
          .attr('rx', 4)
          .attr('fill', '#06b6d4');

        curLine
          .append('text')
          .attr('x', curX)
          .attr('y', -9)
          .attr('text-anchor', 'middle')
          .attr('fill', '#020617')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .text('NOW');
      }
    }

    // Axes
    const xAxisGenerator = d3
      .axisBottom(xScale)
      .ticks(viewDimension === 'timeline' ? 8 : dataPoints.length)
      .tickFormat((d) => {
        const idx = Math.round(Number(d));
        const pt = dataPoints[idx];
        if (!pt) return '';
        if (viewDimension === 'timeline') {
          // Show 12 AM, 3 AM, 6 AM, etc.
          const hour = pt.index;
          return hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
        } else {
          return `Km ${pt.label.match(/\(Km (\d+(\.\d+)?)\)/)?.[1] || pt.index}`;
        }
      });

    const yAxisGenerator = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${d} km/h`);

    // Render X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxisGenerator)
      .call((axis) => axis.select('.domain').attr('stroke', '#475569'))
      .call((axis) => axis.selectAll('.tick line').attr('stroke', '#475569'))
      .call((axis) =>
        axis.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('dy', '0.8em')
      );

    // Render Y Axis
    g.append('g')
      .call(yAxisGenerator)
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) => axis.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '10px'));

    // Dynamic Hover Overlay Elements (Group)
    const hoverGroup = g.append('g').attr('class', 'hover-elements').style('display', 'none');

    const verticalCrosshair = hoverGroup
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '2,2');

    const varianceBracket = hoverGroup
      .append('line')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '2,2');

    const focusRealTimeDot = hoverGroup
      .append('circle')
      .attr('r', 6)
      .attr('fill', '#06b6d4')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    const focusHistoricalDot = hoverGroup
      .append('circle')
      .attr('r', 5.5)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    const variancePill = hoverGroup.append('g').attr('class', 'variance-pill');
    variancePill
      .append('rect')
      .attr('rx', 4)
      .attr('height', 18)
      .attr('stroke-width', 1);
    const variancePillText = variancePill
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '12px')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace');

    // Bisector for finding nearest data point
    const bisect = d3.bisector((d: SpeedVarianceDataPoint) => d.index).center;

    // Full interactive pointer capture rectangle
    const pointerOverlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    const updateHoverPosition = (event: MouseEvent | TouchEvent) => {
      const [mx] = d3.pointer(event, pointerOverlay.node());
      const clampedX = Math.max(0, Math.min(innerWidth, mx));
      const rawIndex = xScale.invert(clampedX);
      const nearestIdx = Math.max(0, Math.min(dataPoints.length - 1, Math.round(rawIndex)));
      const pt = dataPoints[nearestIdx];

      if (!pt) return;

      const ptX = xScale(pt.index);
      const ptYReal = yScale(pt.realTimeSpeedKmh);
      const ptYHist = yScale(pt.historicalSpeedKmh);

      hoverGroup.style('display', null);

      verticalCrosshair.attr('x1', ptX).attr('x2', ptX);

      varianceBracket
        .attr('x1', ptX)
        .attr('x2', ptX)
        .attr('y1', Math.min(ptYReal, ptYHist))
        .attr('y2', Math.max(ptYReal, ptYHist))
        .attr('stroke', pt.varianceKmh < 0 ? '#f43f5e' : '#10b981');

      focusRealTimeDot
        .attr('cx', ptX)
        .attr('cy', ptYReal)
        .attr('fill', pt.varianceKmh < 0 ? '#f43f5e' : '#06b6d4');

      focusHistoricalDot.attr('cx', ptX).attr('cy', ptYHist);

      // Position the small in-chart variance delta badge
      const midY = (ptYReal + ptYHist) / 2;
      const isDeficit = pt.varianceKmh < 0;
      const pillWidth = 64;
      const pillX = ptX + (ptX > innerWidth - 75 ? -pillWidth - 8 : 8);

      variancePill.attr('transform', `translate(${pillX}, ${midY - 9})`);
      variancePill
        .select('rect')
        .attr('width', pillWidth)
        .attr('fill', isDeficit ? '#881337' : '#064e3b')
        .attr('stroke', isDeficit ? '#f43f5e' : '#10b981');

      variancePillText
        .attr('x', pillWidth / 2)
        .attr('fill', isDeficit ? '#fda4af' : '#6ee7b7')
        .text(`${pt.varianceKmh > 0 ? '+' : ''}${pt.varianceKmh} km/h`);

      setHoveredPoint(pt);

      // Compute tooltip coordinates relative to container
      const containerRect = container.getBoundingClientRect();
      const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;

      setTooltipPos({
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      });
    };

    const hideHover = () => {
      hoverGroup.style('display', 'none');
      setHoveredPoint(null);
      setTooltipPos(null);
    };

    pointerOverlay
      .on('pointerenter', (e) => updateHoverPosition(e))
      .on('pointermove', (e) => updateHoverPosition(e))
      .on('pointerleave', hideHover)
      .on('touchstart', (e) => updateHoverPosition(e))
      .on('touchmove', (e) => updateHoverPosition(e))
      .on('touchend', hideHover);

  }, [dataPoints, selectedCorridor, showVarianceArea, showNormalBenchmark, viewDimension, containerWidth]);

  // Attach ResizeObserver to keep chart responsive on layout changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-3.5" id="corridor-speed-variance-chart-root">
      {/* Top Controls & Selection Header */}
      <div className="bg-slate-900/95 p-3.5 rounded-xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Corridor Selection & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {selectedCorridor.name}
                </h4>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono font-bold border border-slate-700">
                  {selectedCorridor.highwayCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedCorridor.section}</p>
            </div>
          </div>

          {/* Controls: Dimension Toggle & Corridor Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {allCorridors && allCorridors.length > 1 && onSelectCorridor && (
              <select
                aria-label="Select Traffic Corridor"
                value={selectedCorridor.id}
                onChange={(e) => {
                  const target = allCorridors.find((c) => c.id === e.target.value);
                  if (target) onSelectCorridor(target);
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                id="select-speed-variance-corridor"
              >
                {allCorridors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.highwayCode})
                  </option>
                ))}
              </select>
            )}

            {/* Dimension Toggle: 24h Timeline vs Chainage Distance */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setViewDimension('timeline')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewDimension === 'timeline'
                    ? 'bg-cyan-500 text-slate-950 shadow font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="btn-variance-dimension-timeline"
                title="View 24-Hour Timeline Profile"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>24h Timeline</span>
              </button>

              <button
                onClick={() => setViewDimension('chainage')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewDimension === 'chainage'
                    ? 'bg-cyan-500 text-slate-950 shadow font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="btn-variance-dimension-chainage"
                title="View Kilometer-by-Kilometer Highway Chainage"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Km Chainage</span>
              </button>
            </div>
          </div>
        </div>

        {/* Day Type Filter Pills (shown in timeline view) */}
        {viewDimension === 'timeline' && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Historical Baseline Profile:</span>
            </div>

            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {(['weekday', 'friday', 'saturday', 'festival'] as DayProfileType[]).map((dType) => {
                const isSelected = dayType === dType;
                return (
                  <button
                    key={dType}
                    onClick={() => setDayType(dType)}
                    className={`px-2 py-1 rounded-md capitalize font-semibold transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    id={`btn-day-type-${dType}`}
                  >
                    {dType === 'festival' ? 'Festival (Dashain/Tihar)' : dType}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Real-time KPI Metric Banner */}
      {summaryMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Live Speed */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Real-Time Speed</span>
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-lg font-extrabold text-cyan-400">
                {summaryMetrics.currentPoint.realTimeSpeedKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Design: {selectedCorridor.normalSpeedKmh} km/h
            </span>
          </div>

          {/* Historical Avg Speed */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Historical Baseline</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-lg font-extrabold text-amber-400">
                {summaryMetrics.currentPoint.historicalSpeedKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {dayType} average
            </span>
          </div>

          {/* Live Speed Variance */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Speed Variance</span>
              {summaryMetrics.currentPoint.varianceKmh < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span
                className={`text-lg font-extrabold ${
                  summaryMetrics.currentPoint.varianceKmh < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {summaryMetrics.currentPoint.varianceKmh > 0 ? '+' : ''}
                {summaryMetrics.currentPoint.varianceKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
              <span
                className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                  summaryMetrics.currentPoint.variancePercent < 0
                    ? 'bg-rose-500/10 text-rose-300'
                    : 'bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {summaryMetrics.currentPoint.variancePercent > 0 ? '+' : ''}
                {summaryMetrics.currentPoint.variancePercent}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {summaryMetrics.currentPoint.varianceKmh < 0 ? 'Transit Deficit' : 'Surplus Flow'}
            </span>
          </div>

          {/* Peak Chokepoint */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Peak Chokepoint</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-1 text-xs font-bold text-slate-200 truncate">
              {summaryMetrics.worstPoint.label.split('(')[0].trim()}
            </div>
            <span className="text-[10px] text-rose-400 block mt-0.5 font-mono">
              {summaryMetrics.worstPoint.varianceKmh} km/h variance
            </span>
          </div>
        </div>
      )}

      {/* D3 Interactive Line Chart Container */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative shadow-inner">
        {/* Chart Header: Title & Interactive Legend Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-900">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-300">
              {viewDimension === 'timeline'
                ? '24-Hour Velocity Horizon (Real-Time Telemetry vs. Baseline)'
                : 'Corridor Chainage Velocity Profile (Km by Km)'}
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
              Interactive Hover Active
            </span>
          </div>

          {/* Series Toggles / Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {/* Real-time Series */}
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <span className="text-slate-300 font-semibold">Real-Time</span>
            </div>

            {/* Historical Series */}
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1 rounded-full bg-amber-400 border border-dashed border-amber-300" />
              <span className="text-slate-400">Historical Avg</span>
            </div>

            {/* Shaded Area Toggle */}
            <button
              onClick={() => setShowVarianceArea(!showVarianceArea)}
              className={`flex items-center space-x-1 text-[11px] px-1.5 py-0.5 rounded transition ${
                showVarianceArea
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
              title="Toggle Speed Variance Area Shading"
            >
              <span className="w-2 h-2 rounded bg-rose-500" />
              <span>Variance Gap</span>
            </button>

            {/* Design Speed Toggle */}
            <button
              onClick={() => setShowNormalBenchmark(!showNormalBenchmark)}
              className={`flex items-center space-x-1 text-[11px] px-1.5 py-0.5 rounded transition ${
                showNormalBenchmark
                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
              title="Toggle Design Benchmark Line"
            >
              <span className="w-2.5 h-0.5 bg-slate-400" />
              <span>Design Speed</span>
            </button>
          </div>
        </div>

        {/* SVG Container */}
        <div ref={containerRef} className="w-full relative select-none">
          <svg ref={svgRef} className="w-full h-[310px] overflow-visible" />

          {/* Floating Interactive Hover Card */}
          {hoveredPoint && tooltipPos && (
            <div
              className="absolute z-30 pointer-events-none transition-transform duration-75 ease-out"
              style={{
                left: `${Math.min(
                  Math.max(10, tooltipPos.x - 120),
                  (containerRef.current?.clientWidth || 600) - 260
                )}px`,
                top: `${Math.max(10, tooltipPos.y - 145)}px`,
              }}
            >
              <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-2xl text-xs w-[250px] space-y-2">
                {/* Header: Time / Segment */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-1.5">
                  <div>
                    <div className="font-bold text-white text-xs leading-tight">
                      {hoveredPoint.label}
                    </div>
                    {hoveredPoint.subLabel && (
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {hoveredPoint.subLabel}
                      </span>
                    )}
                  </div>
                  {hoveredPoint.isCurrent && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-cyan-500 text-slate-950 uppercase">
                      Current
                    </span>
                  )}
                </div>

                {/* Speed Comparison Row */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-cyan-400 block font-medium">Real-Time Speed</span>
                    <span className="text-sm font-extrabold text-white">
                      {hoveredPoint.realTimeSpeedKmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 block font-medium">Historical Avg</span>
                    <span className="text-sm font-extrabold text-white">
                      {hoveredPoint.historicalSpeedKmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                    </span>
                  </div>
                </div>

                {/* Speed Variance Highlight Callout */}
                <div
                  className={`p-2 rounded-lg border flex items-center justify-between ${
                    hoveredPoint.varianceKmh < 0
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    {hoveredPoint.varianceKmh < 0 ? (
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider block">
                        {hoveredPoint.varianceKmh < 0 ? 'Speed Deficit' : 'Speed Gain'}
                      </span>
                      <span className="font-extrabold text-xs">
                        {hoveredPoint.varianceKmh > 0 ? '+' : ''}
                        {hoveredPoint.varianceKmh} km/h
                        <span className="text-[10px] ml-1 font-mono">
                          ({hoveredPoint.variancePercent > 0 ? '+' : ''}
                          {hoveredPoint.variancePercent}%)
                        </span>
                      </span>
                    </div>
                  </div>

                  {hoveredPoint.delayMinutes > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block">Est. Delay</span>
                      <span className="font-mono text-xs font-bold text-rose-400">
                        +{hoveredPoint.delayMinutes} min
                      </span>
                    </div>
                  )}
                </div>

                {/* Local Advisory note */}
                <div className="text-[11px] text-slate-300 bg-slate-800/40 p-1.5 rounded border border-slate-700/40 leading-snug">
                  <span className="text-slate-400 font-semibold mr-1">Condition:</span>
                  {hoveredPoint.advisory}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart Footer Tip */}
        <div className="mt-3 pt-2.5 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Hover over any data point to display exact real-time vs. historical speed variance ($\Delta$) and transit delay.
            </span>
          </div>
          <div className="flex items-center space-x-2 text-slate-500 font-mono text-[10px]">
            <span>Telemetry: DoR Traffic Sensor Probes</span>
            <span>•</span>
            <span>Updated live</span>
          </div>
        </div>
      </div>

      {/* Deep-Dive Variance Breakdown Table / Cards */}
      <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-amber-400" />
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              {viewDimension === 'timeline'
                ? 'Key 24-Hour Velocity Windows & Bottlenecks'
                : 'Corridor Section Speed Variance Audit'}
            </h5>
          </div>
          <span className="text-[10px] text-slate-400">
            {selectedCorridor.name} ({selectedCorridor.highwayCode})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Worst Slowdown Window */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-rose-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-rose-400 font-semibold uppercase">
                Peak Bottleneck
              </span>
              <AlertTriangle className="w-3 h-3 text-rose-400" />
            </div>
            <div className="mt-1 font-bold text-xs text-white">
              {summaryMetrics?.worstPoint.label.split('(')[0].trim()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Speed drops to{' '}
              <span className="text-rose-400 font-bold font-mono">
                {summaryMetrics?.worstPoint.realTimeSpeedKmh} km/h
              </span>{' '}
              (deficit of{' '}
              <span className="text-rose-400 font-mono font-bold">
                {summaryMetrics?.worstPoint.varianceKmh} km/h
              </span>
              ).
            </p>
          </div>

          {/* Optimal Free-Flow Window */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                Recommended Flow Window
              </span>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="mt-1 font-bold text-xs text-white">
              {trendProfile.bestDepartureWindow || '05:00 AM – 07:30 AM'}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Peak flow speeds reaching{' '}
              <span className="text-emerald-400 font-bold font-mono">
                {summaryMetrics?.bestPoint.realTimeSpeedKmh} km/h
              </span>{' '}
              with minimal convoy friction.
            </p>
          </div>

          {/* Traffic Reason / Cause */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-semibold uppercase">
                Primary Root Cause
              </span>
              <Info className="w-3 h-3 text-amber-400" />
            </div>
            <div className="mt-1 font-bold text-xs text-white truncate">
              {selectedCorridor.level.toUpperCase()} FLOW
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              {selectedCorridor.cause}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
