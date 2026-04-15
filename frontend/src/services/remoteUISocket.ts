import { RemoteUIEngine } from "./remoteUIEngine";

export const startRemoteUI = () => {
  const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:4000");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "SCREEN") {
        RemoteUIEngine.setScreen(data);
        window.dispatchEvent(new Event("REMOTE_UI_UPDATE"));
      }
    } catch (e) {
      console.warn("Remote UI error", e);
    }
  };

  return ws;
};