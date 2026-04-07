// src/hooks/useHighways.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';
import type { GeoData } from '../services/apiService';

export interface HighwayInfo {
  code: string;
  file: string;
  name?: string;
}

export function useHighways() {
  const [highwayList, setHighwayList] = useState<HighwayInfo[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadHighwayList = useCallback(async () => {
    try {
      setIsLoadingList(true);
      setListError(null);
      const list = await api.getHighwayList();
      setHighwayList(list);
    } catch (err: any) {
      console.error("[useHighways] Error loading highway list:", err);
      setListError(err.message || "Failed to load highway list");
      setHighwayList([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadHighwayList();
  }, [loadHighwayList]);

  return {
    highwayList,
    isLoadingList,
    listError,
    refreshList: loadHighwayList
  };
}

export function useHighway(code: string | null) {
  const [data, setData] = useState<GeoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHighway = useCallback(async (highwayCode: string) => {
    if (!highwayCode) {
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const highwayData = await api.getHighwayByCode(highwayCode);
      setData(highwayData);
    } catch (err: any) {
      console.error(`[useHighway] Error loading highway ${highwayCode}:`, err);
      setError(err.message || `Failed to load highway ${highwayCode}`);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) {
      loadHighway(code);
    } else {
      setData(null);
    }
  }, [code, loadHighway]);

  return {
    data,
    isLoading,
    error,
    loadHighway
  };
}