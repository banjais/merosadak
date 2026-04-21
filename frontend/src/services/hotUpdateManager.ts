// frontend/src/services/hotUpdateManager.ts
import { apiFetch } from "../api";

const VERSION_KEY = "merosadak_version";
const UPDATE_CHECK_INTERVAL = 300000; // 5 minutes

interface VersionInfo {
  version: string;
  required: boolean;
  changelog?: string;
  releaseDate?: string;
}

let currentVersion = "1.0.0";
let updateAvailable: VersionInfo | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

export const HotUpdateManager = {
  getVersion: () => currentVersion,

  setVersion: (v: string) => {
    currentVersion = v;
    localStorage.setItem(VERSION_KEY, v);
  },

  init: async () => {
    const saved = localStorage.getItem(VERSION_KEY);
    if (saved) currentVersion = saved;

    // Initial check
    await HotUpdateManager.checkForUpdates();

    // Start periodic checking
    checkInterval = setInterval(
      () => HotUpdateManager.checkForUpdates(),
      UPDATE_CHECK_INTERVAL
    );
  },

  stop: () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  },

  checkForUpdates: async (): Promise<VersionInfo | null> => {
    try {
      const result = await apiFetch<{ version: string; required?: boolean; changelog?: string }>("/superadmin/version", {
        method: "GET"
      }).catch(() => null);

      if (result) {
        const latestVersion = result.version;

        if (HotUpdateManager.isNewer(latestVersion, currentVersion)) {
          updateAvailable = {
            version: latestVersion,
            required: result.required || false,
            changelog: result.changelog,
            releaseDate: new Date().toISOString()
          };
          return updateAvailable;
        }
      }
    } catch (err) {
      console.debug("[HotUpdate] Version check failed:", err);
    }
    return null;
  },

  isNewer: (newVer: string, currentVer: string): boolean => {
    const newParts = newVer.split(".").map(Number);
    const currParts = currentVer.split(".").map(Number);

    for (let i = 0; i < Math.max(newParts.length, currParts.length); i++) {
      const n = newParts[i] || 0;
      const c = currParts[i] || 0;
      if (n > c) return true;
      if (n < c) return false;
    }
    return false;
  },

  getUpdate: () => updateAvailable,

  applyUpdate: (reload = true) => {
    if (reload) {
      window.location.reload();
    }
  },

  dismissUpdate: () => {
    updateAvailable = null;
  }
};