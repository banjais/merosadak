/**
 * Automatic app update for browser + installed PWA.
 * On every visit/refresh: check for new SW + version.json, activate immediately,
 * purge stale caches, and reload once so users always see the latest UI/assets.
 * Icon/name on the home screen still depend on the OS (Chrome/Android may lag);
 * content and JS always update without the user clearing cache manually.
 */

export const CLIENT_APP_BUILD = '20260922-pwa-auto';
export const CLIENT_APP_VERSION = '2.1.0';

const STORAGE_BUILD_KEY = 'merosadak_app_build';
const STORAGE_RELOAD_GUARD = 'merosadak_sw_reload_at';
const RELOAD_COOLDOWN_MS = 15_000;

function canReloadNow(): boolean {
  try {
    const last = Number(sessionStorage.getItem(STORAGE_RELOAD_GUARD) || '0');
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(STORAGE_RELOAD_GUARD, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

async function purgeLegacyCaches(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    const keepPrefix = ['mero-sadak-static-v5', 'mero-sadak-tiles-v5', 'mero-sadak-data-v5'];
    await Promise.all(
      keys
        .filter((k) => {
          if (keepPrefix.includes(k)) return false;
          return k.startsWith('mero-sadak-') || k.startsWith('workbox-') || k.includes('precache');
        })
        .map((k) => caches.delete(k))
    );
  } catch {
    /* ignore */
  }
}

function activateWaitingWorker(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Call once at app boot (and from index.html early script).
 * Returns true if a service worker is controlling the page.
 */
export async function setupAutomaticUpdates(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  // One-time reload when a new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    if (!canReloadNow()) return;
    refreshing = true;
    console.log('[Mero Sadak] New service worker active — reloading');
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'SW_ACTIVATED' && data.action === 'reload-recommended') {
      if (canReloadNow()) {
        console.log('[Mero Sadak] SW activated', data.version, '— reloading');
        window.location.reload();
      }
    }
  });

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Always ask the browser for a fresh SW check on open / refresh
    try {
      await registration.update();
    } catch {
      /* offline */
    }

    activateWaitingWorker(registration);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // New worker waiting (or active if first install)
          if (navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
            activateWaitingWorker(registration);
          }
        }
      });
    });

    // Periodic update checks while the tab stays open (installed PWA / long sessions)
    const hour = 60 * 60 * 1000;
    window.setInterval(() => {
      registration.update().then(() => activateWaitingWorker(registration)).catch(() => {});
    }, hour);

    // Also check when the user returns to the tab / app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().then(() => activateWaitingWorker(registration)).catch(() => {});
        void checkRemoteVersionAndRefresh();
      }
    });

    window.addEventListener('online', () => {
      registration.update().then(() => activateWaitingWorker(registration)).catch(() => {});
      void checkRemoteVersionAndRefresh();
    });

    // Compare remote version.json vs last seen build
    await checkRemoteVersionAndRefresh();

    // Drop any leftover v1–v4 caches from this client
    await purgeLegacyCaches();

    try {
      localStorage.setItem(STORAGE_BUILD_KEY, CLIENT_APP_BUILD);
    } catch {
      /* ignore */
    }

    console.log('[Mero Sadak] Auto-update armed — build', CLIENT_APP_BUILD);
    return !!navigator.serviceWorker.controller || !!registration.active;
  } catch (error) {
    console.warn('[Mero Sadak] Auto-update setup failed:', error);
    return false;
  }
}

/**
 * Fetch /version.json (never cached long-term). If the server build is newer,
 * purge caches and reload so browser + installed PWA pick up the latest assets.
 */
export async function checkRemoteVersionAndRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = (await res.json()) as { build?: string; version?: string; sw?: string };
    const remoteBuild = remote.build || remote.version || '';
    if (!remoteBuild) return;

    let localBuild = '';
    try {
      localBuild = localStorage.getItem(STORAGE_BUILD_KEY) || '';
    } catch {
      localBuild = '';
    }

    // First visit: just store
    if (!localBuild) {
      try {
        localStorage.setItem(STORAGE_BUILD_KEY, remoteBuild);
      } catch {
        /* ignore */
      }
      return;
    }

    if (remoteBuild !== localBuild && remoteBuild !== CLIENT_APP_BUILD) {
      console.log('[Mero Sadak] New version detected', localBuild, '→', remoteBuild);
      await purgeLegacyCaches();
      try {
        localStorage.setItem(STORAGE_BUILD_KEY, remoteBuild);
      } catch {
        /* ignore */
      }
      if (canReloadNow()) {
        window.location.reload();
      }
    } else if (remoteBuild !== localBuild) {
      // Align stored build with what we ship in this bundle
      try {
        localStorage.setItem(STORAGE_BUILD_KEY, CLIENT_APP_BUILD);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* offline — stay on cached build */
  }
}

/** Used by offlineSync so a single registration path drives updates */
export async function registerServiceWorkerWithAutoUpdate(): Promise<boolean> {
  return setupAutomaticUpdates();
}
