// frontend/src/hooks/useUserProfile.ts
import { useState, useEffect, useCallback } from "react";
import { userService, type UserProfile, type UserPreferences, type CommunityLevel } from "../services/userService";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userService.getProfile();
      setProfile(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updatePreferences = useCallback(
    async (preferences: Partial<UserPreferences>) => {
      const result = await userService.updatePreferences(preferences);
      if (result && profile) {
        setProfile({ ...profile, preferences: result });
      }
      return result;
    },
    [profile]
  );

  const addSavedLocation = useCallback(async (location: { name: string; lat: number; lng: number }) => {
    const result = await userService.addSavedLocation(location);
    if (result && profile) {
      setProfile({ ...profile, preferences: { ...profile.preferences, savedLocations: result } });
    }
    return result;
  }, [profile]);

  const removeSavedLocation = useCallback(async (name: string) => {
    const result = await userService.removeSavedLocation(name);
    if (result && profile) {
      setProfile({ ...profile, preferences: { ...profile.preferences, savedLocations: result } });
    }
    return result;
  }, [profile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updatePreferences,
    addSavedLocation,
    removeSavedLocation,
  };
}

export function useLeaderboard(limit: number = 10) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userService.getLeaderboard(limit);
      setLeaderboard(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch leaderboard");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, loading, error, refetch: fetchLeaderboard };
}

export function useCommunityLevel() {
  const [level, setLevel] = useState<CommunityLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLevel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userService.getCommunityLevel();
      setLevel(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch community level");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLevel();
  }, [fetchLevel]);

  return { level, loading, error, refetch: fetchLevel };
}
