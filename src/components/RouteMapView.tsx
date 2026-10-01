import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * "Map" option for the Distance Calculator results.
 *
 * Renders the calculated corridor on a real Leaflet basemap so the animated
 * sketch above can be checked against geography. Pairs with RouteLineDrawing:
 * the sketch is the decorated journey graphic, this is the map option.
 *
 * Coordinates are [lat, lng], matching RoutePlanResult.pathCoordinates.
 */

type LatLng = [number, number];

interface RouteMapViewProps {
  pathCoordinates?: LatLng[] | null;
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  isAerial?: boolean;
}

const NEPAL_BOUNDS: L.LatLngBoundsExpression = [[26.34, 80.0], [30.5, 88.3]];

const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

/**
 * Markers use divIcons with inline HTML so no Leaflet default-icon image
 * assets need to be bundled or re-pointed.
 */
function endpointIcon(letter: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#022c22;font:900 13px/1 system-ui,sans-serif;">${letter}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const ORIGIN_ICON = () => endpointIcon('A', '#10b981');
const DEST_ICON = () => endpointIcon('B', '#f43f5e');

export const RouteMapView: React.FC<RouteMapViewProps> = ({
  pathCoordinates,
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

    L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 7,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(group);

    const line = L.polyline(latLngs, {
      color: '#10b981',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: isAerial ? '8 10' : undefined,
    }).addTo(group);

    L.marker(latLngs[0], { icon: ORIGIN_ICON() })
      .bindTooltip(origin.label, { direction: 'top', className: 'custom-dark-tooltip' })
      .addTo(group);

    L.marker(latLngs[latLngs.length - 1], { icon: DEST_ICON() })
      .bindTooltip(destination.label, { direction: 'top', className: 'custom-dark-tooltip' })
      .addTo(group);

    group.addTo(map);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 12 });

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animating = false;
    const path = (line as unknown as { _path?: SVGPathElement })._path;
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
  }, [pathCoordinates, origin.lat, origin.lng, origin.label, destination.lat, destination.lng, destination.label, isAerial]);

  return (
    <div className="card card-elevated overflow-hidden">
      <div
        ref={containerRef}
        className="h-72 w-full sm:h-80"
        role="application"
        aria-label={`Map of route from ${origin.label} to ${destination.label}`}
      />
      <div className="border-t border-slate-800 px-4 py-2.5">
        <p className="text-[10px] text-tertiary">
          {isAerial
            ? 'Map shows a straight-line approximation'
            : 'Map shows the surveyed highway corridor'}
        </p>
      </div>
    </div>
  );
};

export default RouteMapView;