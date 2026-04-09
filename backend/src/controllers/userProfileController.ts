// backend/src/controllers/userProfileController.ts
import { Request, Response } from "express";
import * as UserProfileService from "../services/userProfileService.js";
import { logError } from "../logs/logs.js";
import { AuthRequest } from "../middleware/auth.js";

/**
 * GET /api/v1/users/profile
 * Get current user's profile
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const email = req.user?.email as string;
    const role = req.user?.role as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const profile = await UserProfileService.getOrCreateProfile(userId, email, role);

    res.json({
      success: true,
      data: {
        ...profile,
        activityScore: UserProfileService.getActivityScore(userId),
        communityLevel: UserProfileService.getCommunityLevel(userId),
      },
    });
  } catch (err: any) {
    logError("[UserProfileController] getProfile failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
      error: err.message,
    });
  }
};

/**
 * PUT /api/v1/users/profile/preferences
 * Update user preferences
 */
export const updatePreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const updates = req.body;
    const profile = await UserProfileService.updatePreferences(userId, updates);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: profile.preferences,
    });
  } catch (err: any) {
    logError("[UserProfileController] updatePreferences failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to update preferences",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/users/profile/locations
 * Add saved location
 */
export const addSavedLocation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { name, lat, lng } = req.body;

    if (!name || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Name, lat, and lng are required",
      });
    }

    const profile = await UserProfileService.addSavedLocation(userId, { name, lat, lng });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found or max locations reached",
      });
    }

    res.json({
      success: true,
      data: profile.preferences.savedLocations,
    });
  } catch (err: any) {
    logError("[UserProfileController] addSavedLocation failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to add location",
      error: err.message,
    });
  }
};

/**
 * DELETE /api/v1/users/profile/locations/:name
 * Remove saved location
 */
export const removeSavedLocation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { name } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const profile = await UserProfileService.removeSavedLocation(userId, name);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile or location not found",
      });
    }

    res.json({
      success: true,
      message: "Location removed",
      data: profile.preferences.savedLocations,
    });
  } catch (err: any) {
    logError("[UserProfileController] removeSavedLocation failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to remove location",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/users/leaderboard
 * Get community leaderboard
 */
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const leaderboard = await UserProfileService.getLeaderboard(
      parseInt(limit as string) || 10
    );

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (err: any) {
    logError("[UserProfileController] getLeaderboard failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get leaderboard",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/users/me/level
 * Get current user's community level
 */
export const getCommunityLevel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const level = UserProfileService.getCommunityLevel(userId);
    const score = UserProfileService.getActivityScore(userId);

    res.json({
      success: true,
      data: {
        ...level,
        score,
      },
    });
  } catch (err: any) {
    logError("[UserProfileController] getCommunityLevel failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get community level",
      error: err.message,
    });
  }
};
