import webpush from "web-push";

/**
 * Configure VAPID details for web push notifications.
 * Ensure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in .env
 */
webpush.setVapidDetails(
  "mailto:admin@merosadak.web.app",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export default webpush;