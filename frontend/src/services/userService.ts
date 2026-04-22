// frontend/src/services/userService.ts
import { apiFetch } from "../api";

export interface UserPreferences {
  language: string;
  defaultLocation?: { lat: number; lng: number; name: string };
  notificationPreferences: {
    push: boolean;
    email: boolean;
    telegram: boolean;
    weatherAlerts: boolean;
    roadBlockAlerts: boolean;
    monsoonAlerts: boolean;
  };
  favoriteHighways: string[];
  savedLocations: Array<{ name: string; lat: number; lng: number; createdAt: string }>;
  theme: "light" | "dark" | "auto";
  mapStyle: "standard" | "satellite" | "terrain" | "dark";
  vehicleType?: string;
  customTankCapacity?: number;
  checklistItems?: any[];
  // additional optional fields for compatibility
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  name?: string;
  preferences: UserPreferences;
  stats: {
    incidentsReported: number;
    incidentsVerified: number;
    votesCast: number;
    routesPlanned: number;
    memberSince: string;
    lastActive: string;
  };
  badges: string[];
}

export interface CommunityLevel {
  level: number;
  title: string;
  score: number;
  nextLevel: number;
}

export const userService = {
  getProfile: async (): Promise<UserProfile | null> => {
    try {
      const result = await apiFetch<any>("/users/profile");
      return result.data || null;
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      return null;
    }
  },

  updatePreferences: async (preferences: Partial<UserPreferences>): Promise<UserPreferences | null> => {
    try {
      const result = await apiFetch<any>("/users/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      return null;
    }
  },

  addSavedLocation: async (location: { name: string; lat: number; lng: number }): Promise<Array<any> | null> => {
    try {
      const result = await apiFetch<any>("/users/profile/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to add saved location:", err);
      return null;
    }
  },

  removeSavedLocation: async (name: string): Promise<Array<any> | null> => {
    try {
      const result = await apiFetch<any>(`/users/profile/locations/${name}`, {
        method: "DELETE",
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to remove saved location:", err);
      return null;
    }
  },

  getLeaderboard: async (limit: number = 10): Promise<Array<any>> => {
    try {
      const result = await apiFetch<any>(`/users/leaderboard?limit=${limit}`);
      return result.data || [];
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      return [];
    }
  },

  getCommunityLevel: async (): Promise<CommunityLevel | null> => {
    try {
      const result = await apiFetch<any>("/users/me/level");
      return result.data || null;
    } catch (err) {
      console.error("Failed to fetch community level:", err);
      return null;
    }
  }
};
