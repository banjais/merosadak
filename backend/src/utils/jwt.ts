// src/utils/jwt.ts
import jwt, { type SignOptions } from "jsonwebtoken";
import { logError } from "@logs/logs";
import type { JWTPayload, UserRole } from "../types.js";

// ----------------------
// Read JWT_SECRET at runtime
// ----------------------
const getSecretKey = (): string => {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("❌ JWT_SECRET is not defined");
  return key;
};

// -------------------- Sign Token --------------------
export function signToken(
  payload: JWTPayload,
  expiresIn: SignOptions["expiresIn"] = "7d"
): string {
  return jwt.sign(payload, getSecretKey(), {
    algorithm: "HS256",
    expiresIn,
  });
}

// -------------------- Verify Token --------------------
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getSecretKey());

    if (typeof decoded !== "object" || decoded === null) {
      logError("JWT verification returned invalid payload");
      return null;
    }

    const payload = decoded as JWTPayload;

    // Ensure role is valid
    const roles: UserRole[] = ["superadmin", "admin", "user"];
    if (!roles.includes(payload.role)) {
      logError("JWT verification returned invalid role");
      return null;
    }

    return payload;
  } catch (err: unknown) {
    logError("JWT verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// -------------------- Optional Test Function --------------------
export function testJWT(): void {
  if (process.env.NODE_ENV === "production") return; // skip in prod

  try {
    const payload: JWTPayload = {
      role: "admin",
      identifier: "testUser",
      method: "inapp",
    };

    const token = signToken(payload, "7d");
    const decoded = verifyToken(token);

    console.log("✅ JWT_SECRET is loaded successfully");
    console.log("✅ Signed JWT token:", token);
    console.log("✅ Verified payload:", decoded);
  } catch (err: unknown) {
    console.error(
      "❌ JWT test failed:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

// If you want, you can run it automatically in dev:
// testJWT();
