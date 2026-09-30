/**
 * Automatic app update for browser + installed PWA.
 * On every visit/refresh: check for new SW + version.json, activate immediately,
 * purge stale caches, and reload once so users always see the latest UI/assets.
 * Icon/name on the home screen still depend on the OS (Chrome/Android may lag);
 * content and JS always update without the user clearing cache manually.
 */

export const CLIENT_APP_VERSION = '2.1.0';

const STORAGE_RELOAD_GUARD = 'merosadak_sw_reload_at';
const RELOAD_COOLDOWN_MS = 15_000;

function getPageBuild(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="app-build"]')?.content || '';
}

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
    const keepPrefix = ['mero-sadak-static-v5', 'mero-sadak-tiles-v5', 'mero-sadak-data-v6'];
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
    console.log('[MEROSADAK] New service worker active — reloading');
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'SW_ACTIVATED' && data.action === 'reload-recommended') {
      if (canReloadNow()) {
        console.log('[MEROSADAK] SW activated', data.version, '— reloading');
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

    // Compare the deployment marker with the HTML currently running
    await checkRemoteVersionAndRefresh();

    // Drop any leftover v1–v4 caches from this client
    await purgeLegacyCaches();

    console.log('[MEROSADAK] Automatic updates armed — build', getPageBuild());
    return !!navigator.serviceWorker.controller || !!registration.active;
  } catch (error) {
    console.warn('[MEROSADAK] Auto-update setup failed:', error);
    return false;
  }
}

/**
 * Compare the current HTML build with the uncached deployment marker and
 * reload automatically if Hosting has already released a newer version.
 */
export async function checkRemoteVersionAndRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = (await res.json()) as { build?: string; version?: string; sw?: string };
    const remoteBuild = remote.build || remote.version || '';
    const pageBuild = getPageBuild();
    if (!remoteBuild || !pageBuild || remoteBuild === pageBuild) return;

    if (remoteBuild !== pageBuild) {
      console.log('[MEROSADAK] New version detected', pageBuild, '→', remoteBuild);
      await purgeLegacyCaches();
      if (canReloadNow()) {
        window.location.reload();
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
