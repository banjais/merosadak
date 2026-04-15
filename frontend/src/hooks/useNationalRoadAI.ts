import { useEffect, useState } from "react";
import { nationalRiskAI } from "../services/nationalRiskAI";
import { trafficPolicyAI } from "../services/trafficPolicyAI";

export const useNationalRoadAI = (roads: any[]) => {
  const [output, setOutput] = useState<any[]>([]);

  useEffect(() => {
    const result = roads.map((r) => {
      const score = nationalRiskAI.calculateRisk(r);
      const risk = nationalRiskAI.classify(score);
      const actions = trafficPolicyAI.suggestAction(risk);

      return {
        ...r,
        score,
        risk,
        actions,
      };
    });

    setOutput(result);
  }, [roads]);

  return output;
};