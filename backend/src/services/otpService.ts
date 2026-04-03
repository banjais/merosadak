// backend/src/services/otpService.ts
import { logError } from "../logs/logs.js";
import { signToken } from "../utils/jwt.js";
import * as alertService from "./alertService.js";
import type { UserRole } from "../types.js";

// In-memory OTP store (temporary)
const otpStore: Record<string, { otp: string; ts: number }> = {};

/* ---------------- Generate JWT Session ---------------- */
export async function generateSessionToken(email: string, role: string): Promise<string> {
  return signToken({
    email,
    role: role as UserRole,
    identifier: email,
    method: "inapp",
  });
}

/* ---------------- Determine User Role ---------------- */
export async function getUserRoleByEmail(email: string): Promise<UserRole> {
  if (email.endsWith("@admin.com") || email.endsWith("@super.com")) return "superadmin";
  return "user";
}

/* ---------------- Issue OTP via Telegram ---------------- */
export async function issueTelegramOTP(email: string, chatId?: string): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, ts: Date.now() };

  try {
    await alertService.sendTelegramMessage(
      `🔒 MeroSadak Verification\n\nYour OTP is: ${otp}\nExpires in 5 minutes.`
    );
  } catch (err: any) {
    logError(`[OtpService] Failed to send Telegram OTP to ${chatId}`, err.message);
  }
}

/* ---------------- Issue OTP via Email ---------------- */
export async function issueEmailOTP(email: string): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, ts: Date.now() };

  try {
    await alertService.sendEmail({
      to: email,
      subject: "MeroSadak Verification Code",
      text: `Your verification code is: ${otp}\nIt expires in 5 minutes.`,
    });
  } catch (err: any) {
    logError(`[OtpService] Failed to send Email OTP to ${email}`, err.message);
  }
}

/* ---------------- Verify OTP ---------------- */
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  const record = otpStore[email];
  if (!record) return false;

  const expired = Date.now() - record.ts > 5 * 60 * 1000; // 5 min
  if (expired) {
    delete otpStore[email];
    return false;
  }

  if (record.otp === otp) {
    delete otpStore[email];
    return true;
  }
  return false;
}
