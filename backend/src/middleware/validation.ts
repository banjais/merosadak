// backend/src/middleware/validation.ts
import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { logInfo } from "../logs/logs.js";

// Validation error response type
export interface ValidationError {
  success: false;
  message: string;
  errors: Record<string, string[]>;
}

/**
 * Generic validation middleware factory
 */
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema instanceof z.ZodObject) {
        const validated = schema.parse(req.body);
        req.body = validated;
      }
      next();
    } catch (error: any) {
      logInfo("[Validation] Request validation failed", {
        path: req.path,
        errors: error.errors?.map((e: any) => ({ path: e.path.join("."), message: e.message })),
      });

      const errors: Record<string, string[]> = {};
      error.errors?.forEach((e: any) => {
        const key = e.path.join(".") || "body";
        if (!errors[key]) errors[key] = [];
        errors[key].push(e.message);
      });

      res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors,
      });
    }
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error: any) {
      const errors: Record<string, string[]> = {};
      error.errors?.forEach((e: any) => {
        const key = e.path.join(".") || "query";
        if (!errors[key]) errors[key] = [];
        errors[key].push(e.message);
      });

      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors,
      });
    }
  };
};

// ────────────────────────────────
// AUTH SCHEMAS
// ────────────────────────────────
export const requestOTPSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  chatId: z.string().optional(),
});

export const loginOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must contain only numbers"),
});

// ────────────────────────────────
// INCIDENT SCHEMA
// ────────────────────────────────
export const incidentSchema = z.object({
  type: z.enum(["blockage", "accident", "traffic", "construction", "weather", "other"], {
    errorMap: () => ({ message: "Invalid incident type. Must be one of: blockage, accident, traffic, construction, weather, other" }),
  }),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  lat: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  lng: z.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  timestamp: z.string().datetime().optional(),
  images: z.array(z.string().url()).max(3).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  userId: z.string().optional(),
});

// ────────────────────────────────
// GEMINI AI SCHEMA
// ────────────────────────────────
export const geminiQuerySchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt must be less than 2000 characters"),
  context: z.enum(["road_conditions", "weather", "routing", "general", "emergency"], {
    errorMap: () => ({ message: "Invalid context. Must be one of: road_conditions, weather, routing, general, emergency" }),
  }).optional(),
  language: z.string().max(5).optional().default("en"),
  images: z.array(z.string().url()).max(5).optional(),
});

// ────────────────────────────────
// SEARCH SCHEMA
// ────────────────────────────────
export const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  type: z.enum(["road", "poi", "traffic", "weather", "highway"]).optional(),
});

// ────────────────────────────────
// WEATHER SCHEMA
// ────────────────────────────────
export const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  city: z.string().max(100).optional(),
});

// ────────────────────────────────
// TRAFFIC SCHEMA
// ────────────────────────────────
export const trafficNearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(50000).optional().default(2000),
});

// ────────────────────────────────
// POI SCHEMA
// ────────────────────────────────
export const poiQuerySchema = z.object({
  q: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  type: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ────────────────────────────────
// ALERTS SCHEMA
// ────────────────────────────────
export const alertQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(50000).optional(),
  type: z.enum(["blockage", "weather", "landslide", "flood", "accident"]).optional(),
});

// ────────────────────────────────
// HIGHWAY ALTERNATIVES SCHEMA
// ────────────────────────────────
export const highwayAlternativesSchema = z.object({
  from: z.string().min(1, "From district is required").max(100),
  to: z.string().min(1, "To district is required").max(100),
});

// ────────────────────────────────
// USER PREFERENCE SCHEMA (Tier 2)
// ────────────────────────────────
export const userPreferencesSchema = z.object({
  language: z.string().max(5).optional(),
  defaultLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  notificationPreferences: z.object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    telegram: z.boolean().optional(),
    weatherAlerts: z.boolean().optional(),
    roadBlockAlerts: z.boolean().optional(),
    monsoonAlerts: z.boolean().optional(),
  }).optional(),
  favoriteHighways: z.array(z.string()).max(20).optional(),
  savedLocations: z.array(z.object({
    name: z.string().max(50),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).max(10).optional(),
});

// ────────────────────────────────
// INCIDENT VOTE SCHEMA (Tier 2)
// ────────────────────────────────
export const incidentVoteSchema = z.object({
  incidentId: z.string().min(1, "Incident ID is required"),
  vote: z.enum(["up", "down"], {
    errorMap: () => ({ message: "Vote must be 'up' or 'down'" }),
  }),
});

// ────────────────────────────────
// ROUTE PLANNING SCHEMA (Tier 2)
// ────────────────────────────────
export const routePlanningSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().max(200).optional(),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().max(200).optional(),
  }),
  preferences: z.object({
    avoidBlocked: z.boolean().optional().default(true),
    prioritizeSafety: z.boolean().optional().default(false),
    maxDeviationKm: z.number().optional().default(50),
  }).optional(),
});

// ────────────────────────────────
// VOICE REPORT SCHEMA (Tier 3)
// ────────────────────────────────
export const voiceReportSchema = z.object({
  audioData: z.string().min(1, "Audio data is required"),
  language: z.string().max(5).optional().default("en"),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

// ────────────────────────────────
// GEOFENCE ALERT SCHEMA (Tier 3)
// ────────────────────────────────
export const geofenceAlertSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(100).max(10000),
  alertTypes: z.array(z.enum(["weather", "blockage", "landslide", "flood"])).min(1).max(10),
});
