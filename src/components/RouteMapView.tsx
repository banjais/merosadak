import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * "Map" option for the Distance Calculator results.
 *
 * Renders the calculated corridor on a real Leaflet basemap so the animated
 * sketch above can be checked against geography. Pairs with RouteLineDrawing:
 * the sketch is the decorated journey graphic, this is the map option.
 *
 * The surveyed highway alignment draws as a solid emerald line; connecting
 * roads (origin/destination access, network joins) draw as dashed amber runs,
 * so the map never presents an access road as surveyed highway. Aerial
 * fallback draws as a dashed grey straight line and is labelled as such.
 *
 * Coordinates are [lat, lng], matching RoutePlanResult.pathCoordinates.
 */

type LatLng = [number, number];

export interface MapPathSegment {
  kind: 'surveyed' | 'connection';
  coords: LatLng[];
}

interface RouteMapViewProps {
  pathCoordinates?: LatLng[] | null;
  /** Surveyed vs connector runs — renders the real measurement composition. */
  segments?: MapPathSegment[];
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  isAerial?: boolean;
}

const NEPAL_BOUNDS: L.LatLngBoundsExpression = [[26.34, 80.0], [30.5, 88.3]];

const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

/**
 * Professional navigation endpoints: a small origin dot (you start here) and
 * a destination pin — no cartoon letter badges.
 */
function originDotIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:#10b981;border:3px solid #ffffff;box-shadow:0 1px 8px rgba(0,0,0,0.55);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function destPinIcon() {
  return L.divIcon({
    className: '',
    html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0z" fill="#f43f5e" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="#ffffff"/></svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}

const SEGMENT_STYLE: Record<'surveyed' | 'connection', { color: string; dashArray?: string; label: string }> = {
  surveyed: { color: '#10b981', label: 'Surveyed highway' },
  connection: { color: '#fbbf24', dashArray: '5 7', label: 'Connecting road' },
};

export const RouteMapView: React.FC<RouteMapViewProps> = ({
  pathCoordinates,
  segments,
  origin,
  destination,
  isAerial = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [origin.lat, origin.lng],
      zoom: 8,
      minZoom: 5,
      maxZoom: 17,
      maxBounds: NEPAL_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, { maxZoom: 16, attribution: 'Esri, HERE, Garmin' }).addTo(map);
    mapRef.current = map;

    const timer = window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; route layers are managed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const usable = (pathCoordinates || []).filter(
      (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    const latLngs: LatLng[] =
      usable.length >= 2
        ? usable
        : [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ];

    const group = L.layerGroup();

    if (isAerial) {
      // Aerial fallback — an explicitly dashed straight line, never styled as
      // a road route.
      L.polyline(latLngs, {
        color: '#94a3b8',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8 10',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);
    } else {
      // Soft halo under everything so the corridor reads at a glance.
      L.polyline(latLngs, {
        color: '#38bdf8',
        weight: 7,
        opacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      const runs = (segments || []).filter(
        (s) => Array.isArray(s.coords) && s.coords.length >= 2,
      );
      if (runs.length > 0) {
        // Draw the measurement composition: surveyed solid, connector dashed.
        for (const run of runs) {
          const style = SEGMENT_STYLE[run.kind];
          L.polyline(run.coords as L.LatLngExpression[], {
            color: style.color,
            weight: 3.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: style.dashArray,
          }).addTo(group);
        }
      } else {
        L.polyline(latLngs, {
          color: '#10b981',
          weight: 3.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      }
    }

    L.marker(latLngs[0], { icon: originDotIcon() })
      .bindTooltip(origin.label, { direction: 'top', className: 'custom-dark-tooltip' })
      .addTo(group);

    L.marker(latLngs[latLngs.length - 1], { icon: destPinIcon() })
      .bindTooltip(destination.label, { direction: 'top', className: 'custom-dark-tooltip' })
      .addTo(group);

    group.addTo(map);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 12 });

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animating = false;
    const lineEls: SVGPathElement[] = [];
    group.eachLayer((layer) => {
      const path = (layer as unknown as { _path?: SVGPathElement })._path;
      if (path) lineEls.push(path);
    });
    // Reveal the main (widest) stroke only — halo stays static.
    const path = lineEls[lineEls.length - 1];
    if (!reduceMotion && path && typeof path.getTotalLength === 'function') {
      animating = true;
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1800);
        path.style.strokeDashoffset = `${length * (1 - t)}`;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          path.style.strokeDasharray = '';
          path.style.strokeDashoffset = '';
          animating = false;
        }
      };
      requestAnimationFrame(tick);
    }

    return () => {
      if (animating && path) {
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
      }
      group.remove();
    };
  }, [pathCoordinates, segments, origin.lat, origin.lng, origin.label, destination.lat, destination.lng, destination.label, isAerial]);

  // Legend mirrors exactly what the measurement hierarchy draws.
  const legend = isAerial
    ? [{ color: '#94a3b8', dash: true, label: 'Aerial estimate (straight line)' }]
    : (segments || []).some((s) => s.kind === 'connection') && segments?.length
      ? [
          { color: '#10b981', dash: false, label: 'Surveyed highway' },
          { color: '#fbbf24', dash: true, label: 'Connecting road' },
        ]
      : [{ color: '#10b981', dash: false, label: 'Surveyed highway corridor' }];

  return (
    <div className="card card-elevated overflow-hidden">
      <div
        ref={containerRef}
        className="h-72 w-full sm:h-80"
        role="application"
        aria-label={`Map of route from ${origin.label} to ${destination.label}`}
      />
      <div className="border-t border-slate-800 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px] text-tertiary">
              <span
                aria-hidden
                className="inline-block h-0 w-6 border-t-2"
                style={{
                  borderColor: item.color,
                  borderStyle: item.dash ? 'dashed' : 'solid',
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RouteMapView;
