import React from 'react';
import { Database, Clock, ExternalLink } from 'lucide-react';

export type DataAttributionProps = {
  /** Primary source label, e.g. "DoR Nepal + Waze + Local" */
  source: string;
  /** ISO or human-readable last update */
  updatedAt?: string | null;
  /** Optional short note */
  note?: string;
  /** Optional official link */
  href?: string;
  /** Compact single-line vs stacked */
  compact?: boolean;
  className?: string;
};

/** Consistent source + last-updated footer for reports (incidents, weather, POIs, distance). */
export function DataAttribution({
  source,
  updatedAt,
  note,
  href,
  compact = false,
  className = '',
}: DataAttributionProps) {
  const when = formatUpdated(updatedAt);

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 ${className}`}
        title={note || undefined}
      >
        <span className="inline-flex items-center gap-1">
          <Database className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-slate-400 font-medium">Source:</span>
          <span className="text-slate-300 font-semibold">{source}</span>
        </span>
        {when && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <span>Updated {when}</span>
          </span>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-cyan-500/80 hover:text-cyan-400"
          >
            Official <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 space-y-1 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <Database className="w-3.5 h-3.5 text-cyan-500/80 shrink-0" />
          <span className="text-slate-500">Data source</span>
          <span className="font-bold text-slate-200">{source}</span>
        </span>
        {when && (
          <span className="inline-flex items-center gap-1 text-slate-500 font-mono text-[10px]">
            <Clock className="w-3 h-3 shrink-0" />
            Updated {when}
          </span>
        )}
      </div>
      {(note || href) && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          {note && <span>{note}</span>}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-cyan-500/90 hover:text-cyan-400 font-medium"
            >
              View official source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function formatUpdated(raw?: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    try {
      return new Date(t).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Map API source codes to user-facing labels */
export function labelDataSource(code?: string | null): string {
  if (!code) return 'Local cache';
  const c = code.toLowerCase();
  if (c.includes('dor') && c.includes('waze')) return 'DoR Nepal + Waze + Local';
  if (c === 'dor' || c.includes('dor')) return 'DoR Nepal';
  if (c === 'waze') return 'Waze community';
  if (c === 'dhm' || c.includes('dhm')) return 'DHM Nepal (official)';
  if (c.includes('open-meteo') || c === 'openmeteo') return 'Open-Meteo (free)';
  if (c.includes('openweather')) return 'OpenWeatherMap';
  if (c.includes('overpass') || c.includes('osm')) return 'OpenStreetMap / Overpass';
  if (c.includes('offline')) return 'Offline bundle (device)';
  if (c.includes('local') || c.includes('static') || c.includes('kv')) return 'Mero Sadak curated / KV';
  if (c.includes('osrm') || c.includes('graph')) return 'OSRM / local graph';
  if (c === 'none') return 'Unavailable';
  return code;
}
