// src/api.ts
let BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://merosadak.banjays.workers.dev";

// Ensure BASE_URL doesn't have trailing slash
BASE_URL = BASE_URL.replace(/\/$/, '');

// Check if BASE_URL already includes /api prefix
const hasApiPrefix = BASE_URL.endsWith('/api');

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove leading /v1 or /api from endpoint to avoid duplication
  const normalizedEndpoint = cleanEndpoint.replace(/^\/api/, '').replace(/^\/v1/, '');
  
  // Build URL: add /api if not already in BASE_URL
  const url = hasApiPrefix 
    ? `${BASE_URL}/v1${normalizedEndpoint}` 
    : `${BASE_URL}/api/v1${normalizedEndpoint}`;

  const res = await fetch(url, {
    ...options,
    mode: 'cors',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }

  const json = await res.json();
  return json.data ?? json;
}