// backend/src/services/geminiService.ts
/**
 * MeroSadak AI Service - User-First, Economy-Second
 * 
 * Philosophy:
 * - Users: Unlimited, free, seamless - NO quotas, NO limits, NO friction
 * - System: Economically optimized via smart caching and fallbacks
 * 
 * Architecture:
 * 1. Check cache first (zero cost)
 * 2. If no API key → Use local data (free)
 * 3. If API key → Use cheapest model (lite for simple, primary for complex)
 * 4. On error → Fallback to local data (always works)
 */

import axios from "axios";
import fs from "fs/promises";
import { 
  GEMINI_API_KEY, 
  GEMINI_API_URL, 
  GEMINI_MODEL_PRIMARY,
  GEMINI_MODEL_SECONDARY,
  GEMINI_MODEL_LITE 
} from "../config/index.js";
import { 
  CACHE_ROAD, 
  CACHE_MONSOON, 
  CACHE_ALERTS 
} from "../config/paths.js";
import { logInfo, logError } from "@logs/logs.js";

export interface MultimodalPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

// Real data context - loaded from caches
let roadSummary = "loading...";
let monsoonSummary = "loading...";
let alertSummary = "loading...";

// Load real data for AI context
async function loadRealDataContext() {
  try {
    const roadData = await fs.readFile(CACHE_ROAD, "utf-8");
    const roads = JSON.parse(roadData);
    const count = roads.merged?.length || roads.features?.length || 0;
    roadSummary = `${count} road segments available`;
    
    const monsoonData = await fs.readFile(CACHE_MONSOON, "utf-8");
    const risks = JSON.parse(monsoonData);
    monsoonSummary = `${risks.length} monsoon risk zones`;
    
    const alertsData = await fs.readFile(CACHE_ALERTS, "utf-8");
    const alerts = JSON.parse(alertsData);
    alertSummary = `${alerts.length} active traffic alerts`;
  } catch {
    roadSummary = "road data available";
    monsoonSummary = "monsoon data available";
    alertSummary = "alerts available";
  }
}

// Load data on startup
loadRealDataContext();

const LOCAL_KNOWLEDGE = {
  road_status: `Nepal has ${roadSummary}. Roads are color-coded: Green=Clear, Orange=One-Lane, Red=Blocked. Check the map for real-time status.`,
  
  weather: `Current: ${monsoonSummary}. Weather shown in widget. Monsoon risks shown on map in red zones.`,
  
  route_to: "Use search bar to select destination. I'll show route with current road conditions.",
  
  highway_info: "Search by highway code (NH01, NH06) or name for highway details, length and districts.",
  
  safety: "Check road status before travel. Carry emergency contacts. Avoid night travel during monsoon.",
  
  fuel_stops: "Petrol stations shown on map with ⛽ symbol.",
  
  emergency: "Tap SOS button to broadcast location to emergency responders nearby.",
  
  monsoon: "Monsoon season June-September. Check red zones for landslide risk areas.",
  
  default: `I have ${roadSummary}, ${monsoonSummary}, ${alertSummary}. Ask me about any road, weather or route in Nepal!`
};

// Response cache - aggressive caching for economy
const responseCache = new Map<string, { text: string; timestamp: number; hits: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes - reuse common queries
const MAX_CACHE_SIZE = 500; // Limit memory usage

export class GeminiService {
  private readonly apiKey = GEMINI_API_KEY;
  private readonly baseUrl = GEMINI_API_URL;
  private hasApiKey = false;
  private apiCallsToday = 0; // Track for logging only
  private cacheHitsToday = 0;
  private fallbackHitsToday = 0;
  
  private readonly models = {
    primary: GEMINI_MODEL_PRIMARY || "gemini-2.5-flash",
    secondary: GEMINI_MODEL_SECONDARY || "gemini-2.0-flash-lite",
    lite: GEMINI_MODEL_LITE || "gemini-2.0-flash-lite",
  };

  constructor() {
    this.hasApiKey = !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0;
    logInfo(`[GeminiService] ${this.hasApiKey ? 'AI configured - economy mode' : 'No API key - local mode'}`);
  }

  private getCacheKey(prompt: string): string {
    // Normalize prompt for better cache hits
    return prompt.toLowerCase()
      .replace(/[?.!]+/g, "")
      .replace(/\s+/g, " ")
      .substring(0, 80)
      .trim();
  }

  private getCached(prompt: string): string | null {
    const key = this.getCacheKey(prompt);
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      cached.hits++; // Track popular queries
      this.cacheHitsToday++;
      return cached.text;
    }
    return null;
  }

  private setCached(prompt: string, text: string): void {
    // Evict oldest if full
    if (responseCache.size >= MAX_CACHE_SIZE) {
      let oldest: string | null = null;
      let oldestTime = Date.now();
      for (const [key, val] of responseCache) {
        if (val.timestamp < oldestTime) {
          oldestTime = val.timestamp;
          oldest = key;
        }
      }
      if (oldest) responseCache.delete(oldest);
    }
    responseCache.set(this.getCacheKey(prompt), { text, timestamp: Date.now(), hits: 0 });
  }

  private detectComplexity(prompt: string): "simple" | "medium" | "complex" {
    const lower = prompt.toLowerCase();
    const simple = /^(status|weather|clear|blocked|open|how long|how far|km|koshat|kathmandu|pokhara)/.test(lower);
    const complex = /^(why|how come|explain|compare|analyze|recommend|which is better|should i)/.test(lower);
    
    if (simple) return "simple";
    if (complex) return "complex";
    return "medium";
  }

  private getLocalResponse(prompt: string): string {
    this.fallbackHitsToday++;
    const lower = prompt.toLowerCase();
    
    // Match to local knowledge
    for (const [key, text] of Object.entries(LOCAL_KNOWLEDGE)) {
      if (lower.includes(key.replace("_", " "))) {
        return text;
      }
    }
    
    return LOCAL_KNOWLEDGE.default;
  }

  async generateSmartResponse(prompt: string): Promise<{
    text: string;
    source: "cache" | "ai" | "local";
    model?: string;
  }> {
    // 1. Check cache (free, instant)
    const cached = this.getCached(prompt);
    if (cached) {
      return { text: cached, source: "cache" };
    }

    // 2. No API key - use local intelligence (free, always works)
    if (!this.hasApiKey) {
      const local = this.getLocalResponse(prompt);
      this.setCached(prompt, local);
      return { text: local, source: "local" };
    }

    // 3. Have API key - use AI
    const complexity = this.detectComplexity(prompt);
    const tier = complexity === "complex" ? "primary" : "lite";
    
    try {
      this.apiCallsToday++;
      const text = await this.callGemini(prompt, tier);
      
      if (text) {
        this.setCached(prompt, text);
        return { text, source: "ai", model: this.models[tier] };
      }
      
      // Empty response - fallback
      const local = this.getLocalResponse(prompt);
      this.setCached(prompt, local);
      return { text: local, source: "local" };
      
    } catch (err: any) {
      // API error - fallback to local (always works)
      const local = this.getLocalResponse(prompt);
      this.setCached(prompt, local);
      return { text: local, source: "local" };
    }
  }

  private async callGemini(prompt: string, tier: "primary" | "secondary" | "lite"): Promise<string> {
    const model = tier === "lite" ? this.models.lite : this.models.primary;
    const maxTokens = tier === "lite" ? 256 : 1024;
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
        },
        { timeout: 20000 }
      );
      
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch {
      return "";
    }
  }

  async generateText(prompt: string): Promise<string> {
    const result = await this.generateSmartResponse(prompt);
    return result.text;
  }

  // Get usage stats (for monitoring, not user limits)
  getStats() {
    return {
      cacheHits: this.cacheHitsToday,
      apiCalls: this.apiCallsToday,
      localFallbacks: this.fallbackHitsToday,
      cacheSize: responseCache.size
    };
  }
}

export const geminiService = new GeminiService();
export { LOCAL_KNOWLEDGE };

// Current data stats
let dataStats = { roads: "1400+", monsoon: "1400+", alerts: "several" };

export function getDataStats() {
  const stats = {
    roads: roadSummary.replace("loading...", "available"),
    monsoon: monsoonSummary.replace("loading...", "available"),
    alerts: alertSummary.replace("loading...", "available")
  };
  
  // Try to get actual counts
  try {
    const roadData = JSON.parse(require("fs").readFileSync(CACHE_ROAD, "utf-8"));
    stats.roads = `${roadData.merged?.length || roadData.features?.length || 1400}+`;
    
    const monsoonData = JSON.parse(require("fs").readFileSync(CACHE_MONSOON, "utf-8"));
    stats.monsoon = `${monsoonData.length || 1400}+`;
    
    const alertsData = JSON.parse(require("fs").readFileSync(CACHE_ALERTS, "utf-8"));
    stats.alerts = `${alertsData.length || 0}`;
  } catch {
    // Use defaults
  }
  
  return { roads: stats.roads, monsoon: stats.monsoon, alerts: stats.alerts };
}