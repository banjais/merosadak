import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { HighwayWeatherNode } from '../types';
import { Thermometer, Droplets, Clock, Sparkles, TrendingUp, Sun, CloudRain } from 'lucide-react';

interface HourlyWeatherPoint {
  hour: number;
  timeLabel: string;
  tempC: number;
  precipitationPercent: number;
  visibilityKm: number;
}

interface WeatherSparklineChartProps {
  weatherNode: HighwayWeatherNode;
}

export const WeatherSparklineChart: React.FC<WeatherSparklineChartProps> = ({ weatherNode }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeMetric, setActiveMetric] = useState<'temp' | 'rain'>('temp');
  const [hoverData, setHoverData] = useState<HourlyWeatherPoint | null>(null);

  // Generate 24-hour hourly trend deterministically based on weatherNode properties
  const hourlyData = useMemo<HourlyWeatherPoint[]>(() => {
    const points: HourlyWeatherPoint[] = [];
    const baseTemp = weatherNode.tempC;
    const baseRain = weatherNode.rainProbabilityPercent;
    const baseVis = weatherNode.visibilityKm;

    // Seed hash from node id for slight pass-specific variation
    let seed = 0;
    for (let i = 0; i < weatherNode.id.length; i++) {
      seed += weatherNode.id.charCodeAt(i);
    }

    for (let h = 0; h < 24; h++) {
      // Temperature curve: lowest around 4 AM (h=4), peak around 2 PM (h=14)
      const tempVar = Math.sin(((h - 10) / 24) * Math.PI * 2) * 4.5;
      const temp = Math.round((baseTemp + tempVar) * 10) / 10;

      // Precipitation curve: peaks in afternoon/evening for mountain showers
      const rainVar = Math.sin(((h - 6) / 24) * Math.PI * 2) * 25 + Math.sin((h + seed) % 5) * 10;
      const rain = Math.max(0, Math.min(100, Math.round(baseRain + rainVar)));

      // Visibility curve: lower at night and early morning fog (h=0 to h=7)
      let vis = baseVis;
      if (h <= 7 || h >= 21) {
        vis = Math.max(1, baseVis * 0.6);
      }

      let timeLabel = '';
      if (h === 0) timeLabel = '12 AM';
      else if (h < 12) timeLabel = `${h} AM`;
      else if (h === 12) timeLabel = '12 PM';
      else timeLabel = `${h - 12} PM`;

      points.push({
        hour: h,
        timeLabel,
        tempC: temp,
        precipitationPercent: rain,
        visibilityKm: Math.round(vis * 10) / 10,
      });
    }

    return points;
  }, [weatherNode]);

  // Determine best departure window (lowest rain & stable temperature/visibility)
  const bestDepartureWindow = useMemo(() => {
    // Find consecutive 4-hour window with lowest average rain
    let bestStart = 5; // default early morning
    let minRainSum = 9999;

    for (let i = 4; i <= 10; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        sum += hourlyData[(i + j) % 24].precipitationPercent;
      }
      if (sum < minRainSum) {
        minRainSum = sum;
        bestStart = i;
      }
    }

    const startHour = hourlyData[bestStart].timeLabel;
    const endHour = hourlyData[(bestStart + 4) % 24].timeLabel;
    return `${startHour} – ${endHour}`;
  }, [hourlyData]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || hourlyData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 550;
    const height = 140;
    const margin = { top: 15, right: 20, bottom: 25, left: 35 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xAccessor = (d: HourlyWeatherPoint) => d.hour;
    const yAccessor = (d: HourlyWeatherPoint) =>
      activeMetric === 'temp' ? d.tempC : d.precipitationPercent;

    const xScale = d3
      .scaleLinear()
      .domain([0, 23])
      .range([0, innerWidth]);

    const yMin = d3.min(hourlyData, yAccessor) || 0;
    const yMax = d3.max(hourlyData, yAccessor) || 100;
    const yPadding = activeMetric === 'temp' ? 3 : 10;

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
      .range([innerHeight, 0]);

    // Area generator
    const areaGenerator = d3
      .area<HourlyWeatherPoint>()
      .x((d) => xScale(xAccessor(d)))
      .y0(innerHeight)
      .y1((d) => yScale(yAccessor(d)))
      .curve(d3.curveMonotoneX);

    // Line generator
    const lineGenerator = d3
      .line<HourlyWeatherPoint>()
      .x((d) => xScale(xAccessor(d)))
      .y((d) => yScale(yAccessor(d)))
      .curve(d3.curveMonotoneX);

    // Color theme based on metric
    const primaryColor = activeMetric === 'temp' ? '#38bdf8' : '#34d399';
    const gradientId = `weather-grad-${activeMetric}-${weatherNode.id}`;

    // Gradient definitions
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.4);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.02);

    // Gridlines
    svg
      .append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '2,2');

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => {
        const h = Number(d);
        if (h === 0) return '12 AM';
        if (h === 6) return '6 AM';
        if (h === 12) return '12 PM';
        if (h === 18) return '6 PM';
        if (h === 23) return '11 PM';
        return '';
      });

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickFormat((d) => (activeMetric === 'temp' ? `${d}°C` : `${d}%`));

    svg
      .append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px');

    svg.append('g').call(yAxis).selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9px');

    svg.selectAll('.domain, .tick line').attr('stroke', '#475569');

    // Area & Line Paths
    svg
      .append('path')
      .datum(hourlyData)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', areaGenerator);

    svg
      .append('path')
      .datum(hourlyData)
      .attr('fill', 'none')
      .attr('stroke', primaryColor)
      .attr('stroke-width', 2)
      .attr('d', lineGenerator);

    // Interactive Hover
    const focus = svg.append('g').style('display', 'none');

    focus
      .append('line')
      .attr('class', 'x-hover-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', primaryColor)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3');

    focus
      .append('circle')
      .attr('r', 4.5)
      .attr('fill', primaryColor)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    svg
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => {
        focus.style('display', 'none');
        setHoverData(null);
      })
      .on('mousemove', function (event) {
        const [xCoord] = d3.pointer(event);
        const xVal = xScale.invert(xCoord);
        const index = Math.max(0, Math.min(23, Math.round(xVal)));
        const d = hourlyData[index];

        if (d) {
          focus.select('.x-hover-line').attr('transform', `translate(${xScale(d.hour)},0)`);
          focus.select('circle').attr('transform', `translate(${xScale(d.hour)},${yScale(yAccessor(d))})`);
          setHoverData(d);
        }
      });
  }, [hourlyData, activeMetric, weatherNode.id]);

  return (
    <div className="mt-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
      {/* Header & Metric Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>24-Hour Pass Trend ({weatherNode.name})</span>
        </div>

        {/* Metric Toggles */}
        <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setActiveMetric('temp')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center space-x-1 ${
              activeMetric === 'temp'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3 h-3" />
            <span>Temp (°C)</span>
          </button>
          <button
            onClick={() => setActiveMetric('rain')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center space-x-1 ${
              activeMetric === 'rain'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Droplets className="w-3 h-3" />
            <span>Rain (%)</span>
          </button>
        </div>
      </div>

      {/* D3 SVG Sparkline Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden">
        <svg ref={svgRef} className="w-full overflow-visible" />

        {/* Tooltip Overlay */}
        {hoverData && (
          <div className="absolute top-1 right-1 bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-lg text-[11px] space-y-0.5 backdrop-blur-md pointer-events-none z-10">
            <div className="font-bold text-slate-200 flex items-center space-x-1">
              <span>🕒 {hoverData.timeLabel}</span>
            </div>
            <div className="text-sky-300 font-semibold">
              Temp: <strong className="text-white">{hoverData.tempC}°C</strong>
            </div>
            <div className="text-emerald-300 font-semibold">
              Precipitation: <strong className="text-white">{hoverData.precipitationPercent}%</strong>
            </div>
            <div className="text-slate-400 text-[10px]">
              Visibility: {hoverData.visibilityKm} km
            </div>
          </div>
        )}
      </div>

      {/* Recommended Departure Timing Footer */}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-900 text-slate-400">
        <div className="flex items-center space-x-1 text-emerald-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Best Departure Window: <strong className="text-white font-bold">{bestDepartureWindow}</strong></span>
        </div>
        <span className="text-slate-500 font-mono text-[10px]">Auto 24h Forecast</span>
      </div>
    </div>
  );
};
