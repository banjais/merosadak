import React, { useState, useEffect, useMemo } from 'react';
import { DistanceMatrixData } from '../types';
import { isDistanceMatrixData, exportDistanceMatrixPdf, getShortMatrixName } from '../utils/distanceMatrix';
import { formatDistanceKm } from '../utils/formatDistance';
import { ArrowLeft, Search, Download, Table, Loader, AlertCircle } from 'lucide-react';

interface DistanceMatrixReferenceProps {
  onBack?: () => void;
}

export const DistanceMatrixReference: React.FC<DistanceMatrixReferenceProps> = ({ onBack }) => {
  const [matrixData, setMatrixData] = useState<DistanceMatrixData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/distance-matrix.json');
        if (!res.ok) {
          throw new Error(`Unable to load distance matrix (HTTP ${res.status})`);
        }
        const json = await res.json();
        if (!isDistanceMatrixData(json)) {
          throw new Error('Distance matrix failed validation');
        }
        if (!cancelled) {
          setMatrixData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load distance matrix');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleIndices = useMemo(() => {
    if (!matrixData) return [];
    const term = matrixFilter.trim().toLowerCase();
    if (!term) return matrixData.cities.map((_, index) => index);
    return matrixData.cities
      .map((_, index) => index)
      .filter((index) => {
        const city = matrixData.cities[index];
        return (
          city.name.toLowerCase().includes(term) ||
          city.id.toLowerCase().includes(term) ||
          city.district.toLowerCase().includes(term)
        );
      });
  }, [matrixData, matrixFilter]);

  const handleExportPdf = () => {
    if (matrixData) exportDistanceMatrixPdf(matrixData);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 accent-border sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 accent-text border border-slate-700/80 transition"
                title="Back to Main App"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md">
                <Table className="w-5 h-5 accent-text" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white font-display">
                  Nepal Full Distance Matrix (km)
                </h1>
                <p className="text-[10px] accent-text font-semibold uppercase tracking-wider">
                  Static reference matrix — not linked to the route planner
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {matrixData && (
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                title="Save / print a 2-decimal A4 landscape PDF (opens print dialog)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export to PDF</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Nepal Full Distance Matrix (km)</h3>
              <p className="text-xs text-slate-400">
                Pre-computed reference matrix for all {matrixData?.cities.length ?? 'loaded'} locations.
                This screen is a standalone reference and is intentionally not wired to the From/To search
                bar — clicking cells does not change the route calculator. Use "Export to PDF" to print a
                2-decimal reference sheet.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Filter cities..."
                value={matrixFilter}
                onChange={(e) => setMatrixFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center space-x-3 text-slate-400 py-8">
              <Loader className="w-4 h-4 animate-spin" />
              <span>Loading reference distance matrix...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-3 text-rose-400 py-6">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-center text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-left bg-slate-900 sticky left-0 z-10 border-r border-slate-800">City</th>
                    {visibleIndices.map((index) => {
                      const city = matrixData!.cities[index];
                      return (
                        <th key={city.id} className="py-2.5 px-3 whitespace-nowrap">
                          {getShortMatrixName(city.name)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {visibleIndices.map((rowOriginalIndex) => {
                    const rowCity = matrixData!.cities[rowOriginalIndex];
                    return (
                      <tr key={rowCity.id} className="hover:bg-slate-850/40 transition">
                        <td className="py-2.5 px-3 text-left font-bold text-white bg-slate-900/95 sticky left-0 z-10 border-r border-slate-800 whitespace-nowrap">
                          {getShortMatrixName(rowCity.name)} <span className="text-[10px] text-slate-500 font-normal">({rowCity.district})</span>
                        </td>
                        {visibleIndices.map((colOriginalIndex) => {
                          const colCity = matrixData!.cities[colOriginalIndex];
                          if (rowOriginalIndex === colOriginalIndex) {
                            return (
                              <td key={colCity.id} className="py-2.5 px-3 text-slate-600 bg-slate-950/40">
                                —
                              </td>
                            );
                          }
                          const distance = matrixData!.matrix[rowOriginalIndex][colOriginalIndex];
                          return (
                            <td
                              key={colCity.id}
                              className="py-2.5 px-3 font-medium text-slate-200"
                              title={`${rowCity.name} to ${colCity.name}: ${formatDistanceKm(distance)} km`}
                            >
                              {formatDistanceKm(distance)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
