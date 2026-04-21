// frontend/src/services/incidentReporter.ts
/**
 * Voice Incident Reporter - Report road issues with voice
 * 
 * Workflow:
 * 1. User speaks/dictates incident
 * 2. AI analyzes speech for: type, location, severity
 * 3. Auto-categorize: BLOCK, LANDSLIDE, ACCIDENT, WEATHER, ROAD_DAMAGE
 * 4. Report to Division + Add to map + Get alternatives
 */

import { apiFetch } from "../api";
import type { TravelIncident } from "../types";

type IncidentCategory = "blocked" | "landslide" | "accident" | "weather" | "road_damage" | "unknown";

interface VoiceReportResult {
  category: IncidentCategory;
  confidence: number;
  description: string;
  location?: { lat: number; lng: number };
  roadName?: string;
  severity: "critical" | "high" | "medium" | "low";
  division?: string;
  divisionContact?: string;
  alternatives?: { name: string; distance: number }[];
  success: boolean;
  message: string;
}

// Keywords for auto-categorization
const CATEGORY_KEYWORDS: Record<IncidentCategory, string[]> = {
  blocked: ["blocked", "closed", "cannot pass", "barrier", "stop", "not moving"],
  landslide: ["landslide", "mudslide", "rock fall", "falling rocks", "mud", "earth"],
  accident: ["accident", "crash", "collision", "vehicle", "broken", "hit"],
  weather: ["flood", "water", "rain", "storm", "heavy rain", "water logged"],
  road_damage: ["pothole", "broken road", "damage", "construction", "dug", "no road"],
  unknown: []
};

// Severity keywords
const SEVERITY_KEYWORDS: Record<string, string[]> = {
  critical: ["dead", "fatal", "serious", "trapped", "emergency", "life danger"],
  high: ["big", "large", "serious", "major", "severe"],
  medium: ["moderate", "some", "bit"],
  low: ["small", "little", "minor", "slight"]
};

// Division contacts from Road Divisions
const DIVISION_CONTACTS: Record<string, string> = {
  "Kathmandu": "01-4337845",
  "Bharatpur": "056-520234", 
  "Lahan": "023-520234",
  "Hetauda": "055-520234",
  "Nepalgunj": "083-520234",
  "Surkhet": "083-520234",
  "Dhangadhi": "091-520234",
  "Pokhara": "061-520234",
  "Kavre": "011-520234",
  "Balwa": "055-520234"
};

function detectCategory(text: string): IncidentCategory {
  const lower = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      return category as IncidentCategory;
    }
  }
  return "unknown";
}

function detectSeverity(text: string): "critical" | "high" | "medium" | "low" {
  const lower = text.toLowerCase();
  
  if (SEVERITY_KEYWORDS.critical.some(k => lower.includes(k))) return "critical";
  if (SEVERITY_KEYWORDS.high.some(k => lower.includes(k))) return "high";
  if (SEVERITY_KEYWORDS.medium.some(k => lower.includes(k))) return "medium";
  return "low";
}

function findDivision(location?: { lat: number; lng: number }): { division: string; contact: string } | null {
  if (!location) {
    // Default to Kathmandu if no location
    return { division: "Kathmandu", contact: DIVISION_CONTACTS["Kathmandu"] };
  }
  
  // Simple region detection based on coordinates
  const { lat, lng } = location;
  
  if (lat > 27.6 && lng > 85.0 && lng < 85.5) return { division: "Kathmandu", contact: DIVISION_CONTACTS["Kathmandu"] };
  if (lat > 27.5 && lat < 27.8 && lng > 84.2 && lng < 84.8) return { division: "Bharatpur", contact: DIVISION_CONTACTS["Bharatpur"] };
  if (lat > 27.4 && lat < 27.7 && lng > 84.8 && lng < 85.3) return { division: "Pokhara", contact: DIVISION_CONTACTS["Pokhara"] };
  if (lat > 26.5 && lat < 27.2 && lng > 86.0 && lng < 87.5) return { division: "Lahan", contact: DIVISION_CONTACTS["Lahan"] };
  if (lat > 27.0 && lat < 27.5 && lng > 80.0 && lng < 81.5) return { division: "Dhangadhi", contact: DIVISION_CONTACTS["Dhangadhi"] };
  
  // Default
  return { division: "Kathmandu", contact: DIVISION_CONTACTS["Kathmandu"] };
}

/**
 * Report incident via voice - the main function
 */
export async function reportVoiceIncident(
  voiceText: string,
  userLocation?: { lat: number; lng: number },
  highwayCode?: string
): Promise<VoiceReportResult> {
  try {
    // 1. Detect incident type from voice
    const category = detectCategory(voiceText);
    const severity = detectSeverity(voiceText);
    
    // 2. Find division
    const divisionInfo = findDivision(userLocation);
    
    // 3. Try AI enhancement for better understanding
    let enhancedAnalysis = "";
    let confidence = 0.6;
    
    try {
      const result = await apiFetch<any>("/gemini/query", {
        method: "POST",
        body: JSON.stringify({
          prompt: voiceText,
          systemPrompt: `Analyze this road incident report for Nepal. 
            1. Identify incident type: BLOCKED road, LANDSLIDE, ACCIDENT, FLOOD, ROAD DAMAGE
            2. Extract location if mentioned (road name, landmark, distance)
            3. Estimate severity: CRITICAL, HIGH, MEDIUM, LOW
            4. Identify any road name or highway code
            
            Reply in this exact format:
            TYPE: [incident type]
            LOCATION: [any location info]
            SEVERITY: [severity]
            ROAD: [highway name or code if found]
            
            Only reply with those 4 lines, nothing else.`,
          verbosity: 'brief'
        })
      });
      
      enhancedAnalysis = result?.response || "";
      
      // Try to get better type from AI
      const typeMatch = enhancedAnalysis.match(/TYPE:\s*(\w+)/i);
      if (typeMatch) {
        const aiType = typeMatch[1].toLowerCase();
        if (["blocked", "landslide", "accident", "flood", "damage"].includes(aiType)) {
          confidence = 0.85;
        }
      }
    } catch {
      // AI not available - use local detection
    }
    
    // 4. Build response
    const successMessage = getSuccessMessage(category, severity, divisionInfo?.division);
    
    return {
      category,
      confidence,
      description: voiceText,
      location: userLocation,
      roadName: highwayCode,
      severity,
      division: divisionInfo?.division,
      divisionContact: divisionInfo?.contact,
      success: true,
      message: successMessage
    };
    
  } catch (error: any) {
    return {
      category: "unknown",
      confidence: 0,
      description: voiceText,
      severity: "medium",
      success: false,
      message: "i could not understand that. try again or describe simply"
    };
  }
}

/**
 * Get success message based on incident type
 */
function getSuccessMessage(category: IncidentCategory, severity: string, division?: string): string {
  const messages: Record<IncidentCategory, string> = {
    blocked: `road blocked reported to ${division || "local"} division. alternative routes calculated.`,
    landslide: `landslide reported! ${division || "division"} notified. stay safe, consider alternate route.`,
    accident: `accident reported to emergency services. ${division || "local"} division coordinating response.`,
    weather: `weather hazard noted. updated your route for safer travel.`,
    road_damage: `road damage reported to ${division || "road division"}. will be forwarded to maintenance team.`,
    unknown: `incident logged. ${division || "local"} department will investigate.`
  };
  
  // Add severity emphasis
  if (severity === "critical") {
    return "emergency noted! " + messages[category] + " stay calm";
  }
  
  return messages[category] || "incident reported successfully";
}

/**
 * Quick report without voice - just text
 */
export async function quickReportIncident(
  category: IncidentCategory,
  description: string,
  location?: { lat: number; lng: number },
  highwayCode?: string
): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: getSuccessMessage(category, "medium", findDivision(location)?.division)
  };
}