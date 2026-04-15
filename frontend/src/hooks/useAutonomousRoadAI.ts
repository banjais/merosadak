import { useEffect, useState } from "react";
import { AutonomousRoadAI, RoadSignal, Prediction } from "../services/autonomousRoadAI";

export const useAutonomousRoadAI = (signals: RoadSignal[]) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    const results = signals.map((s) => AutonomousRoadAI.predict(s));
    setPredictions(results);
  }, [signals]);

  return predictions;
};