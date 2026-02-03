import { GoogleGenAI } from "@google/genai";
import { TravelIncident } from "../types";

/**
 * 🔑 API KEY INITIALIZATION
 * Vite requires 'VITE_' prefix to expose variables to the browser.
 * Ensure your .env file has: VITE_GEMINI_API_KEY=your_actual_key
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error(
    "❌ Gemini API Key is missing! \n" +
    "1. Check that your .env file is in the root /frontend folder.\n" +
    "2. Ensure the key name is VITE_GEMINI_API_KEY.\n" +
    "3. Restart your dev server (npm run dev)."
  );
}

// Initialize the SDK with the key. 
// We pass an empty string fallback to prevent the constructor from crashing immediately.
const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

/**
 * Provides travel advice based on user query and current incidents in Nepal.
 */
export async function getTravelAdvice(
  query: string, 
  location: { lat: number, lng: number }, 
  incidents: TravelIncident[]
) {
  // Use 'gemini-3-flash-preview' for fast, efficient text responses
  const model = 'gemini-3-flash-preview';
  
  const incidentContext = incidents.length > 0 
    ? incidents.map(i => `- ${i.type}: ${i.title} (${i.description})`).join('\n')
    : "No major incidents reported currently.";
  
  const systemPrompt = `
    You are 'SadakSathi', the Nepal Road Travel Companion AI.
    Mission: Provide concise, helpful travel info exclusively for Nepal.
    
    Current User Location: Lat ${location.lat}, Lng ${location.lng}
    Current Known Incidents in Nepal:
    ${incidentContext}
    
    Rules:
    1. Emotional Intelligence (EQ): Analyze the user's tone. If they seem angry, frustrated, or stressed (e.g., due to delays), be empathetic, soothing, and apologetic. If they are happy or excited, be enthusiastic. If they are in a hurry, stay extremely brief.
    2. Focus: Only provide information about Nepal. If asked about other places, stay focused on Nepal.
    3. Context: Focus on road conditions, monsoon safety, and safe routes.
    4. Mobile Optimization: Keep responses under 150 words.
    5. Tone: Professional yet deeply human and empathetic.
  `;

  try {
    const result = await ai.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });
    
    return result; // Return the stream object
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    throw error;
  }
}

/**
 * Summarizes a specific incident for quick driver reading.
 */
export async function summarizeIncident(incident: TravelIncident) {
  const model = 'gemini-3-flash-preview';
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ 
        role: 'user', 
        parts: [{ text: `Summarize this for a driver: ${incident.title} - ${incident.description}` }] 
      }],
      config: {
        systemInstruction: "One sentence max. Focus on impact on travel time.",
      }
    });
    return result.text;
  } catch {
    return incident.description;
  }
}