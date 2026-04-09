// backend/src/routes/routePlanningRouter.ts
import { Router } from "express";
import * as RoutePlanningController from "../controllers/routePlanningController.js";

const router = Router();

// Route planning endpoints
router.post("/plan", RoutePlanningController.planRoute);
router.post("/compare", RoutePlanningController.compareRoutes);
router.post("/safety", RoutePlanningController.getRouteSafety);

export default router;
