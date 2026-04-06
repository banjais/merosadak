// src/api.ts
// Use relative path for API requests - works with Firebase Hosting proxy
const API_BASE = '/api';

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove leading /v1 or /api from endpoint to avoid duplication
  const normalizedEndpoint = cleanEndpoint.replace(/^\/api/, '').replace(/^\/v1/, '');
  
  // Build URL: /api/v1/...
  const url = `${API_BASE}/v1${normalizedEndpoint}`;

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