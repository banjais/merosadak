// src/components/PreTripBriefing.tsx
// AI-style pre-trip briefing with contextual suggestions

import React from 'react';
import { X, CloudRain, AlertTriangle, Fuel, MapPin, Check } from 'lucide-react';
import { TripBriefing } from '../types/travelPlan';

interface PreTripBriefingProps {
  isDarkMode: boolean;
  briefing: TripBriefing;
  onStartTrip: () => void;
  onAskAI: () => void;
  onClose: () => void;
  onDismiss?: () => void;
}

export const PreTripBriefing: React.FC<PreTripBriefingProps> = ({
  isDarkMode,
  briefing,
  onStartTrip,
  onAskAI,
  onClose,
  onDismiss
}) => {
  const hasAlerts = briefing.weather.alerts?.length > 0 || briefing.roadStatus.changes?.length > 0;
  const hasRecommendations = briefing.recommendations.length > 0;
  const hasReminders = briefing.reminders.length > 0;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Briefing Card */}
      <div className={`relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 p-4 border-b ${
          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              🤖 AI Pre-Trip Briefing
            </h3>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Weather Alert */}
          {briefing.weather.alerts && briefing.weather.alerts.length > 0 && (
            <div className={`p-3 rounded-xl border ${
              isDarkMode
                ? 'bg-blue-900/20 border-blue-800'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                <CloudRain size={20} className={`mt-0.5 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <div>
                  <p className={`font-bold text-sm ${
                    isDarkMode ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    Weather: {briefing.weather.condition} · {briefing.weather.temp}°C
                  </p>
                  {briefing.weather.alerts.map((alert, idx) => (
                    <p key={idx} className={`text-xs mt-1 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      ⚠️ {alert}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Road Status Alert */}
          {briefing.roadStatus.blockedSections > 0 && (
            <div className={`p-3 rounded-xl border ${
              isDarkMode
                ? 'bg-red-900/20 border-red-800'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className={`mt-0.5 ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
                <div>
                  <p className={`font-bold text-sm ${
                    isDarkMode ? 'text-red-300' : 'text-red-700'
                  }`}>
                    Route Alert: {briefing.roadStatus.blockedSections} blocked section(s)
                  </p>
                  {briefing.roadStatus.changes?.map((change, idx) => (
                    <p key={idx} className={`text-xs mt-1 ${
                      isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`}>
                      • {change}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {hasRecommendations && (
            <div className={`p-3 rounded-xl ${
              isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'
            }`}>
              <p className={`font-bold text-sm mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                💡 Recommendations
              </p>
              <ul className="space-y-1">
                {briefing.recommendations.map((rec, idx) => (
                  <li key={idx} className={`text-xs flex items-start gap-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <Check size={12} className="mt-0.5 flex-shrink-0 text-green-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reminders */}
          {hasReminders && (
            <div className={`p-3 rounded-xl ${
              isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'
            }`}>
              <p className={`font-bold text-sm mb-2 ${
                isDarkMode ? 'text-amber-300' : 'text-amber-700'
              }`}>
                🔔 Reminders
              </p>
              <ul className="space-y-1">
                {briefing.reminders.map((rem, idx) => (
                  <li key={idx} className={`text-xs flex items-start gap-2 ${
                    isDarkMode ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                    {rem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onStartTrip}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              🚀 Start Trip
            </button>
            <button
              onClick={onAskAI}
              className={`px-4 py-3 rounded-xl font-bold transition-colors ${
                isDarkMode
                  ? 'bg-slate-800 text-blue-400 hover:bg-slate-700'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              ❓ Ask AI
            </button>
          </div>

          {/* Dismiss option */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`w-full py-2 text-sm transition-colors ${
                isDarkMode
                  ? 'text-gray-500 hover:text-gray-400'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              Skip briefing next time
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
