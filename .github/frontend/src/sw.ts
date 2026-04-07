// frontend/src/registerSW.ts
import { Workbox } from "workbox-window";

interface SWOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

export function registerSW(options?: SWOptions) {
  if ("serviceWorker" in navigator) {
    const wb = new Workbox("/sw.js");

    // Event: New service worker waiting to activate
    wb.addEventListener("waiting", () => {
      console.log("New version of MeroSadak is waiting!");
      // optional callback to prompt user
      options?.onNeedRefresh?.();
    });

    // Event: Service worker installed
    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate) {
        console.log("Service worker installed for the first time.");
      } else {
        console.log("New content available!");
      }
      options?.onOfflineReady?.();
    });

    // Error handling
    wb.addEventListener("externalinstalled", (event) => {
      console.warn("External service worker installed", event);
    });

    // Register service worker
    wb.register()
      .then(() => console.log("Service worker registered successfully"))
      .catch(err => console.error("Service worker registration failed:", err));

    // Optional: Listen for controlling SW update
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("Controller changed, new SW controlling the page.");
    });
  } else {
    console.log("Service workers are not supported in this browser.");
  }
}

// Helper to trigger reload when new SW is available
export function promptUserToReload() {
  if (confirm("A new version of MeroSadak is available. Reload now?")) {
    window.location.reload();
  }
}
