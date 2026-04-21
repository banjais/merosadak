import { Router } from "express";
import * as controller from "@/services/verificationController.js";

const router = Router();

/** Public verification endpoints */
router.get("/u/:identifier", controller.handleUserVerification);
router.get("/t/:tripId", controller.handleTripVerification);

export default router;