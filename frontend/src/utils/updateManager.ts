const APP_VERSION = "1.0.0"; // change on every deploy
const VERSION_URL = "/version.json";

let latestVersion: string | null = null;

export async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store"
    });

    const data = await res.json();
    latestVersion = data.version;

    return data.version !== APP_VERSION;
  } catch (err) {
    console.warn("Update check failed", err);
    return false;
  }
}

// Force reload
export function applyUpdate() {
  window.location.reload();
}