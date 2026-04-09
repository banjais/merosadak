// frontend/src/services/pushNotificationService.ts
import { apiFetch } from "../api";

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPreferences {
  weatherAlerts: boolean;
  roadBlockAlerts: boolean;
  monsoonAlerts: boolean;
  accidentAlerts: boolean;
}

export const pushNotificationService = {
  getVapidPublicKey: async (): Promise<string | null> => {
    try {
      const result = await apiFetch<any>("/push/vapid-public-key");
      return result.data?.publicKey || null;
    } catch (err) {
      console.error("Failed to fetch VAPID public key:", err);
      return null;
    }
  },

  subscribe: async (
    subscription: PushSubscriptionData,
    preferences?: NotificationPreferences
  ): Promise<boolean> => {
    try {
      await apiFetch("/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, preferences }),
      });
      return true;
    } catch (err) {
      console.error("Failed to subscribe to push notifications:", err);
      return false;
    }
  },

  unsubscribe: async (endpoint: string): Promise<boolean> => {
    try {
      await apiFetch("/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      return true;
    } catch (err) {
      console.error("Failed to unsubscribe from push notifications:", err);
      return false;
    }
  },

  updatePreferences: async (
    endpoint: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> => {
    try {
      await apiFetch("/push/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, preferences }),
      });
      return true;
    } catch (err) {
      console.error("Failed to update push preferences:", err);
      return false;
    }
  },

  // Helper: Request browser permission and subscribe
  requestPermissionAndSubscribe: async (
    preferences?: NotificationPreferences
  ): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported");
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Push notification permission denied");
      return false;
    }

    // Get VAPID public key
    const vapidKey = await pushNotificationService.getVapidPublicKey();
    if (!vapidKey) {
      console.warn("VAPID public key not available");
      return false;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      return await pushNotificationService.subscribe(
        subscription.toJSON() as PushSubscriptionData,
        preferences
      );
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
      return false;
    }
  }
};

// Helper: Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
