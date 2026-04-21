import { Router, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { DATA_DIR, DISTRICT_DATA, PROVINCE_DATA, LOCAL_DATA } from "@/config/paths.js";
import { logError } from "@logs/logs.js";

const router = Router();

/**
 * Serves the pre-generated inverted Nepal mask for the frontend Spotlight effect.
 */
router.get("/mask", async (_req: Request, res: Response) => {
    const maskPath = path.join(DATA_DIR, "nepal_mask.geojson");
    try {
        const data = await fs.readFile(maskPath, "utf-8");
        return res.json({ success: true, data: JSON.parse(data) });
    } catch (err: any) {
        logError("[BoundaryRouter] Mask file not found. Ensure the generation script has run.", err.message);
        return res.status(404).json({ success: false, message: "Mask data unavailable" });
    }
});

/**
 * Serves District boundaries for sharp lines and selection.
 */
router.get("/districts", async (_req: Request, res: Response) => {
    try {
        const data = await fs.readFile(DISTRICT_DATA, "utf-8");
        return res.json({ success: true, data: JSON.parse(data) });
    } catch (err: any) {
        logError("[BoundaryRouter] District file not found", err.message);
        return res.status(404).json({ success: false, message: "District data unavailable" });
    }
});

/**
 * Serves Province boundaries.
 */
router.get("/provinces", async (_req: Request, res: Response) => {
    try {
        const data = await fs.readFile(PROVINCE_DATA, "utf-8");
        return res.json({ success: true, data: JSON.parse(data) });
    } catch (err: any) {
        logError("[BoundaryRouter] Province file not found", err.message);
        return res.status(404).json({ success: false, message: "Province data unavailable" });
    }
});

/**
 * Serves Local body (municipality/rural municipality) boundaries.
 * Properties include: FIRST_GaPa (name), District, FIRST_Type (type)
 */
router.get("/local", async (_req: Request, res: Response) => {
    try {
        const data = await fs.readFile(LOCAL_DATA, "utf-8");
        return res.json({ success: true, data: JSON.parse(data) });
    } catch (err: any) {
        logError("[BoundaryRouter] Local bodies file not found", err.message);
        return res.status(404).json({ success: false, message: "Local bodies data unavailable" });
    }
});

export default router;