/**
 * SadakSathi API Service (.ts)
 * 🟢 FORCE LOCAL PROXY: Connects to localhost:5173 -> localhost:4000
 */

// 1. TYPES & INTERFACES
export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
  count?: number;
}

// Define the structure for your road/map data
export interface GeoData {
  type: string;
  features: any[];
}

const API_PREFIX = '/api/v1';

console.log('🔌 API Service: Using Local Proxy (TypeScript)');

/**
 * Generic Fetch Wrapper
 */
const fetchJSON = async <T>(endpoint: string): Promise<T | null> => {
  try {
    const response = await fetch(`${API_PREFIX}${endpoint}`);
    
    // Handle the 403/404 errors gracefully
    if (!response.ok) {
      console.warn(`⚠️ API Warning: ${endpoint} returned status ${response.status}`);
      return null;
    }
    
    const result: ApiResponse<T> = await response.json();
    return result.data;
  } catch (error) {
    console.error(`❌ API Error at ${endpoint}:`, error);
    return null;
  }
};

// 2. EXPORTED SERVICE
export const api = {
  getRoads: () => fetchJSON<GeoData>('/roads'),
  
  /** * getBoundary: Updated to reflect the deletion of the 5 files.
   * Now fetches the single merged/master boundary.
   */
  getBoundary: () => fetchJSON<GeoData>('/boundary'),
  
  getPois: () => fetchJSON<any[]>('/pois'),
  
  getTraffic: () => fetchJSON<any>('/traffic'),
  
  getMonsoon: () => fetchJSON<any>('/monsoon'),
  
  getAlerts: async (): Promise<any[]> => (await fetchJSON<any[]>('/alerts')) || [],
  
  getWeather: (lat: number, lon: number) => 
    fetchJSON<any>(`/weather?lat=${lat}&lon=${lon}`),
};