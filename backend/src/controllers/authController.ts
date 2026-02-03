import { Request, Response } from "express";
import * as OtpService from "../services/otpService.js";
import { logAuth, logError } from "@logs/logs";
import type { UserRole } from "../types.js";

/**
 * Request OTP for superadmins
 */
export const requestOTP = async (req: Request, res: Response) => {
  try {
    const { email, chatId } = req.body;
    if (!email || !chatId) return res.status(400).json({ success: false, message: "Email and chatId required" });

    const role = await OtpService.getUserRoleByEmail(email);
    if (role !== "superadmin") return res.status(403).json({ success: false, message: "OTP only for superadmins" });

    await OtpService.issueTelegramOTP(email, chatId);
    logAuth(email, role, "OTP issued via Telegram");
    return res.json({ success: true, message: "OTP sent via Telegram" });
  } catch (err: any) {
    logError("[authController] request-otp failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

/**
 * Login with email (and OTP for superadmin)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    let role: UserRole = await OtpService.getUserRoleByEmail(email);

    if (role === "superadmin") {
      if (!otp) return res.status(400).json({ success: false, message: "OTP required for superadmin" });
      const ok = await OtpService.verifyOTP(email, otp);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
    }

    const token = await OtpService.generateSessionToken(email, role);
    logAuth(email, role, "Login success");
    return res.json({ success: true, email, role, token });
  } catch (err: any) {
    logError("[authController] login failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error during login" });
  }
};
