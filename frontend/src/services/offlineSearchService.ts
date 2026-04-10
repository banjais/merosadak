// frontend/src/services/offlineSearchService.ts
// IndexedDB-based offline search index for POIs and road status

const DB_NAME = 'merosadak_offline_search';
const DB_VERSION = 1;
const STORE_POIS = 'pois';
const STORE_ROADS = 'roads';
const STORE_METADATA = 'metadata';

export interface OfflinePOI {
  id: string;
  name: string;
  nameNe?: string; // Nepali name
  category: string;
  lat: number;
  lng: number;
  district?: string;
  address?: string;
  phone?: string;
  openHours?: string;
}

export interface OfflineRoad {
  id: string;
  name: string;
  refno: string;
  status: 'Blocked' | 'One-Lane' | 'Resumed';
  district?: string;
  place?: string;
  chainage?: string;
}

export interface SearchIndexMetadata {
  lastUpdated: string;
  poiCount: number;
  roadCount: number;
  version: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_POIS)) {
        const poiStore = db.createObjectStore(STORE_POIS, { keyPath: 'id' });
        poiStore.createIndex('name', 'name', { unique: false });
        poiStore.createIndex('category', 'category', { unique: false });
        poiStore.createIndex('district', 'district', { unique: false });
        poiStore.createIndex('name_category', ['name', 'category'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ROADS)) {
        const roadStore = db.createObjectStore(STORE_ROADS, { keyPath: 'id' });
        roadStore.createIndex('name', 'name', { unique: false });
        roadStore.createIndex('refno', 'refno', { unique: false });
        roadStore.createIndex('status', 'status', { unique: false });
        roadStore.createIndex('district', 'district', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putToStore<T>(storeName: string, data: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    // Clear existing data
    store.clear();
    // Add new data
    data.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const offlineSearchService = {
  /** Index POIs for offline search */
  async indexPOIs(pois: OfflinePOI[]): Promise<void> {
    await putToStore(STORE_POIS, pois);
    await this.updateMetadata({ poiCount: pois.length });
  },

  /** Index road status for offline search */
  async indexRoads(roads: OfflineRoad[]): Promise<void> {
    await putToStore(STORE_ROADS, roads);
    await this.updateMetadata({ roadCount: roads.length });
  },

  /** Search POIs offline */
  async searchPOIs(query: string, category?: string): Promise<OfflinePOI[]> {
    const pois = await getAllFromStore<OfflinePOI>(STORE_POIS);
    const q = query.toLowerCase().trim();

    if (!q) return category ? pois.filter(p => p.category === category) : pois;

    return pois.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nameNe?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.district?.toLowerCase().includes(q) ||
      (!category || p.category === category)
    );
  },

  /** Search roads offline */
  async searchRoads(query: string, status?: string): Promise<OfflineRoad[]> {
    const roads = await getAllFromStore<OfflineRoad>(STORE_ROADS);
    const q = query.toLowerCase().trim();

    if (!q) return status ? roads.filter(r => r.status === status) : roads;

    return roads.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.refno.toLowerCase().includes(q) ||
      r.district?.toLowerCase().includes(q) ||
      r.place?.toLowerCase().includes(q) ||
      (!status || r.status === status)
    );
  },

  /** Combined search */
  async search(query: string): Promise<{ pois: OfflinePOI[]; roads: OfflineRoad[] }> {
    const [pois, roads] = await Promise.all([
      this.searchPOIs(query),
      this.searchRoads(query),
    ]);
    return { pois, roads };
  },

  /** Get metadata */
  async getMetadata(): Promise<SearchIndexMetadata | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);
        const request = store.get('index');
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /** Update metadata */
  async updateMetadata(updates: Partial<SearchIndexMetadata>): Promise<void> {
    try {
      const db = await openDB();
      const existing = await this.getMetadata();
      const metadata = {
        key: 'index',
        lastUpdated: new Date().toISOString(),
        poiCount: existing?.poiCount || 0,
        roadCount: existing?.roadCount || 0,
        version: 1,
        ...updates,
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_METADATA, 'readwrite');
        const store = tx.objectStore(STORE_METADATA);
        store.put(metadata);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('[OfflineSearch] Failed to update metadata:', e);
    }
  },

  /** Check if index is populated */
  async isIndexed(): Promise<boolean> {
    const meta = await this.getMetadata();
    return meta !== null && (meta.poiCount > 0 || meta.roadCount > 0);
  },

  /** Clear all offline indexes */
  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_POIS, STORE_ROADS, STORE_METADATA], 'readwrite');
      tx.objectStore(STORE_POIS).clear();
      tx.objectStore(STORE_ROADS).clear();
      tx.objectStore(STORE_METADATA).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get storage usage estimate */
  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  },
};
