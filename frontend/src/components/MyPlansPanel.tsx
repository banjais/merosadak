// src/components/MyPlansPanel.tsx
// Shows saved travel plans with smart badge

import React, { useState } from 'react';
import { X, Play, Eye, Trash2, Calendar, Clock, Navigation } from 'lucide-react';
import { TravelPlan } from '../types/travelPlan';
import { getTravelPlans, deleteTravelPlan, updatePlanStatus } from '../services/travelPlanService';

interface MyPlansPanelProps {
  isDarkMode: boolean;
  onSelectPlan: (plan: TravelPlan) => void;
  onStartPlan: (plan: TravelPlan) => void;
  onClose: () => void;
}

export const MyPlansPanel: React.FC<MyPlansPanelProps> = ({
  isDarkMode,
  onSelectPlan,
  onStartPlan,
  onClose
}) => {
  const [plans, setPlans] = useState<TravelPlan[]>(getTravelPlans());
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <div className={`fixed top-20 right-4 z-[2000] w-72 rounded-2xl border shadow-2xl p-6 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-white'
      }`}>
        <div className="text-center">
          <Calendar size={48} className="mx-auto mb-3 text-gray-400" />
          <h3 className={`font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            No Saved Plans
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Search for a destination and save it as a travel plan
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleDelete = (planId: string) => {
    deleteTravelPlan(planId);
    setPlans(getTravelPlans());
  };

  const handleStart = (plan: TravelPlan) => {
    updatePlanStatus(plan.id, 'active');
    onStartPlan(plan);
  };

  return (
    <div className={`fixed top-20 right-4 z-[2000] w-72 md:w-80 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl ${
      isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-white'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 p-4 border-b ${
        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📋 My Travel Plans
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {plans.length} plan{plans.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Plans List */}
      <div className="p-4 space-y-3">
        {plans.map((plan) => {
          const isExpanded = expandedPlanId === plan.id;
          const savedDate = new Date(plan.createdAt);
          const timeAgo = getTimeAgo(savedDate);

          return (
            <div
              key={plan.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                isDarkMode
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Plan Summary */}
              <button
                onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                className={`w-full p-3 text-left transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      📍 {plan.destination.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {plan.distance.toFixed(0)} km
                      </span>
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {plan.estimatedDuration.toFixed(1)} hrs
                      </span>
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {timeAgo}
                      </span>
                    </div>
                    {plan.routeStatus && plan.routeStatus.blockedSections > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">
                        ⚠️ {plan.routeStatus.blockedSections} blocked
                      </p>
                    )}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    plan.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                    plan.status === 'completed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {plan.status === 'active' ? '🚗 Active' :
                     plan.status === 'completed' ? '✅ Done' : '📌 Planned'}
                  </div>
                </div>
              </button>

              {/* Expanded Actions */}
              {isExpanded && (
                <div className={`p-3 border-t space-y-2 ${
                  isDarkMode ? 'border-slate-700' : 'border-gray-200'
                }`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStart(plan)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-bold"
                    >
                      <Play size={14} />
                      Start Trip
                    </button>
                    <button
                      onClick={() => onSelectPlan(plan)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm ${
                      isDarkMode
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 size={14} />
                    Delete Plan
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Utility: Get time ago string
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
