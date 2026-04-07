// backend/src/utils/sentry.ts
import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import { logInfo, logError } from "../logs/logs.js";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE,
  SENTRY_PROFILES_SAMPLE_RATE,
  NODE_ENV,
} from "../config/index.js";

// Define severity manually to satisfy TypeScript
type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug" | "critical";

// ──────────────────────────────────────────────
// 1️⃣ Initialize Sentry
// ──────────────────────────────────────────────
export function initializeSentry(): void {
  if (!SENTRY_DSN) {
    logError("[Sentry] SENTRY_DSN not configured");
    return;
  }

  let nodeProfilingIntegration: any = undefined;

  try {
    // optional CPU profiler (may fail on Windows)
    nodeProfilingIntegration = require("@sentry/profiling-node").nodeProfilingIntegration;
    logInfo("[Sentry] CPU profiler loaded");
  } catch {
    logInfo("[Sentry] CPU profiler skipped (optional module missing)");
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT || NODE_ENV || "development",
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
    integrations: nodeProfilingIntegration ? [nodeProfilingIntegration()] : [],
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
