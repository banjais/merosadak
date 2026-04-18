import { LivePatchEngine } from "./livePatchEngine";

export const startLivePatchSocket = () => {
  const wsUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
  const ws = new WebSocket(wsUrl);

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