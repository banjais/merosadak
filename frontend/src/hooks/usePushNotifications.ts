// frontend/src/hooks/usePushNotifications.ts
import { useState, useCallback, useEffect } from "react";
import { registerPushNotifications } from "../services/pushNotificationService";

export interface NotificationPreferences {
  incidents?: boolean;
  weather?: boolean;
  traffic?: boolean;
}

export function usePushNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(isSupported);
  }, []);

  const subscribe = useCallback(
    async (preferences?: NotificationPreferences) => {
      if (!supported) {
        setError("Push notifications not supported in this browser");
        return false;
      }

      setLoading(true);
      setError(null);
      try {
        const subscription = await registerPushNotifications();
        const success = subscription !== null;
        setSubscribed(success);
        return success;
      } catch (err: any) {
        setError(err.message || "Failed to subscribe");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [supported]
  );

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        setSubscribed(false);
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || "Failed to unsubscribe");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    subscribed,
    loading,
    error,
    supported,
    subscribe,
    unsubscribe,
  };
}
