export type RoadSignal = {
  highway: string;
  district: string;
  weather: "clear" | "rain" | "storm";
  incidents: number;
  traffic: "low" | "medium" | "high";
  timeOfDay: number;
};

export type Prediction = {
  highway: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  probability: number;
  reason: string[];
  predictedInMinutes: number;
};

class AutonomousRoadAIClass {
  predict(signal: RoadSignal): Prediction {
    let riskScore = 0;

    if (signal.weather === "storm") riskScore += 40;
    if (signal.weather === "rain") riskScore += 20;

    if (signal.traffic === "high") riskScore += 25;
    if (signal.traffic === "medium") riskScore += 10;

    if (signal.incidents > 2) riskScore += 30;

    if (signal.timeOfDay >= 18 || signal.timeOfDay <= 6) {
      riskScore += 10;
    }

    let riskLevel: Prediction["riskLevel"] = "low";
    if (riskScore > 80) riskLevel = "critical";
    else if (riskScore > 60) riskLevel = "high";
    else if (riskScore > 30) riskLevel = "medium";

    return {
      highway: signal.highway,
      riskLevel,
      probability: Math.min(100, riskScore),
      reason: this.explain(signal),
      predictedInMinutes: this.predictTime(riskLevel),
    };
  }

  private explain(signal: RoadSignal): string[] {
    const reasons: string[] = [];

    if (signal.weather !== "clear") reasons.push("Adverse weather detected");
    if (signal.traffic === "high") reasons.push("Heavy traffic buildup");
    if (signal.incidents > 0) reasons.push("Existing incidents nearby");
    if (signal.timeOfDay > 18) reasons.push("Low visibility (night risk)");

    return reasons;
  }

  private predictTime(level: string): number {
    switch (level) {
      case "critical": return 15;
      case "high": return 30;
      case "medium": return 90;
      default: return 240;
    }
  }
}

export const AutonomousRoadAI = new AutonomousRoadAIClass();