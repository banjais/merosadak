export const generateAutonomousUI = (predictions: any[]) => {
  const critical = predictions.filter(p => p.riskLevel === "critical");

  if (critical.length > 0) {
    return {
      type: "SCREEN",
      theme: "dark",
      layout: [
        {
          type: "alertBanner",
          props: {
            text: "🚨 CRITICAL ROAD RISK DETECTED",
            color: "red",
          },
        },
        {
          type: "button",
          props: {
            text: "Auto-Reroute Now",
            action: "reroute",
          },
        },
      ],
    };
  }

  return null;
};