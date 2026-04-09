// backend/src/services/voiceReportService.ts
import { logInfo, logError } from "../logs/logs.js";

// ────────────────────────────────
// Voice-Based Incident Reporting Service
// Speech-to-text for hands-free reporting (driver safety)
// ────────────────────────────────

interface Location {
  lat: number;
  lng: number;
}

interface VoiceReport {
  id: string;
  userId: string;
  audioTranscript: string;
  extractedData: {
    incidentType: string;
    location?: Location;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number; // 0-1
  };
  timestamp: string;
  language: string;
  status: "pending" | "processed" | "verified" | "rejected";
}

/**
 * Process voice report transcript
 * Uses AI to extract structured data from natural language
 */
export async function processVoiceReport(
  transcript: string,
  language: string = "en",
  location?: Location
): Promise<VoiceReport | null> {
  try {
    const lowerTranscript = transcript.toLowerCase();

    // Extract incident type from transcript
    let incidentType = "other";
    if (lowerTranscript.includes("block") || lowerTranscript.includes("landslide") || lowerTranscript.includes("closed")) {
      incidentType = "blockage";
    } else if (lowerTranscript.includes("accident") || lowerTranscript.includes("crash")) {
      incidentType = "accident";
    } else if (lowerTranscript.includes("traffic") || lowerTranscript.includes("congestion")) {
      incidentType = "traffic";
    } else if (lowerTranscript.includes("construction") || lowerTranscript.includes("repair")) {
      incidentType = "construction";
    } else if (lowerTranscript.includes("flood") || lowerTranscript.includes("water")) {
      incidentType = "weather";
    }

    // Extract severity
    let severity: "low" | "medium" | "high" | "critical" = "medium";
    if (lowerTranscript.includes("critical") || lowerTranscript.includes("severe") || lowerTranscript.includes("dangerous")) {
      severity = "critical";
    } else if (lowerTranscript.includes("bad") || lowerTranscript.includes("worse") || lowerTranscript.includes("heavy")) {
      severity = "high";
    } else if (lowerTranscript.includes("minor") || lowerTranscript.includes("slight")) {
      severity = "low";
    }

    // Confidence based on clarity of transcript
    const wordCount = transcript.split(" ").length;
    const confidence = Math.min(1, wordCount / 10) * 0.8;

    const report: VoiceReport = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: "anonymous",
      audioTranscript: transcript,
      extractedData: {
        incidentType,
        location,
        description: transcript,
        severity,
        confidence: Math.round(confidence * 100) / 100,
      },
      timestamp: new Date().toISOString(),
      language,
      status: "pending",
    };

    logInfo("[VoiceReport] Processed voice report", {
      id: report.id,
      incidentType,
      severity,
      confidence: report.extractedData.confidence,
    });

    return report;
  } catch (err: any) {
    logError("[VoiceReport] Failed to process voice report", err.message);
    return null;
  }
}

/**
 * Generate voice-friendly response
 * Short, clear responses suitable for text-to-speech
 */
export function generateVoiceResponse(
  incidentType: string,
  severity: string,
  location?: string
): string {
  const responses = {
    blockage: {
      low: "Road partially blocked. Proceed with caution.",
      medium: "Road is blocked. Expect delays.",
      high: "Road completely blocked. Find alternative route.",
      critical: "Critical blockage. Do not attempt to pass.",
    },
    accident: {
      low: "Minor accident reported. Drive carefully.",
      medium: "Accident on road. Expect slowdown.",
      high: "Major accident. Avoid area.",
      critical: "Serious accident. Emergency services dispatched.",
    },
    traffic: {
      low: "Light traffic. Normal delays.",
      medium: "Moderate traffic. Expect some delays.",
      high: "Heavy traffic. Significant delays expected.",
      critical: "Severe congestion. Consider alternate route.",
    },
    construction: {
      low: "Minor road work. Slight delays.",
      medium: "Construction in progress. Expect delays.",
      high: "Major construction. One lane traffic.",
      critical: "Road closed for construction. Detour required.",
    },
    weather: {
      low: "Minor weather advisory. Drive safely.",
      medium: "Weather hazard reported. Use caution.",
      high: "Severe weather. Road conditions poor.",
      critical: "Dangerous weather. Avoid travel.",
    },
    other: {
      low: "Minor incident reported.",
      medium: "Incident on road. Be alert.",
      high: "Significant hazard reported.",
      critical: "Critical situation. Exercise extreme caution.",
    },
  };

  const typeResponses = responses[incidentType as keyof typeof responses] || responses.other;
  const message = typeResponses[severity as keyof typeof typeResponses] || typeResponses.medium;

  return location ? `${message} Near ${location}.` : message;
}

/**
 * Validate voice report quality
 */
export function validateVoiceReport(report: VoiceReport): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check transcript length
  if (report.audioTranscript.length < 10) {
    issues.push("Transcript too short - may be inaccurate");
  }

  // Check confidence
  if (report.extractedData.confidence < 0.5) {
    issues.push("Low confidence in interpretation");
    recommendations.push("Please confirm details manually");
  }

  // Check location
  if (!report.extractedData.location) {
    recommendations.push("Location not provided - accuracy may be reduced");
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Get voice commands help
 */
export function getVoiceCommandsHelp(): {
  incidentTypes: string[];
  severityLevels: string[];
  examplePhrases: string[];
} {
  return {
    incidentTypes: [
      "blockage",
      "accident",
      "traffic",
      "construction",
      "weather",
      "other",
    ],
    severityLevels: [
      "minor",
      "moderate",
      "bad",
      "severe",
      "critical",
    ],
    examplePhrases: [
      "Road is blocked by landslide near Mugling",
      "Major accident on highway, heavy traffic",
      "Construction work, one lane open",
      "Flooding on road, very dangerous",
      "Minor accident, slight delay expected",
    ],
  };
}
