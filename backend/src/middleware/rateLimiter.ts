// backend/src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "../config/index.js";
import { logInfo, logError } from "../logs/logs.js";

// General API rate limiter (default)
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX * 10, // 50 requests per minute for general endpoints
  message: {
    success: false,
    message: "Too many requests, please try again later.",
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logInfo("[RateLimiter] Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

// Strict rate limiter for auth endpoints (OTP requests)
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 3, // Only 3 OTP requests per minute
  message: {
    success: false,
    message: "Too many OTP requests. Please wait before requesting again.",
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logInfo("[RateLimiter] Auth rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      email: req.body?.email || "unknown",
    });
    res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please wait before requesting again.",
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

// Medium rate limiter for user incident reporting
export const incidentLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 10, // 10 incident reports per minute per IP
  message: {
    success: false,
    message: "Too many incident reports. Please wait before submitting again.",
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logInfo("[RateLimiter] Incident rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: "Too many incident reports. Please wait before submitting again.",
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

// AI/Gemini rate limiter
export const aiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS * 2, // 2 minute window
  max: 5, // 5 AI requests per 2 minutes
  message: {
    success: false,
    message: "AI request limit exceeded. Please try again in a moment.",
    retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS * 2) / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logInfo("[RateLimiter] AI rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: "AI request limit exceeded. Please try again in a moment.",
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS * 2) / 1000),
    });
  },
});

// Superadmin endpoints - more lenient but still protected
export const adminLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX * 20, // 100 requests per minute for admin
  message: {
    success: false,
    message: "Admin rate limit exceeded.",
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cache refresh endpoint - very strict
export const cacheRefreshLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS * 5, // 5 minute window
  max: 2, // Only 2 cache refreshes per 5 minutes
  message: {
    success: false,
    message: "Cache refresh limit exceeded. Please wait.",
    retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS * 5) / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
