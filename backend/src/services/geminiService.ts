// backend/src/services/geminiService.ts

import axios from "axios";
import { GEMINI_API_KEY, GEMINI_API_URL, GEMINI_MODEL_PRIMARY } from "../config/index.js";

export interface MultimodalPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string; // Base64 string
  };
}

export class GeminiService {
  private readonly apiKey = GEMINI_API_KEY;
  private readonly baseUrl = GEMINI_API_URL;
  private readonly model = GEMINI_MODEL_PRIMARY;

  /**
   * Generic Multimodal Generator
   * Handles: Text, Images, and Audio dynamically
   */
  async generateMultimodalContent(parts: MultimodalPart[], systemInstruction?: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

      const requestBody: any = {
        contents: parts.map(p => ({ part: p })), // lightweight array
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await axios.post(url, requestBody);

      // Safely pick text
      const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      return result || "";
    } catch (error: any) {
      console.error("❌ [GeminiService] Error:", error.response?.data || error.message);
      return ""; // fail-safe, no throw
    }
  }

  /**
   * Simple text generation
   */
  async generateText(prompt: string): Promise<string> {
    return this.generateMultimodalContent([{ text: prompt }]);
  }
}

// Single instance for controllers
export const geminiService = new GeminiService();