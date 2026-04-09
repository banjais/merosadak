// backend/src/controllers/otpController.ts
import { Request, Response } from "express";
import * as OtpService from "../services/otpService.js";
import { logError, logAuth } from "../logs/logs.js";
import type { UserRole } from "../types.js";

/**
 * POST /api/otp/request
 * Request OTP via Telegram (superadmins only)
 */
export const requestOTP = async (req: Request, res: Response) => {
  try {
    const { email, chatId } = req.body;

    if (!email || !chatId) {
      return res.status(400).json({ success: false, message: "Email and chatId are required" });
    }

    const role: UserRole = await OtpService.getUserRoleByEmail(email);
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "OTP is only available for superadmins" });
    }

    await OtpService.issueTelegramOTP(email, chatId);
    logAuth("OTP issued via Telegram", { email, role });

    return res.json({ success: true, message: "OTP sent via Telegram" });
  } catch (err: any) {
    logError("[OtpController] requestOTP failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to send OTP", error: err.message });
  }
};

/**
 * POST /api/otp/login
 * Login using email + OTP (superadmins) or email only (users)
 */
export const loginWithOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const role: UserRole = await OtpService.getUserRoleByEmail(email);

    // Superadmin must provide OTP
    if (role === "superadmin") {
      if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required for superadmin login" });
      }

      const valid = await OtpService.verifyOTP(email, otp);
      if (!valid) {
        return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
      }
    }

    const token = await OtpService.generateSessionToken(email, role);
    logAuth("Login successful", { email, role });

    return res.json({ success: true, email, role, token });
  } catch (err: any) {
    logError("[OtpController] loginWithOTP failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error during login", error: err.message });
  }
};
