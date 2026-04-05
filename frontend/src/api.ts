// src/api.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://merosadak.banjays.workers.dev";

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint.startsWith('/v1') ? '' : '/v1'}${cleanEndpoint}`;

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