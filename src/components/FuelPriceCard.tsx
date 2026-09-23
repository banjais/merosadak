import React, { useState } from 'react';
import { FuelPriceMetadata } from '../utils/fuelPriceService';
import { Info, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Fuel } from 'lucide-react';

interface FuelPriceCardProps {
  fuelPrices: FuelPriceConfig | null;
  metadata: FuelPriceMetadata | null;
  isLoading: boolean;
}

interface FuelPriceConfig {
  petrol: number;
  diesel: number;
  electricity: number;
}

export const FuelPriceCard: React.FC<FuelPriceCardProps> = ({ fuelPrices, metadata, isLoading }) => {
  const [showInfo, setShowInfo] = useState(false);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Fuel className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Fuel Prices</span>
          {fuelPrices && !isLoading && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" title="Live data" />
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition"
            title="Source & update info"
            type="button"
          >
            <Info className="w-4 h-4" />
          </button>
          {showInfo && metadata && (
            <div className="absolute right-0 top-8 z-50 w-72 bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl animate-fadeIn">
              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-cyan-300">Source</div>
                    <div className="text-slate-300">{metadata.sourceLabel || metadata.source}</div>
                    {metadata.sourceUrl && (
                      <a
                        href={metadata.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:underline flex items-center space-x-1 mt-1"
                      >
                        <span>Visit NOC</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-2 space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Last Updated</span>
                    <span className="text-slate-200 font-mono">{formatDate(metadata.lastUpdated)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fetched At</span>
                    <span className="text-slate-200 font-mono">{formatDate(metadata.fetchedAt)}</span>
                  </div>
                  {metadata.nextUpdate && (
                    <div className="flex justify-between text-slate-400">
                      <span>Next Update</span>
                      <span className="text-slate-200 font-mono">{formatDate(metadata.nextUpdate)}</span>
                    </div>
                  )}
                </div>
                {metadata.note && (
                  <div className="border-t border-slate-800 pt-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">{metadata.note}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Price Grid */}
      {fuelPrices ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Petrol</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              Rs.{fuelPrices.petrol}
              <span className="text-[10px] font-normal text-slate-500 ml-0.5">/L</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">Diesel</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              Rs.{fuelPrices.diesel}
              <span className="text-[10px] font-normal text-slate-500 ml-0.5">/L</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">EV</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              Rs.{fuelPrices.electricity}
              <span className="text-[10px] font-normal text-slate-500 ml-0.5">/kWh</span>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center space-x-2 py-2">
          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-xs text-slate-500 animate-pulse">Loading fuel prices…</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2 py-2">
          <AlertCircle className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">Fuel prices unavailable — using NOC defaults</span>
        </div>
      )}
    </div>
  );
};
