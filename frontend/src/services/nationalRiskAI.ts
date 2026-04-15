export class NationalRiskAI {
  calculateRisk(road: any) {
    let score = 0;

    if (road.weather === "storm") score += 40;
    if (road.traffic === "high") score += 25;
    if (road.incidents > 2) score += 35;
    if (road.landslideZone) score += 30;

    return Math.min(100, score);
  }

  classify(score: number) {
    if (score > 80) return "CRITICAL";
    if (score > 60) return "HIGH";
    if (score > 30) return "MEDIUM";
    return "LOW";
  }
}

export const nationalRiskAI = new NationalRiskAI();