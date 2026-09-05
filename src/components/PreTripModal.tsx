import React from 'react';
import { X } from 'lucide-react';
import { PreTripChecklist } from './PreTripChecklist';
import { RoutePlanResult, VehicleType } from '../types';

interface PreTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
}

export const PreTripModal: React.FC<PreTripModalProps> = ({
  isOpen,
  onClose,
  routePlan,
  vehicle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">✅</span>
            <div>
              <h3 className="text-lg font-bold text-white font-display">Pre-Trip Vehicle Safety Checklist</h3>
              <p className="text-xs text-slate-400">Essential roadworthiness, alpine passes & documentation verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <PreTripChecklist routePlan={routePlan} vehicle={vehicle} />
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">Progress saved locally in browser</span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
