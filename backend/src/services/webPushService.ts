import { logInfo, logError } from "../logs/logs.js";
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import webpush from "../utils/push.js";

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
}

// In-memory subscription store (replace with DB in production)
const subscriptions: Map<string, UserSubscription[]> = new Map();

const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "push_subscriptions.json");

/**
 * Initialize push service - load subscriptions from disk
 */
export async function initializeWebPush(): Promise<void> {
  try {
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf-8");
    const parsed = JSON.parse(data) as Record<string, UserSubscription[]>;
    for (const [userId, subs] of Object.entries(parsed)) {
      subscriptions.set(userId, subs);
    }
    logInfo("[WebPush] Loaded push subscriptions", { count: subscriptions.size });
  } catch {
    logInfo("[WebPush] No existing subscriptions found");
  }
}

/**
 * Save subscriptions to disk
 */
async function saveSubscriptions(): Promise<void> {
  try {
    const obj: Record<string, UserSubscription[]> = {};
    for (const [userId, subs] of subscriptions) {
      obj[userId] = subs;
    }
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(obj, null, 2));
  } catch (err: any) {
    logError("[WebPush] Failed to save subscriptions", err.message);
  }
}

/**
 * Subscribe a user to push notifications
 */
export async function subscribeUser(
  userId: string,
  subscription: PushSubscription,
  preferences?: UserSubscription["preferences"]
): Promise<boolean> {
  try {
    const userSubs = subscriptions.get(userId) || [];

    // Check if subscription already exists (by endpoint)
    const existingIndex = userSubs.findIndex((s) => s.subscription.endpoint === subscription.endpoint);

    const userSub: UserSubscription = {
      userId,
      subscription,
      preferences: preferences || {
        weatherAlerts: true,
        roadBlockAlerts: true,
        monsoonAlerts: true,
        accidentAlerts: true,
      },
      createdAt: existingIndex >= 0 ? userSubs[existingIndex].createdAt : new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      userSubs[existingIndex] = userSub;
    } else {
      userSubs.push(userSub);
    }

    subscriptions.set(userId, userSubs);
    await saveSubscriptions();

    logInfo("[WebPush] User subscribed", { userId, endpoint: subscription.endpoint });
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
  try {
    const userSubs = subscriptions.get(userId) || [];
    const filtered = userSubs.filter((s) => s.subscription.endpoint !== endpoint);

    if (filtered.length === userSubs.length) {
      return false; // Not found
    }

    subscriptions.set(userId, filtered);
    await saveSubscriptions();

    logInfo("[WebPush] User unsubscribed", { userId, endpoint });
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
  const userSubs = subscriptions.get(userId) || [];
  let sent = 0;

  for (const userSub of userSubs) {
    try {
      const payload = JSON.stringify({
        title,
        body,
        data: data || {},
        timestamp: new Date().toISOString()
      });

      await webpush.sendNotification(userSub.subscription, payload);
      
      logInfo("[WebPush] Notification sent successfully", {
        userId,
        title,
        endpoint: userSub.subscription.endpoint.substring(0, 50) + "..."
      });
      sent++;
    } catch (err: any) {
      logError("[WebPush] Failed to send push notification", { 
        userId, 
        error: err.message,
        statusCode: err.statusCode 
      });
      
      // If subscription is expired or invalid, remove it
      if (err.statusCode === 404 || err.statusCode === 410) {
        logInfo("[WebPush] Removing expired subscription", { userId, endpoint: userSub.subscription.endpoint });
        await unsubscribeUser(userId, userSub.subscription.endpoint);
      }
    }
  }

  return sent;
}

/**
 * Send push notification for road blockage
 */
export async function notifyRoadBlockage(
  roadName: string,
  location: string,
  affectedUserIds?: string[]
): Promise<number> {
  let sent = 0;

  if (affectedUserIds) {
    for (const userId of affectedUserIds) {
      const userSubs = subscriptions.get(userId) || [];
      for (const userSub of userSubs) {
        if (userSub.preferences.roadBlockAlerts) {
          sent += await sendPushToUser(
            userId,
            "🚧 Road Blockage Alert",
            `${roadName} is blocked at ${location}`,
            { type: "road_blockage", road: roadName, location }
          );
        }
      }
    }
  } else {
    // Broadcast to all users with road block alerts enabled
    for (const [userId, userSubs] of subscriptions) {
      for (const userSub of userSubs) {
        if (userSub.preferences.roadBlockAlerts) {
          sent += await sendPushToUser(
            userId,
            "🚧 Road Blockage Alert",
            `${roadName} is blocked at ${location}`,
            { type: "road_blockage", road: roadName, location }
          );
        }
      }
    }
  }

  return sent;
}

/**
 * Send push notification for weather alert
 */
export async function notifyWeatherAlert(
  location: string,
  message: string,
  severity: "low" | "medium" | "high" | "critical"
): Promise<number> {
  let sent = 0;

  for (const [userId, userSubs] of subscriptions) {
    for (const userSub of userSubs) {
      if (userSub.preferences.weatherAlerts) {
        sent += await sendPushToUser(
          userId,
          `⚠️ Weather Alert (${severity.toUpperCase()})`,
          `${location}: ${message}`,
          { type: "weather", location, severity }
        );
      }
    }
  }

  return sent;
}

/**
 * Send push notification for monsoon/landslide risk
 */
export async function notifyMonsoonRisk(
  region: string,
  riskLevel: string
): Promise<number> {
  let sent = 0;

  for (const [userId, userSubs] of subscriptions) {
    for (const userSub of userSubs) {
      if (userSub.preferences.monsoonAlerts) {
        sent += await sendPushToUser(
          userId,
          "🌧️ Monsoon Risk Alert",
          `${region} has ${riskLevel} landslide risk`,
          { type: "monsoon", region, riskLevel }
        );
      }
    }
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
} {
  let totalSubscriptions = 0;
  let totalUsers = subscriptions.size;
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
    }
  }

  return {
    totalSubscriptions,
    totalUsers,
    preferencesBreakdown,
  };
}

/**
 * Get VAPID public key for frontend subscription
 */
export function getVapidPublicKey(): string | null {
  // In production, return actual VAPID public key
  // This should be configured via environment variable
  return process.env.VAPID_PUBLIC_KEY || null;
}
