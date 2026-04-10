// frontend/src/services/mapStateService.ts
// Persists map viewport state (center, zoom, style, layers)

const STORAGE_KEY = 'merosadak_map_state';

export interface MapState {
  center: { lat: number; lng: number };
  zoom: number;
  mapStyle: 'standard' | 'satellite' | 'terrain';
  darkMode: boolean;
  layers: {
    boundaries: boolean;
    roads: boolean;
    traffic: boolean;
    pois: boolean;
    monsoon: boolean;
    weather: boolean;
    waze: boolean;
  };
  lastUpdated: string;
}

const DEFAULT_STATE: MapState = {
  center: { lat: 27.7172, lng: 85.3240 }, // Kathmandu
  zoom: 12,
  mapStyle: 'standard',
  darkMode: false,
  layers: {
    boundaries: false,
    roads: true,
    traffic: true,
    pois: true,
    monsoon: false,
    weather: false,
    waze: false,
  },
  lastUpdated: new Date().toISOString(),
};

function getState(): MapState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle new fields
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: Partial<MapState>): void {
  try {
    const current = getState();
    const updated = {
      ...current,
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[MapState] Failed to save:', e);
  }
}

export const mapStateService = {
  /** Get current map state */
  get: (): MapState => getState(),

  /** Update map center */
  setCenter: (lat: number, lng: number): void => {
    saveState({ center: { lat, lng } });
  },

  /** Update zoom level */
  setZoom: (zoom: number): void => {
    saveState({ zoom });
  },

  /** Update map style */
  setStyle: (style: MapState['mapStyle']): void => {
    saveState({ mapStyle: style });
  },

  /** Update dark mode */
  setDarkMode: (dark: boolean): void => {
    saveState({ darkMode: dark });
  },

  /** Update layer visibility */
  setLayer: (layer: keyof MapState['layers'], visible: boolean): void => {
    const current = getState();
    saveState({
      layers: { ...current.layers, [layer]: visible },
    });
  },

  /** Batch update layers */
  setLayers: (layers: Partial<MapState['layers']>): void => {
    const current = getState();
    saveState({
      layers: { ...current.layers, ...layers },
    });
  },

  /** Reset to defaults */
  reset: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

  /** Check if state exists */
  hasState: (): boolean => {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },
};
