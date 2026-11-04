import { auth } from '../firebase';

export const WORKER_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const meta = document.querySelector('meta[name="worker-base-url"]');
    if (meta) return (meta as HTMLMetaElement).content;
    const url = (import.meta as any)?.env?.VITE_WORKER_URL;
    if (url) return url;
  }
  return 'https://merosadak.banjays.workers.dev';
})();

export function getApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${WORKER_BASE_URL.replace(/\/+$/, '')}${cleanEndpoint}`;
}

export async function fetchJson<T = unknown>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), init);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${endpoint} (HTTP ${response.status}, ${contentType || 'unknown content type'})`);
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(`API request failed for ${endpoint} (HTTP ${response.status})`) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}


/** Call a Worker endpoint with the current Firebase user's signed ID token. */
export async function fetchJsonWithFirebaseAuth<T = unknown>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in with Google to use this personal feature.');
  }
  const token = await currentUser.getIdToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetchJson<T>(endpoint, { ...init, headers });
}
