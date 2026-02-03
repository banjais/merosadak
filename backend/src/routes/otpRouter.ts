// backend/src/routes/otpRouter.ts
import { Router } from "express";
import * as OTPController from "../controllers/otpController.js"; // <-- ESM compatible

const router = Router();

// Request OTP (Telegram/email)
router.post("/request-otp", OTPController.requestOTP);

// Verify OTP and issue session token
router.post("/verify-otp", OTPController.verifyOTP);

export default router;
