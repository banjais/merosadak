import { LivePatchEngine } from "./livePatchEngine";

export const startLivePatchSocket = () => {
  const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:4000");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "PATCH") {
        LivePatchEngine.applyPatch(data);
      }

      if (data.type === "PATCH_BATCH") {
        LivePatchEngine.applyBatch(data.patches);
      }
    } catch (e) {
      console.warn("Patch parse error", e);
    }
  };

  return ws;
};