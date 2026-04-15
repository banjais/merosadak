import { apiFetch } from "../api";

export class PolicyExecutionEngine {

  async execute(action: any) {
    // 1. Push notification to users
    await this.pushAlert(action);

    // 2. Update UI state globally
    window.dispatchEvent(
      new CustomEvent("GOVERNMENT_ACTION", { detail: action })
    );

    // 3. API sync with backend
    try {
      await apiFetch("/government/log", {
        method: "POST",
        body: JSON.stringify(action),
      });
    } catch (err) {
      console.warn("[PolicyExecutionEngine] Failed to log action to backend:", err);
    }

    console.log("⚡ EXECUTED:", action);
  }

  async pushAlert(action: any) {
    if ("Notification" in window) {
      new Notification("🚨 Traffic Update", {
        body: `${action.road}: ${action.message}`,
      });
    }
  }
}

export const policyExecutionEngine = new PolicyExecutionEngine();