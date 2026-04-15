import { apiFetch } from "../api";

export type AIContext = {
  weather: string;
  traffic: string;
  location: string;
  incidentLevel: string;
  userMode: "driver" | "normal";
};

export type UIScreen = {
  type: "SCREEN";
  theme: "light" | "dark";
  layout: any[];
};

class AIUIEngineClass {
  async generateUI(context: AIContext): Promise<UIScreen> {
    const res = await apiFetch<any>("/ai/ui", {
      method: "POST",
      body: JSON.stringify(context),
    });

    const data = (res as any)?.data || res;
    return data as UIScreen;
  }
}

export const AIUIEngine = new AIUIEngineClass();