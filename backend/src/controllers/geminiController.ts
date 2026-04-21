// backend/src/controllers/geminiController.ts

import { Request, Response } from "express";
import { geminiService, LOCAL_KNOWLEDGE, getDataStats } from "../services/geminiService.js";
import { logError } from "../logs/logs.js";

export const GeminiController = {
  /**
   * Handle chat-style text prompt with context
   * POST /api/v1/gemini/query
   */
  handleQuery: async (req: Request, res: Response) => {
    try {
      const { prompt, systemPrompt, mode, verbosity, moodEQ } = req.body;

      if (!prompt) {
        return res.status(400).json({ success: false, message: "Prompt is required" });
      }

      // Get real data stats for context
      const stats = getDataStats();
      
      // Build context with real data
      let contextInfo = `You are MeroSadak - Nepal Travel Companion.
Current data: ${stats.roads} roads, ${stats.monsoon} monsoon zones, ${stats.alerts} active alerts.
Speak naturally. No lists or bullets unless asked.`;

      let fullPrompt = prompt;

      if (systemPrompt) {
        fullPrompt = `${contextInfo}\n\n${systemPrompt}\n\nQuestion: ${prompt}`;
      } else {
        fullPrompt = `${contextInfo}\n\n${prompt}`;
      }

      if (mode === 'safe') {
        fullPrompt += ' Prioritize safety.';
      } else if (mode === 'pro') {
        fullPrompt += ' Provide detailed analysis.';
      }

      if (verbosity === 'brief') {
        fullPrompt += ' Keep it short - 2-3 sentences.';
      }

      if (moodEQ) {
        fullPrompt += ' Be warm and empathetic.';
      }

      // Get response - uses AI if available, local fallback otherwise
      const result = await geminiService.generateSmartResponse(fullPrompt);

      res.json({
        success: true,
        response: result.text,
        source: result.source,
        dataStats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logError('[GeminiController] Query failed', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        response: "im here to help with your journey in nepal",
        fallback: true
      });
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
   * Uses secondary model for simpler visual analysis
   */
  analyzeRoadImage: async (req: Request, res: Response) => {
    try {
      const { base64Image, prompt, systemPrompt } = req.body;
      if (!base64Image) return res.status(400).json({ success: false, message: "Image is required" });

      const parts = [
        { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        { text: prompt || "Analyze this road for safety hazards and potholes." }
      ];

      const result = await geminiService.generateMultimodalContent(parts, systemPrompt, "secondary");

      res.json({
        success: true,
        tier: "secondary",
        analysis: result || "Visual analysis completed but no hazards were identified."
      });
    } catch (error: any) {
      logError('[GeminiController] Image analysis failed', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Detect emotion from audio
   * POST /api/gemini/detect-emotion
   * Uses lite model for quick emotion detection
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

      const result = await geminiService.generateMultimodalContent(parts, systemPrompt, "lite");

      res.json({
        success: true,
        tier: "lite",
        emotionData: result || "Could not detect distinct emotion from the provided audio."
      });
    } catch (error: any) {
      logError('[GeminiController] Emotion detection failed', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  }
};