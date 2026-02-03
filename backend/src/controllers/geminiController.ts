import { Request, Response } from "express";
import * as GeminiService from "../services/geminiService.js";
import { logError } from "../logs/logs.js";

export const handleQuery = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const email = (req as any).user?.email || "anonymous";

  try {
    if (!prompt) return res.status(400).json({ success: false, message: "Prompt is required" });

    const result = await GeminiService.chatWithGemini(prompt, email);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logError("[geminiController] Query failed", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserUsage = async (req: Request, res: Response) => {
  try {
    const email = (req as any).user?.email;
    const usage = await GeminiService.getGeminiUsageStats(email);
    res.json({ success: true, usage });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to fetch usage" });
  }
};

export const getLogs = async (_req: Request, res: Response) => {
  res.json({ success: true, logs: [] });
};
