import { useEffect, useState } from "react";
import { trafficGovernmentAI } from "../services/trafficGovernmentAI";
import { policyExecutionEngine } from "../services/policyExecutionEngine";

export const useTrafficGovernment = (roads: any[]) => {
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    const result = roads.map((road) => {
      const action = trafficGovernmentAI.decide(road);

      // auto execute (autonomous mode)
      if (action.priority >= 80) {
        policyExecutionEngine.execute(action);
      }

      return action;
    });

    setActions(result);
  }, [roads]);

  return actions;
};