// frontend/src/services/geminiService.ts
/**
 * MeroSadak AI Assistant - Emotion-Aware Travel Companion
 * 
 * Features:
 * - Emotion detection & empathetic responses
 * - Voice + Text input → Voice + Text output
 * - Bidirectional conversation
 * - Always works (no errors)
 */

import { apiFetch } from "../api";
import type { TravelIncident } from "../types";

type Emotion = "calm" | "stressed" | "worried" | "curious" | "urgent" | "neutral";
type VoiceGender = "male" | "female";

// TTS settings with native defaults
let ttsSettings = {
  gender: "female" as VoiceGender,
  rate: 0.9,
  pitch: 1.0,
  enabled: true
};

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  emotion?: Emotion;
}

let conversationState = {
  messages: [] as ConversationMessage[],
  location: null as { lat: number; lng: number } | null,
  incidents: [] as TravelIncident[],
  isActive: false,
  userEmotion: "neutral" as Emotion
};

// Cached voices
let cachedVoices: SpeechSynthesisVoice[] = [];

// Load voices properly
function loadVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length > 0) return cachedVoices;
  
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
    return voices;
  }
  
  // Try loading after a delay (Chrome issue)
  return [];
}

// Get native voice for language
function findBestVoice(gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (voices.length === 0) return null;
  
  // Prioritize native Nepal/India English or Hindi voices
  const npVoices = [
    "en-IN", "hi-IN", "en-NP", // Native
    "Google US English", "Google UK English" // Google
  ];
  
  for (const lang of npVoices) {
    const voice = voices.find(v => v.lang.startsWith(lang.split("-")[0]) || v.name.includes(lang));
    if (voice) return voice;
  }
  
  // Fallback to any English
  return voices.find(v => v.lang.startsWith("en")) || voices[0];
}

// Emotion keywords
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  stressed: ["worried", "scared", "danger", "blocked", "stuck", "help", "urgent", "emergency", "oh no", "safety", "afraid", "terrified"],
  worried: ["rain", "flood", "landslide", "monsoon", "when", "will it", "risk", "warning", "alert", "dangerous", "concern"],
  urgent: ["now", "quick", "fast", "hurry", "immediately", "asap", "running", "late", "no time"],
  curious: ["how", "what", "why", "explain", "which", "compare", "difference", "tell me", "want to know", "curious"],
  calm: ["ok", "fine", "good", "thanks", "great", "nice", "perfect", "awesome", "love"],
  neutral: []
};

function detectEmotion(query: string): Emotion {
  const lower = query.toLowerCase();
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion !== "neutral" && keywords.some(k => lower.includes(k))) {
      return emotion as Emotion;
    }
  }
  return "neutral";
}

function getEmpatheticPrefix(emotion: Emotion): string {
  const prefixes: Record<Emotion, string[]> = {
    stressed: ["stay calm ", "i understand this is stressful ", "dont worry "],
    worried: ["thats a fair concern ", "i understand your worry ", "good question "],
    urgent: ["got it ", "alright ", "quick "],
    curious: ["great question ", "happy to explain ", "good to know "],
    calm: ["sounds good ", "nice ", "perfect "],
    neutral: ["here is ", "let me check ", "here is what "]
  };
  const options = prefixes[emotion];
  return options[Math.floor(Date.now() / 1000) % options.length];
}

// Make text natural for speech - no weird pauses or machine sounds
function makeNaturalForSpeech(text: string): string {
  return text
    .replace(/[.,;:!?'"()\[\]{}]/g, " ") // Remove punctuation that sounds weird
    .replace(/\s+/g, " ")             // Normalize spaces
    .replace(/\s+\./g, "")           // No period pauses
    .replace(/  /g, " ")             // Extra spaces
    .trim();
}

const LOCAL_RESPONSES: Record<string, string> = {
  road_status: "check the map! 🟢 Clear, 🟠 One-Lane, 🔴 Blocked. Tap any road!",
  weather: "weather in the top widget. Check monsoon zones for alerts.",
  blocked: "blocked roads ahead. Check alternate routes in search!",
  fuel: "⛽ petrol stations on map.",
  hospital: "🏥 hospitals on map. Tap SOS for emergencies.",
  route: "select destination in search - I'll show the route!",
  emergency: "Stay calm! Tap SOS - I'll broadcast your location.",
  monsoon: "June-September: watch red landslide zones on map.",
  default: "ask me about roads, weather, routes!"
};

function getLocalResponse(query: string, emotion: Emotion): string {
  const lower = query.toLowerCase();
  for (const [key, response] of Object.entries(LOCAL_RESPONSES)) {
    if (lower.includes(key)) return getEmpatheticPrefix(emotion) + response;
  }
  return getEmpatheticPrefix(emotion) + LOCAL_RESPONSES.default;
}

export function getUserEmotion(): Emotion {
  return conversationState.userEmotion;
}

export function startConversation(location?: { lat: number; lng: number }, incidents: TravelIncident[] = []) {
  conversationState = {
    messages: [],
    location: location || null,
    incidents,
    isActive: true,
    userEmotion: "neutral"
  };
  
  return {
    text: "Namaste! 🏔️ I'm your Nepal travel companion. Ask me about roads, weather, routes - or just chat!",
    emotion: "calm" as Emotion
  };
}

export async function sendMessage(userInput: string, voiceInput?: string): Promise<{ text: string; emotion: Emotion; shouldSpeak: boolean }> {
  const input = userInput || voiceInput || "";
  if (!input.trim()) return { text: "", emotion: "neutral", shouldSpeak: false };

  // Detect emotion
  const emotion = detectEmotion(input);
  conversationState.userEmotion = emotion;

  // Store user message
  conversationState.messages.push({
    role: "user",
    content: input,
    timestamp: Date.now(),
    emotion
  });

  try {
    const context = conversationState.location 
      ? `Location: ${conversationState.location.lat},${conversationState.location.lng}`
      : "";
    const incidentText = conversationState.incidents.slice(0, 3).map(i => i.title).join("; ") || "none";

    const result = await apiFetch<any>("/gemini/query", {
      method: "POST",
      body: JSON.stringify({
        prompt: input,
        systemPrompt: `You are MeroSadak, Nepal's helpful travel companion. ${context}. Incidents: ${incidentText}. Detect user's emotion and respond empathetically. Be warm, helpful, concise.`,
        moodEQ: true,
        verbosity: 'detailed'
      })
    });

    const aiText = result?.response || result?.data?.response || "";
    if (aiText) {
      conversationState.messages.push({ role: "assistant", content: aiText, timestamp: Date.now() });
      return { text: aiText, emotion, shouldSpeak: true };
    }
  } catch { /* Fall through */ }

  // Local fallback with empathy
  const localText = getLocalResponse(input, emotion);
  conversationState.messages.push({ role: "assistant", content: localText, timestamp: Date.now() });
  return { text: localText, emotion, shouldSpeak: true };
}

export async function getQuickAdvice(query: string): Promise<string> {
  const emotion = detectEmotion(query);
  try {
    const result = await apiFetch<any>("/gemini/query", {
      method: "POST",
      body: JSON.stringify({ prompt: query, verbosity: 'brief' })
    });
    return result?.response || result?.data?.response || getLocalResponse(query, emotion);
  } catch {
    return getLocalResponse(query, emotion);
  }
}

export async function summarizeIncident(incident: TravelIncident): Promise<string> {
  try {
    const result = await apiFetch<any>("/gemini/query", {
      method: "POST",
      body: JSON.stringify({ prompt: `Summarize for driver: ${incident.title} - ${incident.description}`, verbosity: 'brief' })
    });
    return result?.response || result?.data?.response || incident.description;
  } catch {
    return incident.description;
  }
}

export function endConversation(): { text: string; shouldSpeak: boolean } {
  conversationState.isActive = false;
  return { text: "Safe travels! Come back anytime. 🙏", shouldSpeak: true };
}

export function getConversationHistory(): ConversationMessage[] {
  return conversationState.messages;
}

export function getTTSSettings() {
  return ttsSettings;
}

export function setVoiceGender(gender: VoiceGender) {
  ttsSettings.gender = gender;
}

export function setTTSEnabled(enabled: boolean) {
  ttsSettings.enabled = enabled;
}

export function getVoicesList(): { name: string; lang: string; gender: VoiceGender }[] {
  const voices = loadVoices();
  return voices.map(v => ({
    name: v.name,
    lang: v.lang,
    gender: v.name.toLowerCase().includes("male") ? "male" : "female"
  }));
}

export function getAvailableVoices() {
  return getVoicesList();
}

export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSettings.enabled || !text) {
      resolve();
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Convert emojis for speech (some TTS can't read emojis)
    const speechText = makeSpeechFriendly(text);
    
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = ttsSettings.rate;
    utterance.pitch = ttsSettings.pitch;
    utterance.volume = 1;

    // Find best native voice
    const nativeVoice = findBestVoice(ttsSettings.gender);
    if (nativeVoice) {
      utterance.voice = nativeVoice;
      utterance.lang = nativeVoice.lang;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    speechSynthesis.speak(utterance);
  });
}

// Make text more speech-friendly, convert emojis
function makeSpeechFriendly(text: string): string {
  // Replace emojis with words
  const emoji_map: Record<string, string> = {
    "🏔️": "himalaya",
    "🟢": "",
    "🟠": "",
    "🔴": "",
    "⛽": "petrol",
    "🏥": "hospital",
    "⚠️": "warning",
    "🙏": "thank you",
    "✅": "yes",
    "❌": "no"
  };
  
  let result = text;
  for (const [emoji, word] of Object.entries(emoji_map)) {
    result = result.replace(new RegExp(emoji, "g"), word);
  }
  
  // Clean up
  return result
    .replace(/[.,;:!?'"()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stopSpeaking() {
  speechSynthesis.cancel();
}

export function getSearchSuggestions(query: string): { query: string; type: string }[] {
  const suggestions: Record<string, { query: string; type: string }[]> = {
    "": [{ query: "road status", type: "highway" }, { query: "weather", type: "weather" }, { query: "fuel", type: "fuel" }, { query: "hospitals", type: "medical" }],
    "pokhara": [{ query: "Pokhara road", type: "highway" }, { query: "Pokhara weather", type: "weather" }],
    "kathmandu": [{ query: "Ringroad", type: "highway" }, { query: "KTM weather", type: "weather" }],
    "weather": [{ query: "monsoon", type: "weather" }, { query: "rain", type: "weather" }],
    "fuel": [{ query: "petrol stations", type: "fuel" }],
    "road": [{ query: "blocked", type: "highway" }],
    "hospital": [{ query: "emergency", type: "medical" }]
  };

  const lower = query.toLowerCase();
  for (const [key, arr] of Object.entries(suggestions)) {
    if (!key || lower.includes(key) || key.includes(lower)) return arr;
  }
  return suggestions[""];
}