import { useState, useCallback } from "react";
import { AIUIEngine, AIContext, UIScreen } from "../services/aiUIEngine";

export const useAIUI = () => {
  const [ui, setUI] = useState<UIScreen | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (context: AIContext) => {
    setLoading(true);

    try {
      const screen = await AIUIEngine.generateUI(context);
      setUI(screen);
    } catch (e) {
      console.error("AI UI error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { ui, generate, loading };
};