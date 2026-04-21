import { logInfo, logError } from "@logs/logs.js";
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "@/config/paths.js";
import webpush from "@/utils/push.js";

// ────────────────────────────────
// Web Push Notification Service
// Stores push subscriptions and sends notifications
// ────────────────────────────────

interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UserSubscription {
  userId: string;
  subscription: PushSubscription;
  preferences: {
    weatherAlerts: boolean;
    roadBlockAlerts: boolean;
    monsoonAlerts: boolean;
    accidentAlerts: boolean;
  };
  createdAt: string;
  lastUsed: string;
  failureCount?: number;
}

// In-memory subscription store (replace with DB in production)
const subscriptions: Map<string, UserSubscription[]> = new Map();
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "push_subscriptions.json");

// Save queue to prevent race conditions on concurrent writes
let saveQueue: Promise<void> = Promise.resolve();
let savePending = false;

/**
 * Initialize push service - load subscriptions from disk
 */
export async function initializeWebPush(): Promise<void> {
  try {
    // Validate VAPID keys first
    const vapidPub = process.env.VAPID_PUBLIC_KEY;
    const vapidPriv = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPub || !vapidPriv) {
      logError("[WebPush] VAPID keys not configured - push will NOT work");
    } else {
      logInfo("[WebPush] VAPID keys configured successfully");
    }

    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf-8");
    const parsed = JSON.parse(data) as Record<string, UserSubscription[]>;

    for (const [userId, subs] of Object.entries(parsed)) {
      // Filter invalid subscriptions on load
      const validSubs = subs.filter(s =>
        s.subscription?.endpoint &&
        s.subscription?.keys?.p256dh &&
        s.subscription?.keys?.auth
      );

      if (validSubs.length > 0) {
        subscriptions.set(userId, validSubs);
      }
    }

    logInfo("[WebPush] Loaded push subscriptions", {
      totalSubscriptions: [...subscriptions.values()].flat().length,
      totalUsers: subscriptions.size
    });

  } catch (err: any) {
    if (err.code === 'ENOENT') {
      logInfo("[WebPush] No existing subscriptions found, creating new store");
    } else if (err instanceof SyntaxError) {
      logError("[WebPush] Corrupted subscriptions file, starting fresh", err.message);
    } else {
      logError("[WebPush] Failed to load subscriptions", err.message);
    }
  }
}

/**
 * Save subscriptions to disk with atomic write and queueing
 */
async function saveSubscriptions(): Promise<void> {
  savePending = true;

  // Queue save operation to avoid race conditions
  saveQueue = saveQueue.finally(async () => {
    if (!savePending) return;
    savePending = false;

    try {
      const obj: Record<string, UserSubscription[]> = {};
      for (const [userId, subs] of subscriptions) {
        obj[userId] = subs;
      }

      const jsonData = JSON.stringify(obj, null, 2);
      const tempFile = `${SUBSCRIPTIONS_FILE}.tmp`;

      // Atomic write: write to temp file first then rename
      await fs.writeFile(tempFile, jsonData);
      await fs.rename(tempFile, SUBSCRIPTIONS_FILE);

    } catch (err: any) {
      logError("[WebPush] Failed to save subscriptions", err.message);
    }
  });

  await saveQueue;
}

/**
 * Subscribe a user to push notifications
 */
export async function subscribeUser(
  userId: string,
  subscription: PushSubscription,
  preferences?: UserSubscription["preferences"]
): Promise<boolean> {
  if (!userId || !subscription?.endpoint || !subscription?.keys) {
    logError("[WebPush] Invalid subscription parameters");
    return false;
  }

  try {
    const userSubs = subscriptions.get(userId) || [];

    // Check if subscription already exists (by endpoint)
    const existingIndex = userSubs.findIndex(
      (s) => s.subscription.endpoint === subscription.endpoint
    );

    const userSub: UserSubscription = {
      userId,
      subscription,
      preferences: preferences || {
        weatherAlerts: true,
        roadBlockAlerts: true,
        monsoonAlerts: true,
        accidentAlerts: true,
      },
      createdAt: existingIndex >= 0
        ? userSubs[existingIndex].createdAt
        : new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      failureCount: existingIndex >= 0
        ? userSubs[existingIndex].failureCount || 0
        : 0
    };

    if (existingIndex >= 0) {
      userSubs[existingIndex] = userSub;
    } else {
      userSubs.push(userSub);
    }

    subscriptions.set(userId, userSubs);
    await saveSubscriptions();

    logInfo("[WebPush] User subscribed", {
      userId,
      endpointHash: hashEndpoint(subscription.endpoint)
    });
    return true;

  } catch (err: any) {
    logError("[WebPush] Failed to subscribe user", err.message);
    return false;
  }
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeUser(userId: string, endpoint: string): Promise<boolean> {
  if (!userId || !endpoint) return false;

  try {
    const userSubs = subscriptions.get(userId) || [];
    const initialLength = userSubs.length;

    const filtered = userSubs.filter((s) => s.subscription.endpoint !== endpoint);

    if (filtered.length === initialLength) {
      return false; // Not found
    }

    if (filtered.length === 0) {
      subscriptions.delete(userId);
    } else {
      subscriptions.set(userId, filtered);
    }

    await saveSubscriptions();

    logInfo("[WebPush] User unsubscribed", { userId, endpointHash: hashEndpoint(endpoint) });
    return true;

  } catch (err: any) {
    logError("[WebPush] Failed to unsubscribe user", err.message);
    return false;
  }
}

/**
 * Update user notification preferences
 */
export async function updatePreferences(
  userId: string,
  endpoint: string,
  preferences: Partial<UserSubscription["preferences"]>
): Promise<boolean> {
  if (!userId || !endpoint || !preferences) return false;

  try {
    const userSubs = subscriptions.get(userId) || [];
    const sub = userSubs.find((s) => s.subscription.endpoint === endpoint);

    if (!sub) return false;

    sub.preferences = { ...sub.preferences, ...preferences };
    sub.lastUsed = new Date().toISOString();

    await saveSubscriptions();
    return true;

  } catch (err: any) {
    logError("[WebPush] Failed to update preferences", err.message);
    return false;
  }
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<number> {
  if (!userId || !title) return 0;

  const userSubs = subscriptions.get(userId) || [];
  if (userSubs.length === 0) return 0;

  // Create a copy to avoid concurrent modification issues
  const subsSnapshot = [...userSubs];
  const sent: Promise<boolean>[] = [];

  for (const userSub of subsSnapshot) {
    sent.push(sendSingleNotification(userSub, title, body, data));
  }

  const results = await Promise.allSettled(sent);
  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}

/**
 * Send single notification with error handling
 */
async function sendSingleNotification(
  userSub: UserSubscription,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    const payload = JSON.stringify({
      title,
      body,
      data: data || {},
      timestamp: new Date().toISOString()
    });

    await webpush.sendNotification(userSub.subscription, payload);

    // Reset failure count on success
    userSub.failureCount = 0;
    userSub.lastUsed = new Date().toISOString();

    logInfo("[WebPush] Notification sent successfully", {
      userId: userSub.userId,
      title,
      endpointHash: hashEndpoint(userSub.subscription.endpoint)
    });

    return true;

  } catch (err: any) {
    userSub.failureCount = (userSub.failureCount || 0) + 1;

    logError("[WebPush] Failed to send push notification", {
      userId: userSub.userId,
      error: err.message,
      statusCode: err.statusCode,
      failures: userSub.failureCount
    });

    // Remove expired/invalid subscriptions or after 5 consecutive failures
    if (err.statusCode === 404 || err.statusCode === 410 || userSub.failureCount >= 5) {
      logInfo("[WebPush] Removing failed/expired subscription", {
        userId: userSub.userId,
        endpointHash: hashEndpoint(userSub.subscription.endpoint)
      });
      await unsubscribeUser(userSub.userId, userSub.subscription.endpoint);
    }

    return false;
  }
}

/**
 * Send push notification for road blockage
 */
export async function notifyRoadBlockage(
  roadName: string,
  location: string,
  affectedUserIds?: string[]
): Promise<number> {
  return broadcastNotification(
    "roadBlockAlerts",
    "🚧 Road Blockage Alert",
    `${roadName} is blocked at ${location}`,
    { type: "road_blockage", road: roadName, location },
    affectedUserIds
  );
}

/**
 * Send push notification for road resumption
 */
export async function notifyRoadResumed(
  roadName: string,
  location: string,
  affectedUserIds?: string[]
): Promise<number> {
  return broadcastNotification(
    "roadBlockAlerts",
    "✅ Road Resumed",
    `${roadName} at ${location} is now open for traffic`,
    { type: "road_resumed", road: roadName, location },
    affectedUserIds
  );
}

/**
 * Send push notification for weather alert
 */
export async function notifyWeatherAlert(
  location: string,
  message: string,
  severity: "low" | "medium" | "high" | "critical"
): Promise<number> {
  return broadcastNotification(
    "weatherAlerts",
    `⚠️ Weather Alert (${severity.toUpperCase()})`,
    `${location}: ${message}`,
    { type: "weather", location, severity }
  );
}

/**
 * Send push notification for monsoon/landslide risk
 */
export async function notifyMonsoonRisk(
  region: string,
  riskLevel: string
): Promise<number> {
  return broadcastNotification(
    "monsoonAlerts",
    "🌧️ Monsoon Risk Alert",
    `${region} has ${riskLevel} landslide risk`,
    { type: "monsoon", region, riskLevel }
  );
}

/**
 * Send push notification for accidents
 */
export async function notifyAccident(
  location: string,
  details: string
): Promise<number> {
  return broadcastNotification(
    "accidentAlerts",
    "🚨 Accident Alert",
    `Accident reported at ${location}: ${details}`,
    { type: "accident", location }
  );
}

/**
 * Generic broadcast notification function - removes duplicated code
 */
async function broadcastNotification(
  preferenceKey: keyof UserSubscription["preferences"],
  title: string,
  body: string,
  data: Record<string, any>,
  userFilter?: string[]
): Promise<number> {
  let sent = 0;
  const targets = userFilter || [...subscriptions.keys()];

  // Batch send notifications with concurrency limit
  const batchSize = 20;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const promises: Promise<number>[] = [];

    for (const userId of batch) {
      const userSubs = subscriptions.get(userId) || [];

      for (const userSub of userSubs) {
        if (userSub.preferences[preferenceKey]) {
          promises.push(sendPushToUser(userId, title, body, data));
        }
      }
    }

    const results = await Promise.all(promises);
    sent += results.reduce((sum, val) => sum + val, 0);
  }

  return sent;
}

/**
 * Get subscription stats
 */
export function getPushStats(): {
  totalSubscriptions: number;
  totalUsers: number;
  preferencesBreakdown: {
    weatherAlerts: number;
    roadBlockAlerts: number;
    monsoonAlerts: number;
    accidentAlerts: number;
  };
  failureCounts: { total: number; critical: number };
} {
  let totalSubscriptions = 0;
  let totalFailed = 0;
  let totalCriticalFailed = 0;
  const totalUsers = subscriptions.size;

  const preferencesBreakdown = {
    weatherAlerts: 0,
    roadBlockAlerts: 0,
    monsoonAlerts: 0,
    accidentAlerts: 0,
  };

  for (const [, userSubs] of subscriptions) {
    totalSubscriptions += userSubs.length;
    for (const userSub of userSubs) {
      if (userSub.preferences.weatherAlerts) preferencesBreakdown.weatherAlerts++;
      if (userSub.preferences.roadBlockAlerts) preferencesBreakdown.roadBlockAlerts++;
      if (userSub.preferences.monsoonAlerts) preferencesBreakdown.monsoonAlerts++;
      if (userSub.preferences.accidentAlerts) preferencesBreakdown.accidentAlerts++;

      if (userSub.failureCount && userSub.failureCount > 0) {
        totalFailed++;
        if (userSub.failureCount >= 3) totalCriticalFailed++;
      }
    }
  }

  return {
    totalSubscriptions,
    totalUsers,
    preferencesBreakdown,
    failureCounts: {
      total: totalFailed,
      critical: totalCriticalFailed
    }
  };
}

/**
 * Get VAPID public key for frontend subscription
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Hash endpoint for safe logging
 */
function hashEndpoint(endpoint: string): string {
  // Simple hash to avoid logging full endpoints
  return endpoint.substring(0, 8) + "..." + endpoint.substring(endpoint.length - 6);
}
