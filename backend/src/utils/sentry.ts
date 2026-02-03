// backend/src/utils/sentry.ts
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { Request, Response, NextFunction } from "express";
import { logInfo, logError } from "@logs/logs";

// Define severity manually to satisfy TypeScript
type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug" | "critical";

// ──────────────────────────────────────────────
// 1️⃣ Initialize Sentry
// ──────────────────────────────────────────────
export function initializeSentry(): void {
  const SENTRY_DSN = process.env.SENTRY_DSN;
  if (!SENTRY_DSN) {
    logError("[Sentry] SENTRY_DSN not configured");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
    integrations: [nodeProfilingIntegration()],
    beforeSend(event: any) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  logInfo("[Sentry] Error tracking initialized");
}

// ──────────────────────────────────────────────
// 2️⃣ Capture exception
// ──────────────────────────────────────────────
export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, { extra: context });
}

// ──────────────────────────────────────────────
// 3️⃣ Capture custom message
// ──────────────────────────────────────────────
export function captureMessage(message: string, level: SeverityLevel = "info"): void {
  Sentry.captureMessage(message, level);
}

// ──────────────────────────────────────────────
// 4️⃣ Express error handler for Sentry
// ──────────────────────────────────────────────
export function getSentryErrorHandler() {
  return (err: Error, _req: Request, _res: Response, next: NextFunction) => {
    captureException(err);
    next(err);
  };
}

// ──────────────────────────────────────────────
// 5️⃣ Express request handler (optional)
// ──────────────────────────────────────────────
export function getSentryRequestHandler() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}
