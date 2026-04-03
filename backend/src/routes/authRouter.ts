// backend/src/routes/authRouter.ts
import { Router, Request, Response } from "express";
import * as AuthController from "../controllers/authController.js";

const router = Router();

/**
 * 🔑 POST /api/auth/request-otp
 * Request an OTP for authentication
 * Body: { contact: string } (email or phone)
 */
router.post("/request-otp", async (req: Request, res: Response) => {
  try {
    const result = await AuthController.requestOTP(req, res);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to request OTP",
      error: err.message,
    });
  }
});

/**
 * 🔐 POST /api/auth/login
 * Login using OTP and receive session token
 * Body: { contact: string, otp: string }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const result = await AuthController.login(req, res);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: err.message,
    });
  }
});

export default router;
