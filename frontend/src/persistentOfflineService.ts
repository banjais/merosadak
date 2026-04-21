/**
 * Persistent Offline Service
 * Handles IndexedDB storage for large GeoJSON datasets to ensure
 * the highway network is available immediately on startup without network.
 */
import LZString from "lz-string";

const DB_NAME = 'MeroSadakOffline';
const STORE_NAME = 'geo_cache';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const persistentStorage = {
    async save(key: string, data: any): Promise<void> {
        try {
            // Obfuscate and compress the data before saving to disk
            // This prevents users from simply copying the raw GeoJSON from their browser tools
            const compressed = LZString.compressToUTF16(JSON.stringify(data));

            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(compressed, key);
            return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
        } catch (err) {
            console.warn('[Storage] Failed to save to IndexedDB:', err);
        }
    },

    async get(key: string): Promise<any | null> {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const val = request.result;
                if (!val) return resolve(null);
                // Decompress and parse back to JSON for app use
                try {
                    const decompressed = LZString.decompressFromUTF16(val);
                    resolve(decompressed ? JSON.parse(decompressed) : null);
                } catch (e) {
                    resolve(null);
                }
            };
        });
    }
};