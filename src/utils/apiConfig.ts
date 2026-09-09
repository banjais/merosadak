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
  return `${WORKER_BASE_URL}${cleanEndpoint}`;
}
