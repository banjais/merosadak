// backend/src/controllers/geminiController.ts

import { Request, Response } from "express";
import { geminiService } from "../services/geminiService.js";

export const GeminiController = {
  /**
   * Handle chat-style text prompt
   * POST /api/gemini/query
   */
  handleQuery: async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ success: false, message: "Prompt is required" });

      const result = await geminiService.generateText(prompt);

      res.json({ success: true, response: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Return placeholder usage stats
   * GET /api/gemini/usage
   */
  getUserUsage: async (_req: Request, res: Response) => {
    res.json({ success: true, usage: 0, limit: 1000 });
  },

  /**
   * Return placeholder logs
   * GET /api/gemini/logs
   */
  getLogs: async (_req: Request, res: Response) => {
    res.json({ success: true, logs: [] });
  },

  /**
   * Analyze road image with optional prompt
   * POST /api/gemini/analyze-image
   */
  analyzeRoadImage: async (req: Request, res: Response) => {
    try {
      const { base64Image, prompt } = req.body;
      if (!base64Image) return res.status(400).json({ success: false, message: "Image is required" });

      const parts = [
        { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        { text: prompt || "Analyze this road for safety hazards and potholes." }
      ];

      const result = await geminiService.generateMultimodalContent(parts);

      res.json({ success: true, analysis: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Detect emotion from audio
   * POST /api/gemini/detect-emotion
   */
  detectEmotion: async (req: Request, res: Response) => {
    try {
      const { base64Audio } = req.body;
      if (!base64Audio) return res.status(400).json({ success: false, message: "Audio is required" });

      const systemPrompt = "You are an expert in affective computing. Identify the primary emotion (Happy, Sad, Angry, Neutral) and give a brief reasoning.";

      const parts = [
        { inline_data: { mime_type: "audio/mp3", data: base64Audio } },
        { text: "Identify the emotion in this voice clip." }
      ];

      const result = await geminiService.generateMultimodalContent(parts, systemPrompt);

      res.json({ success: true, emotionData: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};