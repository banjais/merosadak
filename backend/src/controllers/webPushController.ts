// backend/src/controllers/webPushController.ts
import { Request, Response } from "express";
import * as WebPushService from "../services/webPushService.js";
import { logError, logInfo } from "../logs/logs.js";
import { AuthRequest } from "../middleware/auth.js";

/**
 * POST /api/v1/push/subscribe
 * Subscribe to push notifications
 */
export const subscribe = async (req: AuthRequest, res: Response) => {
  try {
    const { subscription, preferences } = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({
        success: false,
        message: "Push subscription endpoint is required",
      });
    }

    const userId = req.user?.id as string || "anonymous";
    const success = await WebPushService.subscribeUser(userId, subscription, preferences);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: "Failed to subscribe",
      });
    }

    logInfo("[WebPush] User subscribed", { userId });

    res.json({
      success: true,
      message: "Subscribed to push notifications",
    });
  } catch (err: any) {
    logError("[WebPushController] subscribe failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to subscribe",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/push/unsubscribe
 * Unsubscribe from push notifications
 */
export const unsubscribe = async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Subscription endpoint is required",
      });
    }

    const userId = req.user?.id as string || "anonymous";
    const success = await WebPushService.unsubscribeUser(userId, endpoint);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    logInfo("[WebPush] User unsubscribed", { userId });

    res.json({
      success: true,
      message: "Unsubscribed from push notifications",
    });
  } catch (err: any) {
    logError("[WebPushController] unsubscribe failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe",
      error: err.message,
    });
  }
};

/**
 * PUT /api/v1/push/preferences
 * Update push notification preferences
 */
export const updatePreferences = async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, preferences } = req.body;

    if (!endpoint || !preferences) {
      return res.status(400).json({
        success: false,
        message: "Endpoint and preferences are required",
      });
    }

    const userId = req.user?.id as string || "anonymous";
    const success = await WebPushService.updatePreferences(userId, endpoint, preferences);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.json({
      success: true,
      message: "Preferences updated",
    });
  } catch (err: any) {
    logError("[WebPushController] updatePreferences failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to update preferences",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/push/vapid-public-key
 * Get VAPID public key for frontend subscription
 */
export const getVapidPublicKey = async (req: Request, res: Response) => {
  try {
    const publicKey = WebPushService.getVapidPublicKey();

    if (!publicKey) {
      return res.status(404).json({
        success: false,
        message: "VAPID public key not configured",
      });
    }

    res.json({
      success: true,
      data: { publicKey },
    });
  } catch (err: any) {
    logError("[WebPushController] getVapidPublicKey failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get VAPID key",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/push/stats
 * Get push notification stats (admin only)
 */
export const getPushStats = async (req: Request, res: Response) => {
  try {
    const stats = WebPushService.getPushStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    logError("[WebPushController] getPushStats failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get push stats",
      error: err.message,
    });
  }
};
