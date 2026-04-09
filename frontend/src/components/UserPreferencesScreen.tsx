// src/components/UserPreferencesScreen.tsx
// Onboarding screen for user POI preferences

import React, { useState } from 'react';
import { X, Check, ChevronRight } from 'lucide-react';
import { POICategory, POI_CATEGORIES, UserPOIPreferences } from '../types/poi';
import { getUserPOIPreferences, saveUserPOIPreferences, markOnboardingComplete } from '../services/userPreferencesService';

interface UserPreferencesScreenProps {
  isDarkMode: boolean;
  onComplete: (preferences: UserPOIPreferences) => void;
  onSkip: () => void;
}

export const UserPreferencesScreen: React.FC<UserPreferencesScreenProps> = ({
  isDarkMode,
  onComplete,
  onSkip
}) => {
  const existingPrefs = getUserPOIPreferences();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPOIPreferences>({
    ageGroup: existingPrefs.ageGroup || 'professional',
    travelStyle: existingPrefs.travelStyle || 'comfort',
    interests: existingPrefs.interests || [],
    accessibility: existingPrefs.accessibility || false,
    travelingWith: existingPrefs.travelingWith || 'solo'
  });

  const ageGroups = [
    { id: 'youth', icon: '🧑', label: 'Youth (18-25)', desc: 'Adventure, nightlife, budget travel' },
    { id: 'professional', icon: '💼', label: 'Professional (26-40)', desc: 'Efficiency, comfort, work-life' },
    { id: 'family', icon: '👨‍👩‍👧', label: 'Family (41-60)', desc: 'Safety, kids, family activities' },
    { id: 'senior', icon: '👴', label: 'Senior (60+)', desc: 'Health, accessibility, rest stops' }
  ];

  const travelStyles = [
    { id: 'budget', icon: '💰', label: 'Budget', desc: 'Affordable options, deals' },
    { id: 'comfort', icon: '😌', label: 'Comfort', desc: 'Good value, clean, convenient' },
    { id: 'luxury', icon: '✨', label: 'Luxury', desc: 'Premium, 5-star, exclusive' },
    { id: 'adventure', icon: '🎯', label: 'Adventure', desc: 'Thrill-seeking, outdoor, unique' }
  ];

  const travelingWith = [
    { id: 'solo', icon: '🧍', label: 'Solo' },
    { id: 'couple', icon: '👫', label: 'Couple' },
    { id: 'family', icon: '👨‍👩‍👧‍👦', label: 'Family' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'elderly', icon: '👴', label: 'With Elderly' }
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      saveUserPOIPreferences(preferences);
      markOnboardingComplete();
      onComplete(preferences);
    }
  };

  const toggleInterest = (category: POICategory) => {
    setPreferences(prev => {
      const interests = prev.interests || [];
      const index = interests.indexOf(category);
      if (index >= 0) {
        return { ...prev, interests: interests.filter(i => i !== category) };
      } else {
        return { ...prev, interests: [...interests, category] };
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-blue-600' : isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <button
            onClick={onSkip}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Step 0: Age Group */}
          {step === 0 && (
            <div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                👋 Tell us about yourself
              </h3>
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                We'll personalize your experience
              </p>

              <div className="space-y-3">
                {ageGroups.map(ag => (
                  <button
                    key={ag.id}
                    onClick={() => setPreferences(prev => ({ ...prev, ageGroup: ag.id as any }))}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      preferences.ageGroup === ag.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : isDarkMode
                          ? 'border-slate-700 hover:border-slate-600'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">{ag.icon}</span>
                    <div className="text-left flex-1">
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {ag.label}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {ag.desc}
                      </p>
                    </div>
                    {preferences.ageGroup === ag.id && (
                      <Check size={20} className="text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Travel Style */}
          {step === 1 && (
            <div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                🎒 What's your travel style?
              </h3>
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                We'll suggest places that match your preferences
              </p>

              <div className="grid grid-cols-2 gap-3">
                {travelStyles.map(ts => (
                  <button
                    key={ts.id}
                    onClick={() => setPreferences(prev => ({ ...prev, travelStyle: ts.id as any }))}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      preferences.travelStyle === ts.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : isDarkMode
                          ? 'border-slate-700 hover:border-slate-600'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl mb-2">{ts.icon}</span>
                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {ts.label}
                    </p>
                    <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {ts.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Traveling With */}
          {step === 2 && (
            <div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                👥 Who are you traveling with?
              </h3>
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                We'll prioritize places suitable for your group
              </p>

              <div className="flex flex-wrap gap-2">
                {travelingWith.map(tw => (
                  <button
                    key={tw.id}
                    onClick={() => setPreferences(prev => ({ ...prev, travelingWith: tw.id as any }))}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      preferences.travelingWith === tw.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : isDarkMode
                          ? 'border-slate-700 hover:border-slate-600 text-gray-300'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-xl">{tw.icon}</span>
                    <span className="font-bold text-sm">{tw.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.accessibility}
                    onChange={(e) => setPreferences(prev => ({ ...prev, accessibility: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ♿ I need wheelchair accessibility
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      We'll prioritize accessible places
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Interests */}
          {step === 3 && (
            <div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                🎯 What interests you? (select all)
              </h3>
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                We'll suggest places you'll love
              </p>

              <div className="grid grid-cols-3 gap-2">
                {POI_CATEGORIES.slice(0, 18).map(cat => {
                  const isSelected = preferences.interests?.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleInterest(cat.id)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : isDarkMode
                            ? 'border-slate-700 hover:border-slate-600'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl mb-1">{cat.icon}</span>
                      <span className={`text-[10px] font-bold text-center ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300'
                          : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className={`text-xs mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {preferences.interests?.length || 0} selected • You can change this later
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onSkip}
            className={`px-4 py-2 text-sm font-bold ${
              isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
            }`}
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {step < 3 ? 'Next' : 'Done'}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
