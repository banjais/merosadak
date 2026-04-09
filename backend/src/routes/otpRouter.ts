// backend/src/routes/otpRouter.ts
import { Router } from "express";
import * as OtpController from "../controllers/otpController.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { validate, requestOTPSchema, loginOTPSchema } from "../middleware/validation.js";

const router = Router();

// ----------------------
// OTP Endpoints (with rate limiting + validation)
// ----------------------

// Request OTP (Telegram, for superadmins only)
router.post("/request", authLimiter, validate(requestOTPSchema), OtpController.requestOTP);

// Login with OTP (all users)
router.post("/login", authLimiter, validate(loginOTPSchema), OtpController.loginWithOTP);

export default router;
