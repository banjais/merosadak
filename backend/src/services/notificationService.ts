// backend/src/services/notificationService.ts
import nodemailer from "nodemailer";
import { config } from "../config/index.js";
import { logError, logInfo } from "../logs/logs.js";

let transporter: nodemailer.Transporter | null = null;

/**
 * 📧 Initialize Email Transporter
 */
function getEmailTransporter() {
  if (transporter) return transporter;

  const { SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
      logError("[NotificationService] SMTP credentials missing, email disabled.");
      return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * 📧 Send Email (OTP or Alert)
 */
export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  const mailer = getEmailTransporter();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: `"Sadak-Sathi" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });
    logInfo(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err: any) {
    logError(`[Email] Failed to send to ${to}`, { error: err.message });
    return false;
  }
}

/**
 * 📲 Send Telegram Message (OTP or Alert)
 */
export async function sendTelegramMessage(chatId: string, message: string) {
  const token = config.GEMINI_API_KEY; // Wait, GEMINI? No, TELEGRAM_BOT_TOKEN
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    logError("[NotificationService] TELEGRAM_BOT_TOKEN missing.");
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(errorData.description || "Telegram API error");
    }

    logInfo(`[Telegram] Sent to ${chatId}`);
    return true;
  } catch (err: any) {
    logError(`[Telegram] Failed to send to ${chatId}`, { error: err.message });
    return false;
  }
}

/**
 * 🛡️ System Alert Broadcaster
 * Sends to both Email and Telegram if configured
 */
export async function broadcastSystemAlert(subject: string, message: string) {
    logInfo(`🚨 SYSTEM ALERT: ${subject} - ${message}`);
    
    const alertEmail = process.env.ALERT_EMAIL_TO;
    if (alertEmail) {
        await sendEmail({ to: alertEmail, subject: `[Sadak-Sathi] ${subject}`, text: message });
    }

    const alertChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
    if (alertChatId) {
        await sendTelegramMessage(alertChatId, `🚨 *${subject}*\n\n${message}`);
    }
}
