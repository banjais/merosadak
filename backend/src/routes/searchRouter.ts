// backend/src/routes/searchRouter.ts
import { Router } from "express";
import { handleSearch } from "../controllers/searchController.js";

const router = Router();

/**
 * GET /api/search?q=<query>&limit=<number>
 */
router.get("/", handleSearch);

export default router;
