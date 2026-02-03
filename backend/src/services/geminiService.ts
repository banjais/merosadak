import { config } from "../config/index.js";
import { logError } from "../logs/logs.js";
import { recordAnalytics } from "./superadminService.js";

/**
 * Send a prompt to Gemini AI and return the generated response
 */
export async function chatWithGemini(prompt: string, userEmail: string) {
  try {
    if (!config.GEMINI_API_KEY) {
      throw new Error("Gemini API key not set in config");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Track analytics for usage
    await recordAnalytics("gemini_query", { user: userEmail });

    return data;
  } catch (err: any) {
    logError("[geminiService] AI Query failed", { error: err.message });
    throw err;
  }
}

/**
 * Get basic usage stats for a user (placeholder)
 */
export async function getGeminiUsageStats(email: string) {
  // TODO: Integrate real token usage if Gemini API provides
  return { user: email, tokensUsed: 0, limit: 5000 };
}
