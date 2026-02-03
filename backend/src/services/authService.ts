// backend/src/services/authService.ts
import { logInfo, logError } from "@logs/logs";
import * as OtpService from "./otpService.js";

export interface AuthResponse {
  token: string;
  role: string;
  email: string;
}

/**
 * Login a user with email + OTP
 */
export async function loginWithOTP(email: string, otp: string): Promise<AuthResponse | null> {
  try {
    // 1️⃣ Verify OTP
    const isValid = await OtpService.verifyOTP(email, otp);
    if (!isValid) return null;

    // 2️⃣ Determine user role
    const role = await OtpService.getUserRoleByEmail(email);

    // 3️⃣ Generate JWT session token
    const token = await OtpService.generateSessionToken(email, role);

    logInfo(`[authService] User logged in: ${email} (${role})`);
    return { token, role, email };
  } catch (err: any) {
    logError("[authService] Login failed", { error: err.message });
    return null;
  }
}

/**
 * Request OTP for login (via Telegram)
 */
export async function requestOTP(email: string, chatId: string): Promise<boolean> {
  try {
    await OtpService.issueTelegramOTP(email, chatId);
    logInfo(`[authService] OTP sent to ${email} via Telegram chat ${chatId}`);
    return true;
  } catch (err: any) {
    logError("[authService] OTP Request failed", { error: err.message });
    return false;
  }
}
