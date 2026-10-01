import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Map as MapIcon } from 'lucide-react';

/**
 * Animated origin -> destination route sketch.
 *
 * Replaces the old static parallax photo as the "here is your route" panel.
 * The polyline is revealed progressively (dash-offset driven) so the corridor
 * appears to be drawn from origin to destination.
 *
 * Coordinates are [lat, lng], matching RoutePlanResult.pathCoordinates, which
 * is the order Leaflet and buildRouteIndex() already expect.
 */

type LatLng = [number, number];

interface RouteLineDrawingProps {
  /** [lat, lng] pairs along the corridor. Falls back to a straight line when absent. */
  pathCoordinates?: LatLng[] | null;
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  /** Straight-line approximation rather than a surveyed corridor. */
  isAerial?: boolean;
  onChangeLocation?: () => void;
  /** Opens the full map view on demand. */
  onShowMap?: () => void;
}

const VIEW_W = 1000;
const VIEW_H = 420;
const PAD = 58;
const DRAW_MS = 2200;

interface Point {
  x: number;
  y: number;
}

/**
 * Fit the coordinates into the viewBox, preserving aspect ratio and centring
 * the route so short hops do not render as a line pinned to one edge.
 */
function project(coords: LatLng[]): Point[] {
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;

  const innerW = VIEW_W - PAD * 2;
  const innerH = VIEW_H - PAD * 2;
  const scale = Math.min(innerW / (spanLng || 1e-6), innerH / (spanLat || 1e-6));

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  return coords.map(([lat, lng]) => ({
    x: VIEW_W / 2 + (lng - midLng) * scale,
    y: VIEW_H / 2 - (lat - midLat) * scale,
  }));
}

function toPathData(points: Point[]): string {
  if (!points.length) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const RouteLineDrawing: React.FC<RouteLineDrawingProps> = ({
  pathCoordinates,
  origin,
  destination,
  isAerial = false,
  onChangeLocation,
  onShowMap,
}) => {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);

  // Prefer the surveyed corridor; fall back to the straight origin->destination
  // line so the panel always shows the journey rather than an empty box.
  const coords = useMemo<LatLng[]>(() => {
    const usable = (pathCoordinates || []).filter(
      (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (usable.length >= 2) return usable;
    return [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ];
  }, [pathCoordinates, origin.lat, origin.lng, destination.lat, destination.lng]);

  const points = useMemo(() => project(coords), [coords]);
  const pathData = useMemo(() => toPathData(points), [points]);

  const isStraightLine = coords.length < 2;

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setProgress(1);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DRAW_MS);
      setProgress(easeOutCubic(t));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [pathData]);

  // Travelling head that rides the line while it draws.
  const headIndex = Math.min(points.length - 1, Math.round(progress * (points.length - 1)));
  const head = points[headIndex];
  const startPt = points[0];
  const endPt = points[points.length - 1];

  return (
    <div className="card card-elevated overflow-hidden">
      <div className="relative bg-slate-950">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-32 w-full sm:h-40"
          role="img"
          aria-label={`Route from ${origin.label} to ${destination.label}`}
        >
          <defs>
            <linearGradient id="rld-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <radialGradient id="rld-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="#020617" />
          <rect width={VIEW_W} height={VIEW_H} fill="url(#rld-vignette)" />

          {/* graticule */}
          <g stroke="#1e293b" strokeWidth="1" opacity="0.55">
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <line key={`h${f}`} x1={0} y1={VIEW_H * f} x2={VIEW_W} y2={VIEW_H * f} />
            ))}
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <line key={`v${f}`} x1={VIEW_W * f} y1={0} x2={VIEW_W * f} y2={VIEW_H} />
            ))}
          </g>

          {/* full corridor, faint — shows where the route is going */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke="#334155"
              strokeWidth={isAerial ? 3 : 5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={isAerial ? '10 12' : undefined}
              opacity="0.5"
            />
          )}

          {/* glow + gradient stroke, revealed by dash-offset */}
          {pathData && (
            <>
              <path
                d={pathData}
                fill="none"
                stroke="url(#rld-stroke)"
                strokeWidth={16}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - progress}
                opacity="0.22"
              />
              <path
                d={pathData}
                fill="none"
                stroke="url(#rld-stroke)"
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - progress}
              />
            </>
          )}

          {/* origin / destination pins */}
          {startPt && (
            <g>
              <circle cx={startPt.x} cy={startPt.y} r="13" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              <text
                x={startPt.x}
                y={startPt.y + 4.5}
                textAnchor="middle"
                fontSize="13"
                fontWeight="900"
                fill="#022c22"
              >
                A
              </text>
            </g>
          )}
          {endPt && (
            <g opacity={progress > 0.98 ? 1 : 0.25}>
              <circle cx={endPt.x} cy={endPt.y} r="13" fill="#f43f5e" stroke="#ffffff" strokeWidth="2.5" />
              <text
                x={endPt.x}
                y={endPt.y + 4.5}
                textAnchor="middle"
                fontSize="13"
                fontWeight="900"
                fill="#4c0519"
              >
                B
              </text>
            </g>
          )}

          {/* travelling head */}
          {head && progress < 1 && (
            <circle cx={head.x} cy={head.y} r="6" fill="#ffffff" opacity="0.95" />
          )}
        </svg>

        {isStraightLine && (
          <p className="px-4 py-2 text-[10px] font-semibold text-amber-300/90">
            Straight-line sketch — no surveyed corridor geometry for this pair.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">
            {origin.label} <span className="text-slate-500">→</span> {destination.label}
          </p>
          <p className="text-[10px] text-tertiary">
            {isAerial ? 'Aerial approximation' : 'Surveyed highway corridor'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onShowMap && (
            <button
              type="button"
              onClick={onShowMap}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 transition hover:bg-cyan-900/40"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map
            </button>
          )}
          {onChangeLocation && (
            <button
              type="button"
              onClick={onChangeLocation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5" />
              Change
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteLineDrawing;