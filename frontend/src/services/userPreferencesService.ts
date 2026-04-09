// src/services/userPreferencesService.ts
// Manages user POI preferences and profile

import { UserPOIPreferences } from '../types/poi';

const PREFS_KEY = 'merosadak_user_poi_preferences';
const PROFILE_KEY = 'merosadak_user_profile';

// Default preferences
const DEFAULT_PREFERENCES: UserPOIPreferences = {
  ageGroup: 'professional',
  travelStyle: 'comfort',
  interests: ['food', 'fuel', 'medical', 'tourist'],
  accessibility: false,
  travelingWith: 'solo'
};

// Get user POI preferences
export function getUserPOIPreferences(): UserPOIPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    
    const prefs = JSON.parse(stored);
    // Merge with defaults to ensure all fields exist
    return { ...DEFAULT_PREFERENCES, ...prefs };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// Save user POI preferences
export function saveUserPOIPreferences(prefs: UserPOIPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('[UserPreferences] Failed to save preferences:', err);
  }
}

// Update single preference
export function updatePOIPreference<K extends keyof UserPOIPreferences>(
  key: K,
  value: UserPOIPreferences[K]
): void {
  try {
    const prefs = getUserPOIPreferences();
    prefs[key] = value;
    saveUserPOIPreferences(prefs);
  } catch (err) {
    console.error('[UserPreferences] Failed to update preference:', err);
  }
}

// Add/remove interest
export function toggleInterest(category: string): void {
  try {
    const prefs = getUserPOIPreferences();
    const interests = prefs.interests || [];
    
    const index = interests.indexOf(category as any);
    if (index >= 0) {
      interests.splice(index, 1);
    } else {
      interests.push(category as any);
    }
    
    prefs.interests = interests;
    saveUserPOIPreferences(prefs);
  } catch (err) {
    console.error('[UserPreferences] Failed to toggle interest:', err);
  }
}

// Learn from user behavior (which POIs they tap)
export function recordPOIInteraction(category: string, action: 'view' | 'select' | 'navigate'): void {
  try {
    const prefs = getUserPOIPreferences();
    
    // Track favorite categories
    if (!prefs.favoriteCategories) {
      prefs.favoriteCategories = [];
    }
    
    if (action === 'select' || action === 'navigate') {
      const catIndex = prefs.favoriteCategories.indexOf(category as any);
      
      if (catIndex >= 0) {
        // Move to front (more recent = more important)
        prefs.favoriteCategories.splice(catIndex, 1);
      }
      
      // Add to front
      prefs.favoriteCategories.unshift(category as any);
      
      // Keep only top 5
      prefs.favoriteCategories = prefs.favoriteCategories.slice(0, 5);
      
      saveUserPOIPreferences(prefs);
    }
  } catch (err) {
    console.error('[UserPreferences] Failed to record interaction:', err);
  }
}

// Get age group display info
export function getAgeGroupInfo(ageGroup: string): { label: string; icon: string; description: string } {
  const ageGroups: Record<string, { label: string; icon: string; description: string }> = {
    youth: { label: 'Youth (18-25)', icon: '🧑', description: 'Adventure, nightlife, budget travel' },
    professional: { label: 'Professional (26-40)', icon: '💼', description: 'Efficiency, comfort, work-life balance' },
    family: { label: 'Family (41-60)', icon: '👨‍👩‍👧', description: 'Safety, kids, family activities' },
    senior: { label: 'Senior (60+)', icon: '👴', description: 'Health, accessibility, rest stops' }
  };
  
  return ageGroups[ageGroup] || ageGroups.professional;
}

// Get travel style display info
export function getTravelStyleInfo(style: string): { label: string; icon: string; description: string } {
  const styles: Record<string, { label: string; icon: string; description: string }> = {
    budget: { label: 'Budget', icon: '💰', description: 'Affordable options, deals, free attractions' },
    comfort: { label: 'Comfort', icon: '😌', description: 'Good value, clean, convenient' },
    luxury: { label: 'Luxury', icon: '✨', description: 'Premium experiences, 5-star, exclusive' },
    adventure: { label: 'Adventure', icon: '🎯', description: 'Thrill-seeking, outdoor, unique' }
  };
  
  return styles[style] || styles.comfort;
}

// Reset preferences to defaults
export function resetPOIPreferences(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULT_PREFERENCES));
  } catch (err) {
    console.error('[UserPreferences] Failed to reset preferences:', err);
  }
}

// Check if user has completed onboarding
export function hasCompletedOnboarding(): boolean {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    return !!stored;
  } catch {
    return false;
  }
}

// Mark onboarding as completed
export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ completed: true, timestamp: new Date().toISOString() }));
  } catch (err) {
    console.error('[UserPreferences] Failed to mark onboarding complete:', err);
  }
}
