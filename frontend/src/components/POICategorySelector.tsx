// src/components/POICategorySelector.tsx
// Horizontal scroll category selector with age-based relevance

import React from 'react';
import { POICategory, POI_CATEGORIES, UserPOIPreferences } from '../types/poi';
import { getCategoryColorClass } from '../services/enhancedPOIService';

interface POICategorySelectorProps {
  isDarkMode: boolean;
  selectedCategory: POICategory | null;
  onSelect: (category: POICategory) => void;
  userPreferences: UserPOIPreferences;
  showAll?: boolean;
}

export const POICategorySelector: React.FC<POICategorySelectorProps> = ({
  isDarkMode,
  selectedCategory,
  onSelect,
  userPreferences,
  showAll = false
}) => {
  // Get categories sorted by age relevance
  const sortedCategories = POI_CATEGORIES
    .filter(cat => {
      if (showAll) return true;
      // Show categories with at least 40% relevance to user's age group
      return cat.ageRelevance[userPreferences.ageGroup] >= 0.4;
    })
    .sort((a, b) => 
      b.ageRelevance[userPreferences.ageGroup] - a.ageRelevance[userPreferences.ageGroup]
    );

  return (
    <div className="py-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {sortedCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const colorClass = getCategoryColorClass(cat.id);
          const relevance = cat.ageRelevance[userPreferences.ageGroup];
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white scale-110 shadow-lg'
                  : `${colorClass} hover:scale-105`
              }`}
              style={{ minWidth: '64px' }}
              title={cat.name}
            >
              <span className="text-xl mb-1">{cat.icon}</span>
              <span className="text-[10px] font-bold leading-tight text-center">
                {cat.name}
              </span>
              {!isSelected && relevance < 0.6 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full text-[8px] flex items-center justify-center text-white opacity-50">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
