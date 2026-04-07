// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/index.js"; // Direct import
import { logError } from "../logs/logs.js";

// Extend Express Request type to include the user object
export interface AuthRequest extends Request {
  user?: {
    id: string | number;
    email: string;
    role: "user" | "admin" | "superadmin";
  };
}

/**
 * 1. Authenticate JWT
 * Validates the token and attaches the user object to the request
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Fixed: Use JWT_SECRET directly as exported in config/index.ts
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    logError("[authMiddleware] JWT Verification failed", { error: err.message });
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * 2. Authorize Role
 * Checks if the user's role matches the allowed roles for a route
 */
export const authorizeRole = (...allowedRoles: ("user" | "admin" | "superadmin")[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires ${allowedRoles.join(" or ")} role`
      });
    }

    next();
  };
};
