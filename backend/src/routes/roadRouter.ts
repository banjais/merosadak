// backend/src/routes/roadRouter.ts
import { Router } from "express";
import * as roadController from "../controllers/roadController.js";

const router = Router();

router.get("/", roadController.root);
router.get("/all", roadController.getAllRoads);
router.get("/search", roadController.searchRoads);

export default router;
