import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TollRateCategory {
  name: string;
  rate: number;
}

interface TollRates {
  entry: {
    category1: TollRateCategory;
    category2: TollRateCategory;
    category3: TollRateCategory;
    category4: TollRateCategory;
  };
  exit: {
    category1: TollRateCategory;
    category2: TollRateCategory;
    category3: TollRateCategory;
    category4: TollRateCategory;
  };
  prohibitedVehicles: string[];
  lastUpdated?: string;
  source?: string;
  sourceLabel?: string;
}

interface TollCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TollCalculatorModal: React.FC<TollCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [tollRates, setTollRates] = useState<TollRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadTollRates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/toll-rates');
        if (!res.ok) throw new Error('Failed to fetch toll rates');
        const data = await res.json();
        if (!cancelled) {
          setTollRates(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load toll rates. Showing cached/default rates.');
          // Fallback to verified default rates
          setTollRates({
            entry: {
              category1: { name: 'Light Vehicles (Car, Jeep, Van, SUV, Pickup up to 9 seats)', rate: 65 },
              category2: { name: 'Medium Vehicles / Minibuses (Minibus, Mini-truck, Microbus 10-25 seats)', rate: 115 },
              category3: { name: 'Heavy Commercial Vehicles (Bus, Large Truck 3-10 tons payload)', rate: 260 },
              category4: { name: 'Multi-Axle Heavy Freighters (Multi-axle trucks, trailers over 10 tons)', rate: 600 },
            },
            exit: {
              category1: { name: 'Light Vehicles (Car, Jeep, Van, SUV, Pickup up to 9 seats)', rate: 60 },
              category2: { name: 'Medium Vehicles / Minibuses (Minibus, Mini-truck, Microbus 10-25 seats)', rate: 80 },
              category3: { name: 'Heavy Commercial Vehicles (Bus, Large Truck 3-10 tons payload)', rate: 200 },
              category4: { name: 'Multi-Axle Heavy Freighters (Multi-axle trucks, trailers over 10 tons)', rate: 250 },
            },
            prohibitedVehicles: [
              'Two-wheelers (Motorcycles, Scooters, Bicycles)',
              'Three-wheelers (Auto-rickshaws, Tempos)',
              'Pedestrians and non-motorized carts',
              'Vehicles carrying flammable, toxic, or hazardous chemical cargo',
            ],
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadTollRates();
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = [
    { key: 'category1', icon: '🚗', label: 'Category 1 — Light Vehicles', desc: 'Car, Jeep, Van, SUV, Pickup (up to 9 seats)' },
    { key: 'category2', icon: '🚐', label: 'Category 2 — Medium Vehicles / Minibuses', desc: 'Minibus, Mini-truck, Microbus (10–25 seats)' },
    { key: 'category3', icon: '🚌', label: 'Category 3 — Heavy Commercial Vehicles', desc: 'Bus, Large Truck (3–10 tons payload)' },
    { key: 'category4', icon: '🚛', label: 'Category 4 — Multi-Axle Heavy Freighters', desc: 'Multi-axle trucks, trailers (over 10 tons)' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🚧</span>
            <div>
              <h3 className="text-lg font-bold text-white font-display">Nagdhunga Tunnel Toll Fees & Regulations</h3>
              <p className="text-xs text-slate-400">National Highway Toll Rates & Ministry Guidelines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-200 text-sm scrollbar-paddle">
          {/* Gazette Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="text-xs font-extrabold text-amber-400 mb-1">Official Toll Rate Notification</div>
            <div className="text-xs text-slate-300">
              Effective from Nepal Gazette, Chaitra 26, 2082 BS (Ministry of Physical Infrastructure & Transport, Department of Roads).
              {tollRates?.lastUpdated && (
                <>
                  <br />
                  Last updated: {new Date(tollRates.lastUpdated).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {tollRates.sourceLabel && <span className="ml-2"> · Source: {tollRates.sourceLabel}</span>}
                </>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl animate-pulse">
                  <div className="w-48 h-6 bg-slate-700/50 rounded"></div>
                  <div className="w-24 h-6 bg-slate-700/50 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Toll Rates Cards - Directional (Entry/Exit) */}
          {tollRates && !isLoading && (
            <div className="space-y-3">
              {/* Entry Rates */}
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 mb-2">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Entry to Kathmandu (Dhading → Nagdhunga)</span>
                </div>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const entryRate = tollRates.entry[cat.key];
                    return (
                      <div key={cat.key} className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                        <div>
                          <div className="font-bold text-white text-sm">{cat.icon} {cat.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{cat.desc}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-black text-cyan-400 font-mono">NPR {entryRate.rate}</div>
                          <div className="text-[10px] text-slate-400">Per Single Entry</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exit Rates */}
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 mb-2">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Exit from Kathmandu (Nagdhunga → Dhading)</span>
                </div>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const exitRate = tollRates.exit[cat.key];
                    return (
                      <div key={`exit-${cat.key}`} className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                        <div>
                          <div className="font-bold text-white text-sm">{cat.icon} {cat.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{cat.desc}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-black text-amber-400 font-mono">NPR {exitRate.rate}</div>
                          <div className="text-[10px] text-slate-400">Per Single Entry</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Prohibited Vehicles & Rules */}
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <div className="text-xs font-bold text-rose-400 mb-1 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Strictly Prohibited Inside Tunnel:</span>
            </div>
            <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 mt-1">
              {tollRates?.prohibitedVehicles?.map((v, i) => (
                <li key={i}>{v}</li>
              )) ?? (
                <>
                  <li>Two-wheelers (Motorcycles, Scooters, Bicycles)</li>
                  <li>Three-wheelers (Auto-rickshaws, Tempos)</li>
                  <li>Pedestrians and non-motorized carts</li>
                  <li>Vehicles carrying flammable, toxic, or hazardous chemical cargo</li>
                </>
              )}
            </ul>
          </div>

          {/* Data Source Info */}
          {tollRates && !isLoading && (
            <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg">
              <p className="text-[10px] text-slate-500 text-center">
                Data source: {tollRates.sourceLabel || 'Nepal Gazette'} · Auto-updated via CI/CD ·{' '}
                <a href={tollRates.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                  View official notice
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};