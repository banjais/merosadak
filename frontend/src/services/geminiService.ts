// frontend/src/services/geminiService.ts
/**
 * Gemini AI service — ALL calls go through backend proxy.
 * The API key is stored securely server-side (GEMINI_API_KEY env var).
 * Frontend no longer needs VITE_GEMINI_API_KEY.
 */

import { apiFetch } from "../api";
import type { TravelIncident } from "../types";

/**
 * Provides travel advice based on user query and current incidents in Nepal.
 */
export async function getTravelAdvice(
  query: string,
  location: { lat: number; lng: number },
  incidents: TravelIncident[],
  persona: string = 'safety',
  _image?: string
) {
  const incidentContext =
    (incidents || []).length > 0
      ? (incidents || []).map((i) => `- ${i.type}: ${i.title} (${i.description})`).join("\n")
      : "No major incidents reported currently.";

  const personaInstructions =
    persona === 'expert' ? "Expert Navigator Mode: Provide detailed routing advice, fuel-efficient paths, and topographic warnings for Nepal's terrain." :
      persona === 'brief' ? "Brief Assistant Mode: High-speed delivery. One sentence max per point. Focus only on essential coordinates and status." :
        "Safety First Mode: Prioritize landslide, monsoon, and construction warnings. Use empathetic tone for stressed drivers.";

  const systemPrompt = `
You are 'MeroSadak', the Nepal Road Travel Companion AI.
${personaInstructions}

Emotion Detection: Mirror the driver's current vibe (e.g., if asking about danger, be calm and reassuring. If asking about food, be enthusiastic).

Current User Location: Lat ${location.lat}, Lng ${location.lng}
Current Known Incidents in Nepal:
${incidentContext}

General Rules:
1. Emotional Intelligence (EQ): Be empathetic and professional.
2. Focus: Only Nepal travel info.
3. Multimodal Analysis: If the user provides an image, analyze it for road impact.
4. Voice Optimization: Short, readable sentences (suitable for TTS).
`;

  const result = await apiFetch<any>("/gemini/query", {
    method: "POST",
    body: JSON.stringify({
      prompt: query || "What's the road situation?",
      systemPrompt,
      mode: persona === 'expert' ? 'pro' : 'safe',
      verbosity: persona === 'brief' ? 'brief' : 'detailed',
      moodEQ: true
    })
  });

  // Return an object compatible with streaming consumer
  return {
    text: result?.response || result?.data?.response || "No response from AI.",
    stream: false
  };
}

/**
 * Summarizes a specific incident for quick driver reading.
 */
export async function summarizeIncident(incident: TravelIncident) {
  const result = await apiFetch<any>("/gemini/query", {
    method: "POST",
    body: JSON.stringify({
      prompt: `Summarize this for a driver: ${incident.title} - ${incident.description}`,
      systemPrompt: "One sentence max. Focus on travel impact.",
      verbosity: 'brief',
      moodEQ: false
    })
  });

  return result?.response || result?.data?.response || incident.description;
}
