/**
 * Service to manage PWA Push Notifications.
 */

import { apiFetch } from "../api";

const VAPID_PUBLIC_KEY = "BMm9MNfi-V2gbhuSyrxadHwATb_rQfQLbBsKoFnOUC-750Zwy31XdKbwFBJSiGXgHNaTdZtlxImdAxNpjCvsYQo";

export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if browser already has a subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch VAPID public key from backend
      const keyResponse = await apiFetch('/push/vapid-public-key');
      const publicKey = (keyResponse as any)?.publicKey || VAPID_PUBLIC_KEY;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // Sync with backend using apiFetch (attaches auth token automatically)
    await apiFetch('/push/subscribe', {
      method: "POST",
      body: JSON.stringify({ subscription })
    });

    return subscription;
  } catch (err) {
    console.error('[Push] Registration failed:', err);
    return null;
  }
}

/**
 * Helper to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
