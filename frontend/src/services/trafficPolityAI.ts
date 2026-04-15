export class TrafficPolicyAI {
  suggestAction(risk: string) {
    switch (risk) {
      case "CRITICAL":
        return [
          "CLOSE ROAD IMMEDIATELY",
          "DIVERT TRAFFIC TO ALTERNATE ROUTES",
          "DEPLOY EMERGENCY RESPONSE",
        ];

      case "HIGH":
        return [
          "RESTRICT HEAVY VEHICLES",
          "ISSUE TRAVEL WARNING",
        ];

      case "MEDIUM":
        return [
          "MONITOR CONTINUOUSLY",
          "DISPLAY CAUTION ALERTS",
        ];

      default:
        return ["NORMAL OPERATION"];
    }
  }
}

export const trafficPolicyAI = new TrafficPolicyAI();