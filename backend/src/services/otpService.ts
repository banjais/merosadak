import { config } from "../config/index.js";
import { logError } from "../logs/logs.js";
import { signToken } from "../utils/jwt.js";
import { sendTelegramMessage, sendEmail } from "./notificationService.js";
import type { UserRole } from "../types.js";

// Temporary in-memory OTP store
const otpStore: Record<string, { otp: string; ts: number }> = {}; 

/**
 * Generate JWT Session Token for an email + role
 */
export async function generateSessionToken(email: string, role: string): Promise<string> {
  // Use unified JWT utility
  return signToken({ 
    email, 
    role: role as UserRole, 
    identifier: email, 
    method: "inapp" 
  });
}

/**
 * Determine user role based on email
 */
export async function getUserRoleByEmail(email: string): Promise<UserRole> {
  if (email.endsWith("@admin.com") || email.endsWith("@super.com")) {
    return "superadmin";
  }
  return "user";
}

/**
 * Issue OTP via Telegram
 */
export async function issueTelegramOTP(email: string, chatId: string): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
  otpStore[email] = { otp, ts: Date.now() };
  
  await sendTelegramMessage(
    chatId, 
    `🔒 Sadak-Sathi Verification\n\nYour OTP is: ${otp}\n\nExpires in 5 minutes.`
  );
}

/**
 * Issue OTP via Email
 */
export async function issueEmailOTP(email: string): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, ts: Date.now() };

  await sendEmail({
    to: email,
    subject: "Sadak-Sathi Verification Code",
    text: `Your verification code is: ${otp}\n\nIt expires in 5 minutes.`
  });
}

/**
 * Verify OTP validity
 */
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  const record = otpStore[email];
  if (!record) return false;

  const isExpired = Date.now() - record.ts > 5 * 60 * 1000;
  if (isExpired) {
    delete otpStore[email];
    return false;
  }

  if (record.otp === otp) {
    delete otpStore[email];
    return true;
  }

  return false;
}
