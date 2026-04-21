import { Router } from "express";
import { triggerSearchRefresh } from "./searchController.js";
// Assuming these middlewares exist based on typical project structure
// import { authenticate, authorizeSuperadmin } from "../../middleware/authMiddleware.js";

const router = Router();

router.post("/refresh", triggerSearchRefresh);

export default router;