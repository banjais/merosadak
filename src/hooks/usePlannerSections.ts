import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mero-sadak:planner-sections';

export interface PlannerSectionState {
  /** Display order of section ids. Ids missing from the list are appended. */
  order: string[];
  /** Ids currently expanded. Ids missing from the set default to collapsed. */
  expanded: string[];
  /** Ids the user has explicitly expanded, so a reset can restore them. */
  defaults: string[];
}

export interface UsePlannerSections {
  state: PlannerSectionState;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  move: (id: string, direction: -1 | 1) => void;
  reset: () => void;
}

function read(): PlannerSectionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.defaults)) return null;
    return {
      order: parsed.order.filter((v: unknown): v is string => typeof v === 'string'),
      expanded: Array.isArray(parsed.expanded)
        ? parsed.expanded.filter((v: unknown): v is string => typeof v === 'string')
        : parsed.defaults,
      defaults: parsed.defaults.filter((v: unknown): v is string => typeof v === 'string'),
    };
  } catch {
    return null;
  }
}

function write(state: PlannerSectionState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — section state is a convenience, not critical */
  }
}

/**
 * Collapsed/expanded state plus display order for the route planner sections.
 * Persisted to localStorage so the layout survives reloads, and tolerant of
 * sections being added or removed between app versions.
 */
export function usePlannerSections(knownIds: string[], defaultExpandedIds: string[]): UsePlannerSections {
  const [state, setState] = useState<PlannerSectionState>(() => {
    const stored = read();
    if (!stored) {
      return { order: knownIds, expanded: defaultExpandedIds, defaults: defaultExpandedIds };
    }
    // Keep the persisted order for ids that still exist, then append new ones.
    const kept = stored.order.filter((id) => knownIds.includes(id));
    const added = knownIds.filter((id) => !kept.includes(id));
    return { ...stored, order: [...kept, ...added] };
  });

  useEffect(() => {
    write(state);
  }, [state]);

  // If the set of known sections changes, fold any new ids into the order.
  useEffect(() => {
    setState((prev) => {
      const missing = knownIds.filter((id) => !prev.order.includes(id));
      if (missing.length === 0) return prev;
      return { ...prev, order: [...prev.order, ...missing] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownIds.join('|')]);

  const isExpanded = useCallback(
    (id: string) => state.expanded.includes(id),
    [state.expanded]
  );

  const setExpanded = useCallback((id: string, expanded: boolean) => {
    setState((prev) => ({
      ...prev,
      expanded: expanded
        ? Array.from(new Set([...prev.expanded, id]))
        : prev.expanded.filter((v) => v !== id),
    }));
  }, []);

  const toggle = useCallback((id: string) => {
    setState((prev) =>
      prev.expanded.includes(id)
        ? { ...prev, expanded: prev.expanded.filter((v) => v !== id) }
        : { ...prev, expanded: [...prev.expanded, id] }
    );
  }, []);

  const move = useCallback((id: string, direction: -1 | 1) => {
    setState((prev) => {
      const order = [...prev.order];
      const from = order.indexOf(id);
      if (from < 0) return prev;
      const to = from + direction;
      if (to < 0 || to >= order.length) return prev;
      [order[from], order[to]] = [order[to], order[from]];
      return { ...prev, order };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, order: knownIds, expanded: prev.defaults }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownIds.join('|')]);

  return { state, isExpanded, toggle, setExpanded, move, reset };
}
