export type RoadState = {
  name: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  traffic: "low" | "medium" | "high";
  incidents: number;
  weather: string;
};

export type GovernmentAction = {
  road: string;
  decision:
    | "OPEN"
    | "MONITOR"
    | "RESTRICT"
    | "CLOSE"
    | "EMERGENCY_DIVERT";
  message: string;
  priority: number;
};

export class TrafficGovernmentAI {

  decide(road: RoadState): GovernmentAction {
    if (road.risk === "CRITICAL") {
      return {
        road: road.name,
        decision: "CLOSE",
        message: "Road closed due to critical risk conditions",
        priority: 100,
      };
    }

    if (road.risk === "HIGH" && road.traffic === "high") {
      return {
        road: road.name,
        decision: "RESTRICT",
        message: "Heavy vehicle restriction applied",
        priority: 80,
      };
    }

    if (road.risk === "MEDIUM") {
      return {
        road: road.name,
        decision: "MONITOR",
        message: "Increased monitoring active",
        priority: 50,
      };
    }

    return {
      road: road.name,
      decision: "OPEN",
      message: "Normal operation",
      priority: 10,
    };
  }
}

export const trafficGovernmentAI = new TrafficGovernmentAI();