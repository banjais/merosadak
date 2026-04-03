// backend/src/routes/otpRouter.ts
import { Router } from "express";
import * as OtpController from "../controllers/otpController.js";

const router = Router();

// ----------------------
// OTP Endpoints
// ----------------------

// Request OTP (Telegram, for superadmins only)
router.post("/request", OtpController.requestOTP);

// Login with OTP (all users)
router.post("/login", OtpController.loginWithOTP);

export default router;
