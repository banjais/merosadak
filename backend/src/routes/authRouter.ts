// backend/src/routes/authRouter.ts
import { Router } from "express";
import { requestOTP, login } from "../controllers/authController.js";

const router = Router();

// POST /api/auth/request-otp
router.post("/request-otp", requestOTP);

// POST /api/auth/login
router.post("/login", login);

export default router;
