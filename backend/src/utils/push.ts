import webpush from "web-push";

const vapidPub = process.env.VAPID_PUBLIC_KEY || "";
const vapidPriv = process.env.VAPID_PRIVATE_KEY || "";
const adminEmail = process.env.SMTP_FROM || "admin@merosadak.com";

if (vapidPub && vapidPriv) {
  webpush.setVapidDetails(
    `mailto:${adminEmail}`,
    vapidPub,
    vapidPriv
  );
} else {
  // Service will log error on initialization in pushService.ts
}

export default webpush;