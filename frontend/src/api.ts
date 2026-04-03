// frontend/src/api.ts
// Centralized API client — points to backend on Cloudflare Workers

const DEFAULT_BASE = "https://sadaksathi.banjays.workers.dev/api";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE;

// Build full URL:  BASE_URL + "/v1" + endpoint
function buildUrl(endpoint: string): string {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const path = clean.startsWith("/v1") ? clean : `/v1${clean}`;
  return `${BASE_URL}${path}`;
}

// ---- Types ----
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

// ---- Core fetch wrapper ----
export async function apiFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = buildUrl(endpoint);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
    mode: BASE_URL.startsWith("http") ? "cors" : "same-origin",
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  const json = await res.json();
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

// ---- Convenience helpers ----
export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path),
  post: <T = any>(path: string, body: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  put: <T = any>(path: string, body: unknown) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  del: <T = any>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};
