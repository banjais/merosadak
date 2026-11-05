import type { CityNode } from '../types';

const KEY = 'merosadak-recent-places';
const MAX = 5;

/** Ids of the last destinations the person picked, newest first. */
export function getRecentPlaceIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberRecentPlace(id: string): void {
  if (!id) return;
  try {
    const next = [id, ...getRecentPlaceIds().filter((x) => x !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode): recents are optional */
  }
}

/**
 * With an empty query, put recently picked places first so a repeat trip is
 * one tap. Any typed query keeps the normal ranking untouched.
 */
export function withRecentsFirst(
  results: CityNode[],
  allCities: CityNode[],
  query: string,
  excludeId?: string
): { list: CityNode[]; recentCount: number } {
  if (query.trim().length > 0) return { list: results, recentCount: 0 };
  const byId = new Map(allCities.map((c) => [c.id, c] as const));
  const recents = getRecentPlaceIds()
    .filter((id) => id !== excludeId)
    .map((id) => byId.get(id))
    .filter((c): c is CityNode => !!c);
  if (recents.length === 0) return { list: results, recentCount: 0 };
  const seen = new Set(recents.map((c) => c.id));
  return { list: [...recents, ...results.filter((c) => !seen.has(c.id))], recentCount: recents.length };
}
