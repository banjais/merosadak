import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/index.js";

/**
 * Signs a new JWT token for a user session.
 */
export function signToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any
  });
}

/**
 * Verifies a JWT token.
 */
export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}