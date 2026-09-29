/**
 * Queue failed API POST/PUT/PATCH bodies and replay via Background Sync
 * (or window 'online' fallback when SyncManager is unavailable).
 */

const DB_NAME = 'merosadak-bg-sync';
const STORE = 'outbox';
const DB_VERSION = 1;
export const SYNC_TAG = 'merosadak-api-outbox';

export type QueuedMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface QueuedRequest {
  id: string;
  url: string;
  method: QueuedMethod;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    try {
      const result = fn(store);
      if (result instanceof Promise) {
        result.then(resolve).catch(reject);
        return;
      }
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function enqueueRequest(
  entry: Omit<QueuedRequest, 'id' | 'createdAt' | 'attempts'> & { id?: string }
): Promise<QueuedRequest> {
  const item: QueuedRequest = {
    id: entry.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    url: entry.url,
    method: entry.method,
    headers: entry.headers || {},
    body: entry.body,
    createdAt: Date.now(),
    attempts: 0,
    lastError: entry.lastError,
  };
  await withStore('readwrite', (store) => store.put(item));
  await requestBackgroundSync();
  return item;
}

export async function listQueued(): Promise<QueuedRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedRequest[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueued(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function updateQueued(item: QueuedRequest): Promise<void> {
  await withStore('readwrite', (store) => store.put(item));
}

/** Ask the service worker / browser to flush the outbox when network returns */
export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (anyReg.sync) {
      await anyReg.sync.register(SYNC_TAG);
      return true;
    }
    // Fallback: tell SW to try now
    reg.active?.postMessage({ type: 'FLUSH_OUTBOX' });
    return false;
  } catch {
    return false;
  }
}

/**
 * POST JSON with automatic queue on network failure.
 * Returns { ok, queued, data?, status? }.
 */
export async function postJsonWithBackgroundSync<T = unknown>(
  url: string,
  body: unknown,
  init?: Omit<RequestInit, 'method' | 'body'>
): Promise<{ ok: boolean; queued: boolean; data?: T; status?: number; queueId?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const bodyStr = JSON.stringify(body);

  try {
    const res = await fetch(url, {
      ...init,
      method: 'POST',
      headers,
      body: bodyStr,
    });
    const contentType = res.headers.get('content-type') || '';
    let data: T | undefined;
    if (contentType.includes('application/json')) {
      data = (await res.json()) as T;
    }
    if (res.ok) {
      return { ok: true, queued: false, data, status: res.status };
    }
    // 4xx: do not queue (client error)
    if (res.status >= 400 && res.status < 500) {
      return { ok: false, queued: false, data, status: res.status };
    }
    // 5xx: queue for retry
    const item = await enqueueRequest({
      url,
      method: 'POST',
      headers,
      body: bodyStr,
      lastError: `HTTP ${res.status}`,
    });
    return { ok: false, queued: true, data, status: res.status, queueId: item.id };
  } catch (err) {
    // Network / offline
    const item = await enqueueRequest({
      url,
      method: 'POST',
      headers,
      body: bodyStr,
      lastError: err instanceof Error ? err.message : 'network',
    });
    return { ok: false, queued: true, queueId: item.id };
  }
}

/** Replay queue from the page (fallback when SyncManager missing) */
export async function flushOutboxFromClient(): Promise<{ sent: number; failed: number }> {
  const items = await listQueued();
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await removeQueued(item.id);
        sent++;
      } else {
        item.attempts += 1;
        item.lastError = `HTTP ${res.status}`;
        await updateQueued(item);
        failed++;
      }
    } catch (e) {
      item.attempts += 1;
      item.lastError = e instanceof Error ? e.message : 'network';
      await updateQueued(item);
      failed++;
    }
  }
  return { sent, failed };
}

/** Wire once: flush when browser comes online */
export function setupOutboxOnlineListener(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => {
    void requestBackgroundSync();
    void flushOutboxFromClient();
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
