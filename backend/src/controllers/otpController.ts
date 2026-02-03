import { Request, Response } from "express";
import * as OTPService from "../services/otpService.js";
import { logAuth, logError } from "../logs/logs.js";

export const requestOTP = async (req: Request, res: Response) => {
  const { email, telegramId } = req.body;
  try {
    if (telegramId && email) await OTPService.issueTelegramOTP(email, telegramId);
    else if (email) await OTPService.issueTelegramOTP(email, email);
    return res.json({ success: true, message: "OTP dispatched successfully via Telegram" });
  } catch (err: any) {
    logError("[otpController] Request failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to dispatch OTP" });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const isValid = await OTPService.verifyOTP(email, otp);
    if (!isValid) return res.status(401).json({ success: false, message: "Invalid or Expired OTP" });

    const role = await OTPService.getUserRoleByEmail(email);
    const token = await OTPService.generateSessionToken(email, role);
    logAuth(email, role, "Login via OTP Success");

    return res.json({ success: true, token, role, email });
  } catch (err: any) {
    logError("[otpController] Verification failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error during verification" });
  }
};
