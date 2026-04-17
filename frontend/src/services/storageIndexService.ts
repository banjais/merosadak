// frontend/src/services/storageIndexService.ts
// Unified interface for all storage operations + initialization

import { routeHistoryService } from './routeHistoryService';
import { savedLocationsService } from './savedLocationsService';
import { offlineSearchService } from './offlineSearchService';
import { mapStateService } from './mapStateService';
import { incidentDraftService } from './incidentDraftService';
import { themeService } from './themeService';
import { notificationStateService } from './notificationStateService';

export interface StorageSummary {
  routeHistory: { count: number; totalDistance: number };
  savedLocations: { count: number; mostVisited: Array<{ name: string; count: number }> };
  offlineSearch: { indexed: boolean; lastUpdated: string | null };
  mapState: { hasState: boolean; center: { lat: number; lng: number }; zoom: number };
  incidentDrafts: { count: number };
  /** Stores the active primary theme color from the 6-color palette */
  accentColor: string;
  theme: { mode: string; applied: string };
  notifications: { enabled: boolean; permission: string };
}

/**
 * Initialize all storage services
 * Call this once when the app starts
 */
export async function initializeStorage(): Promise<void> {
  try {
    // Apply saved theme
    themeService.applyToDocument();

    // Sync notification state with browser
    await notificationStateService.syncWithBrowser();

    console.log('[Storage] All services initialized');
  } catch (e) {
    console.error('[Storage] Initialization failed:', e);
  }
}

/**
 * Get a complete summary of all stored data
 */
export async function getStorageSummary(): Promise<StorageSummary> {
  const [meta, usage] = await Promise.allSettled([
    offlineSearchService.getMetadata(),
    offlineSearchService.getStorageUsage(),
  ]);

  return {
    routeHistory: {
      count: routeHistoryService.getHistory().length,
      totalDistance: routeHistoryService.getTotalDistance(),
    },
    savedLocations: {
      count: savedLocationsService.getCount(),
      mostVisited: savedLocationsService.getMostVisited(3),
    },
    offlineSearch: {
      indexed: meta.status === 'fulfilled' ? await offlineSearchService.isIndexed() : false,
      lastUpdated: meta.status === 'fulfilled' ? meta.value?.lastUpdated || null : null,
    },
    mapState: {
      hasState: mapStateService.hasState(),
      center: mapStateService.get().center,
      zoom: mapStateService.get().zoom,
    },
    incidentDrafts: {
      count: incidentDraftService.getCount(),
    },
    accentColor: localStorage.getItem('merosadak_accent_color') || 'blue',
    theme: {
      mode: themeService.get().mode,
      applied: themeService.getAppliedTheme(),
    },
    notifications: {
      enabled: notificationStateService.get().enabled,
      permission: notificationStateService.get().permission,
    },
  };
}

/**
 * Clear ALL user data
 */
export async function clearAllStorage(): Promise<void> {
  routeHistoryService.clear();
  savedLocationsService.clear();
  await offlineSearchService.clear();
  mapStateService.reset(); // Resets zoom and center
  incidentDraftService.clearAll();
  themeService.reset?.(); // themeService doesn't have reset, but we can clear the key
  // Clear the logo-selected color
  localStorage.removeItem('merosadak_accent_color');
  notificationStateService.reset();

  // Clear other existing keys
  localStorage.removeItem('merosadak_user_poi_preferences');
  localStorage.removeItem('merosadak_user_profile');
  localStorage.removeItem('merosadak_travel_plans');
  localStorage.removeItem('merosadak_active_plan');
  localStorage.removeItem('merosadak_checklists');
  localStorage.removeItem('merosadak_recent_searches');
  localStorage.removeItem('nepal_traveler_session');

  console.log('[Storage] All user data cleared');
}

/**
 * Partial Purge: Clears ephemeral data (incidents, map state, search cache)
 * but preserves the user login session, profile, and saved locations.
 */
export async function purgeAppData(): Promise<void> {
  // Clear map and search caches
  await offlineSearchService.clear();
  mapStateService.reset();

  // Clear incident drafts and recent search history
  incidentDraftService.clearAll();
  localStorage.removeItem('merosadak_recent_searches');

  console.log('[Storage] Ephemeral app data purged (Session Preserved)');
}

/**
 * Export all user data as JSON (for backup/transfer)
 */
export async function exportAllData(): Promise<string> {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    routeHistory: routeHistoryService.getHistory(),
    savedLocations: savedLocationsService.getLocations(),
    mapState: mapStateService.get(),
    theme: themeService.get(),
    notifications: notificationStateService.get(),
    incidentDrafts: incidentDraftService.getDrafts(),
    // Note: Offline search index is IndexedDB, not easily exportable
  };

  return JSON.stringify(data, null, 2);
}

// Re-export all services for convenience
export {
  routeHistoryService,
  savedLocationsService,
  offlineSearchService,
  mapStateService,
  incidentDraftService,
  themeService,
  notificationStateService,
};
