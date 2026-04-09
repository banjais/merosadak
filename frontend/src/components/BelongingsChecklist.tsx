// src/components/BelongingsChecklist.tsx
// Context-aware belongings checklist before departure

import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { ChecklistItem } from '../types/travelPlan';

interface BelongingsChecklistProps {
  isDarkMode: boolean;
  items: ChecklistItem[];
  onCheck: (itemId: string) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

export const BelongingsChecklist: React.FC<BelongingsChecklistProps> = ({
  isDarkMode,
  items,
  onCheck,
  onComplete,
  onDismiss
}) => {
  const checkedCount = items.filter(i => i.checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[3500] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />

      {/* Checklist Card */}
      <div className={`relative w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              🎒 Quick Checklist
            </h3>
            <button
              onClick={onDismiss}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Based on your trip conditions
          </p>
        </div>

        {/* Progress Bar */}
        <div className={`px-4 pt-3 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {checkedCount}/{totalCount} packed
            </span>
            <span className={`text-xs font-bold ${
              progress === 100 ? 'text-green-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-green-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onCheck(item.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  item.checked
                    ? isDarkMode
                      ? 'bg-green-900/20 border-green-800'
                      : 'bg-green-50 border-green-200'
                    : isDarkMode
                      ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.checked
                    ? 'bg-green-500 border-green-500'
                    : isDarkMode
                      ? 'border-slate-600'
                      : 'border-gray-300'
                }`}>
                  {item.checked && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    item.checked
                      ? isDarkMode ? 'text-green-400 line-through' : 'text-green-700 line-through'
                      : isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {item.icon} {item.text}
                  </p>
                  {item.context && !item.checked && (
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      <AlertCircle size={10} />
                      {item.context}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onComplete}
            className={`w-full py-3 rounded-xl font-bold transition-colors ${
              progress === 100
                ? 'bg-green-600 text-white hover:bg-green-700'
                : isDarkMode
                  ? 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {progress === 100 ? '✅ All Set! Start Trip' : "I'm Ready!"}
          </button>
          <button
            onClick={onDismiss}
            className={`w-full py-2 mt-2 text-sm transition-colors ${
              isDarkMode
                ? 'text-gray-500 hover:text-gray-400'
                : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};
