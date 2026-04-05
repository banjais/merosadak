// frontend/src/services/geminiService.ts
import type { TravelIncident } from "../types";

/**
 * 🔑 API KEY
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error(
    "❌ Gemini API Key is missing! Check .env for VITE_GEMINI_API_KEY and restart dev server."
  );
}

/**
 * Lazy-load Gemini SDK in browser
 */
async function getAiClient() {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: API_KEY || "" });
}

/**
 * Provides travel advice based on user query and current incidents in Nepal.
 */
export async function getTravelAdvice(
  query: string,
  location: { lat: number; lng: number },
  incidents: TravelIncident[],
  persona: string = 'safety',
  image?: string
) {
  const ai = await getAiClient(); // lazy-loaded

  const personaInstructions = 
    persona === 'expert' ? "Expert Navigator Mode: Provide detailed routing advice, fuel-efficient paths, and topographic warnings for Nepal's terrain." :
    persona === 'brief' ? "Brief Assistant Mode: High-speed delivery. One sentence max per point. Focus only on essential coordinates and status." :
    "Safety First Mode: Prioritize landslide, monsoon, and construction warnings. Use empathetic tone for stressed drivers.";

  const incidentContext =
    (incidents || []).length > 0
      ? (incidents || []).map((i) => `- ${i.type}: ${i.title} (${i.description})`).join("\n")
      : "No major incidents reported currently.";

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

  try {
    const contents: any[] = [{ role: "user", parts: [{ text: query || "What's in this image?" }] }];
    
    // Add image for Multimodal analysis
    if (image) {
      const base64Data = image.split(',')[1];
      contents[0].parts.push({
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      });
    }

    const result = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });

    return result;
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    throw error;
  }
}

/**
 * Summarizes a specific incident for quick driver reading.
 */
export async function summarizeIncident(incident: TravelIncident) {
  const ai = await getAiClient();

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Summarize this for a driver: ${incident.title} - ${incident.description}` },
          ],
        },
      ],
      config: { systemInstruction: "One sentence max. Focus on travel impact." },
    });

    return result.text;
  } catch {
    return incident.description;
  }
}
