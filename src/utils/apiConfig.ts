export const WORKER_BASE_URL = 'https://merosadak.banjays.workers.dev';

export function getApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${WORKER_BASE_URL}${cleanEndpoint}`;
}
