import rateLimit from "express-rate-limit";

/**
 * Strict rate limiter for administrative operations.
 * Limits to 5 requests per 15 minutes to prevent CPU exhaustion 
 * during index rebuilding or heavy cache clearing.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many administrative requests. Please wait 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

export const incidentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many incident reports. Please wait before submitting another.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});