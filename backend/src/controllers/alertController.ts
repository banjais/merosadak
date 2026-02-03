import { Request, Response } from "express";
import { updateAlerts, getCachedAlerts } from "../services/alertService.js";
import { logError } from "@logs/logs";

export const getAlerts = async (_req: Request, res: Response) => {
  try {
    const cached = await getCachedAlerts();
    if (!cached) return res.status(500).json({ message: "No alerts available" });
    res.json(cached);
  } catch (err: any) {
    logError("Error in getAlerts", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const refreshAlerts = async (_req: Request, res: Response) => {
  try {
    const updated = await updateAlerts();
    if (!updated) return res.status(500).json({ message: "Failed to update alerts" });
    res.json(updated);
  } catch (err: any) {
    logError("Error in refreshAlerts", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
