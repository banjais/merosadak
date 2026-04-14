// src/api.ts
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove leading /v1 or /api from endpoint to avoid duplication
  const normalizedEndpoint = cleanEndpoint.replace(/^\/api/, '').replace(/^\/v1/, '');

  // Build URL: /api/...
  const url = `${API_BASE}${normalizedEndpoint}`;

  // Get auth token from localStorage (matches AuthContext key)
  const token = localStorage.getItem('token');

  const res = await fetch(url, {
    ...options,
    mode: 'cors',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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