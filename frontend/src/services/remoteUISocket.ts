import { RemoteUIEngine } from "./remoteUIEngine";

export const startRemoteUI = () => {
  const wsUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
  const ws = new WebSocket(wsUrl);

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