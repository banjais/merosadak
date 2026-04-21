// backend/src/services/userProfileService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { maskEmail } from "@/services/piiMasking";
import type { UserProfile, UserPreferences } from "../types.js";

// ────────────────────────────────
// User Profile & Preferences Service
// ────────────────────────────────

// In-memory store (replace with DB in production)
const profiles: Map<string, UserProfile> = new Map();
const PROFILES_FILE = path.join(DATA_DIR, "user_profiles.json");

/**
 * Initialize user profiles from disk
 */
export async function initializeProfiles(): Promise<void> {
  try {
    const data = await fs.readFile(PROFILES_FILE, "utf-8");
    const parsed = JSON.parse(data) as Record<string, UserProfile>;
    for (const [id, profile] of Object.entries(parsed)) {
      profiles.set(id, profile);
    }
    logInfo("[UserProfile] Loaded profiles", { count: profiles.size });
  } catch {
    logInfo("[UserProfile] No existing profiles found");
  }
}

/**
 * Save profiles to disk
 */
async function saveProfiles(): Promise<void> {
  try {
    const obj: Record<string, UserProfile> = {};
    for (const [id, profile] of profiles) {
      obj[id] = profile;
    }
    await fs.writeFile(PROFILES_FILE, JSON.stringify(obj, null, 2));
  } catch (err: any) {
    logError("[UserProfile] Failed to save profiles", err.message);
  }
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  notificationPreferences: {
    push: true,
    email: false,
    telegram: false,
    weatherAlerts: true,
    roadBlockAlerts: true,
    monsoonAlerts: true,
  },
  favoriteHighways: [],
  savedLocations: [],
  theme: "dark",
  mapStyle: "dark",
  autoRefreshInterval: 300,
  showTrafficOverlay: true,
  showWeatherOverlay: true,
  showMonsoonOverlay: true,
};

/**
 * Create or get user profile
 */
export async function getOrCreateProfile(userId: string, email: string, role: string): Promise<UserProfile> {
  let profile = profiles.get(userId);

  if (!profile) {
    profile = {
      id: userId,
      email,
      role,
      preferences: { ...DEFAULT_PREFERENCES },
      stats: {
        incidentsReported: 0,
        incidentsVerified: 0,
        votesCast: 0,
        routesPlanned: 0,
        memberSince: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      },
      badges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    profiles.set(userId, profile);
    await saveProfiles();

    logInfo("[UserProfile] Created new profile", { userId, email: maskEmail(email) });
  }

  // Update last active
  profile.stats.lastActive = new Date().toISOString();
  await saveProfiles();

  return profile;
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserProfile | null> {
  const profile = profiles.get(userId);
  if (!profile) return null;

  profile.preferences = {
    ...profile.preferences,
    ...updates,
    notificationPreferences: {
      ...profile.preferences.notificationPreferences,
      ...(updates.notificationPreferences || {}),
    },
  };

  if (updates.favoriteHighways) {
    profile.preferences.favoriteHighways = updates.favoriteHighways.slice(0, 20);
  }

  if (updates.savedLocations) {
    profile.preferences.savedLocations = updates.savedLocations.slice(0, 10);
  }

  profile.updatedAt = new Date().toISOString();
  await saveProfiles();

  return profile;
}

/**
 * Add saved location
 */
export async function addSavedLocation(
  userId: string,
  location: { name: string; lat: number; lng: number }
): Promise<UserProfile | null> {
  const profile = profiles.get(userId);
  if (!profile) return null;

  if (profile.preferences.savedLocations.length >= 10) {
    return null; // Max limit reached
  }

  profile.preferences.savedLocations.push({
    ...location,
    createdAt: new Date().toISOString(),
  });

  profile.updatedAt = new Date().toISOString();
  await saveProfiles();

  return profile;
}

/**
 * Remove saved location
 */
export async function removeSavedLocation(
  userId: string,
  locationName: string
): Promise<UserProfile | null> {
  const profile = profiles.get(userId);
  if (!profile) return null;

  profile.preferences.savedLocations = profile.preferences.savedLocations.filter(
    (loc) => loc.name !== locationName
  );

  profile.updatedAt = new Date().toISOString();
  await saveProfiles();

  return profile;
}

/**
 * Increment user stats
 */
export async function incrementStat(
  userId: string,
  stat: keyof UserProfile["stats"] & string,
  amount: number = 1
): Promise<void> {
  const profile = profiles.get(userId);
  if (!profile) return;

  const current = (profile.stats as any)[stat];
  if (typeof current === "number") {
    (profile.stats as any)[stat] = current + amount;
    profile.stats.lastActive = new Date().toISOString();
    await saveProfiles();
  }
}

/**
 * Award badge to user
 */
export async function awardBadge(userId: string, badgeId: string): Promise<void> {
  const profile = profiles.get(userId);
  if (!profile) return;

  if (!profile.badges.includes(badgeId)) {
    profile.badges.push(badgeId);
    profile.updatedAt = new Date().toISOString();
    await saveProfiles();

    logInfo("[UserProfile] Badge awarded", { userId, badgeId });
  }
}

/**
 * Get profile by ID
 */
export function getProfile(userId: string): UserProfile | null {
  return profiles.get(userId) || null;
}

/**
 * Delete profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  const deleted = profiles.delete(userId);
  if (deleted) {
    await saveProfiles();
  }
  return deleted;
}

/**
 * Get leaderboard (top users by activity)
 */
export function getLeaderboard(limit: number = 10): Array<Pick<UserProfile, "id" | "name" | "email" | "stats" | "badges">> {
  const sorted = Array.from(profiles.values())
    .sort((a, b) => {
      const scoreA = a.stats.incidentsReported * 10 + a.stats.incidentsVerified * 5 + a.stats.votesCast;
      const scoreB = b.stats.incidentsReported * 10 + b.stats.incidentsVerified * 5 + b.stats.votesCast;
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name || p.email.split("@")[0],
      email: p.email,
      stats: p.stats,
      badges: p.badges,
    }));

  return sorted;
}

/**
 * Get user activity score
 */
export function getActivityScore(userId: string): number {
  const profile = profiles.get(userId);
  if (!profile) return 0;

  return (
    profile.stats.incidentsReported * 10 +
    profile.stats.incidentsVerified * 5 +
    profile.stats.votesCast * 1 +
    profile.stats.routesPlanned * 2 +
    profile.badges.length * 15
  );
}

/**
 * Get user's community level
 */
export function getCommunityLevel(userId: string): { level: number; title: string; nextLevel: number } {
  const score = getActivityScore(userId);

  const levels = [
    { min: 0, level: 1, title: "Newcomer", next: 50 },
    { min: 50, level: 2, title: "Observer", next: 150 },
    { min: 150, level: 3, title: "Reporter", next: 300 },
    { min: 300, level: 4, title: "Contributor", next: 500 },
    { min: 500, level: 5, title: "Guardian", next: 1000 },
    { min: 1000, level: 6, title: "Hero", next: 2000 },
    { min: 2000, level: 7, title: "Legend", next: Infinity },
  ];

  let current = levels[0];
  for (const lvl of levels) {
    if (score >= lvl.min) {
      current = lvl;
    }
  }

  return {
    level: current.level,
    title: current.title,
    nextLevel: current.next,
  };
}
