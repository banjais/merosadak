import { Router } from "express";
import { handleGetPOI } from "../controllers/poiController.js";

const router = Router();

/**
 * @route   GET /api/pois
 * @desc    Search for POIs (Petrol, Hospitals, Tourist Spots, etc.)
 * @access  Public
 * @query   q: string (The search query)
 * @query   lat: number (User latitude)
 * @query   lng: number (User longitude)
 */
router.get("/", handleGetPOI);

// Future endpoints can be added easily:
// router.get("/:id", handleGetPOIDetails);

export default router;
