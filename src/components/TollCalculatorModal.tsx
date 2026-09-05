import React from 'react';
import { X, ShieldAlert, AlertCircle, Info } from 'lucide-react';

interface TollCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TollCalculatorModal: React.FC<TollCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

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
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-200 text-sm">
          {/* Gazette Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="text-xs font-extrabold text-amber-400 mb-1">Official Toll Rate Notification</div>
            <div className="text-xs text-slate-300">
              Effective from Nepal Gazette, Chaitra 26, 2082 BS (Ministry of Physical Infrastructure & Transport, Department of Roads).
            </div>
          </div>

          {/* Toll Rates Cards */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
              <div>
                <div className="font-bold text-white text-sm">🚗 Category 1 — Light Vehicles</div>
                <div className="text-xs text-slate-400 mt-0.5">Car, Jeep, Van, SUV, Pickup (up to 9 seats)</div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-cyan-400 font-mono">NPR 65</div>
                <div className="text-[10px] text-slate-400">Per Single Entry</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
              <div>
                <div className="font-bold text-white text-sm">🚐 Category 2 — Medium Vehicles / Minibuses</div>
                <div className="text-xs text-slate-400 mt-0.5">Minibus, Mini-truck, Microbus (10–25 seats)</div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-cyan-400 font-mono">NPR 115</div>
                <div className="text-[10px] text-slate-400">Per Single Entry</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
              <div>
                <div className="font-bold text-white text-sm">🚌 Category 3 — Heavy Commercial Vehicles</div>
                <div className="text-xs text-slate-400 mt-0.5">Bus, Large Truck (3–10 tons payload)</div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-cyan-400 font-mono">NPR 260</div>
                <div className="text-[10px] text-slate-400">Per Single Entry</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl">
              <div>
                <div className="font-bold text-white text-sm">🚛 Category 4 — Multi-Axle Heavy Freighters</div>
                <div className="text-xs text-slate-400 mt-0.5">Multi-axle trucks, trailers (over 10 tons)</div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-cyan-400 font-mono">NPR 500</div>
                <div className="text-[10px] text-slate-400">Per Single Entry</div>
              </div>
            </div>
          </div>

          {/* Prohibited Vehicles & Rules */}
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <div className="text-xs font-bold text-rose-400 mb-1 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Strictly Prohibited Inside Tunnel:</span>
            </div>
            <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 mt-1">
              <li>Two-wheelers (Motorcycles, Scooters, Bicycles)</li>
              <li>Three-wheelers (Auto-rickshaws, Tempos)</li>
              <li>Pedestrians and non-motorized carts</li>
              <li>Vehicles carrying flammable, toxic, or hazardous chemical cargo</li>
            </ul>
          </div>
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
