// backend/src/controllers/geminiController.ts

import { Request, Response } from "express";
import { geminiService } from "../services/geminiService.js";
import { logError } from "../logs/logs.js";

export const GeminiController = {
  /**
   * Handle chat-style text prompt with context
   * POST /api/v1/gemini/query
   */
  handleQuery: async (req: Request, res: Response) => {
    try {
      const { prompt, systemPrompt, image, mode, verbosity, moodEQ } = req.body;

      if (!prompt) {
        return res.status(400).json({ success: false, message: "Prompt is required" });
      }

      // Build the full prompt with context
      let fullPrompt = prompt;

      if (systemPrompt) {
        fullPrompt = `${systemPrompt}\n\n---\n\nUser question: ${prompt}\n\nRemember to follow the system context above and be helpful.`;
      }

      // Adjust response based on mode
      if (mode === 'safe') {
        fullPrompt += '\n\nPrioritize safety recommendations and conservative advice.';
      } else if (mode === 'pro') {
        fullPrompt += '\n\nProvide detailed, expert-level analysis with alternatives.';
      }

      // Adjust verbosity
      if (verbosity === 'brief') {
        fullPrompt += '\n\nKeep your response concise (2-3 sentences max).';
      } else {
        fullPrompt += '\n\nProvide a detailed, thorough response.';
      }

      // Mood EQ adjustment
      if (moodEQ) {
        fullPrompt += '\n\nBe empathetic and understanding. Use a warm, supportive tone.';
      } else {
        fullPrompt += '\n\nBe factual and direct.';
      }

      const result = await geminiService.generateText(fullPrompt);

      res.json({
        success: true,
        response: result || "I'm sorry, I couldn't process that request. Please try again.",
        metadata: {
          mode,
          verbosity,
          moodEQ,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logError('[GeminiController] Query failed', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message,
        fallback: "I'm having trouble connecting to my AI brain. Please check your internet connection and try again."
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