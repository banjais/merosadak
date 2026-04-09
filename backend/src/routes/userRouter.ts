// backend/src/routes/userRouter.ts
import { Router } from "express";
import * as UserController from "../controllers/userProfileController.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = Router();

// All user routes require authentication
router.use(authenticateJWT);

// Profile management
router.get("/profile", UserController.getProfile);
router.put("/profile/preferences", UserController.updatePreferences);

// Saved locations
router.post("/profile/locations", UserController.addSavedLocation);
router.delete("/profile/locations/:name", UserController.removeSavedLocation);

// Community features
router.get("/leaderboard", UserController.getLeaderboard);
router.get("/me/level", UserController.getCommunityLevel);

export default router;
