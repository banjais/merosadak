// backend/src/services/websocketService.ts
// Note: Build warning about "WebSocketServer never used" is a false positive
// WebSocketServer IS used in initializeWebSocket() function below
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { logInfo, logError } from "../logs/logs.js";

/**
 * 🫀 Heartbeat WebSocket
 */
interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean;
}

/**
 * Global WS server reference & client set
 */
let wss: WebSocketServer | null = null;
const clients = new Set<HeartbeatWebSocket>();

/**
 * 💓 Setup heartbeat for a WS client
 */
const setupHeartbeat = (ws: HeartbeatWebSocket) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      clients.delete(ws);
      return;
    }

    if (!ws.isAlive) {
      logInfo("[WS] Terminating stale client");
      ws.terminate();
      clearInterval(interval);
      clients.delete(ws);
      return;
    }

    ws.isAlive = false;
    ws.ping();
  }, 25_000); // safe heartbeat interval

  ws.on("close", () => {
    clearInterval(interval);
    clients.delete(ws);
  });
};

/**
 * 🚀 Initialize WebSocket server
 */
export const initializeWebSocket = (server: HttpServer) => {
  if (wss) return;

  wss = new WebSocketServer({
    server,
    path: "/ws/live",
    perMessageDeflate: false,
  });

  wss.on("connection", (ws: WebSocket) => {
    const client = ws as HeartbeatWebSocket;
    clients.add(client);
    setupHeartbeat(client);

    logInfo(`[WS] Client connected (${clients.size})`);

    ws.on("error", (err) => {
      logError("[WS] Client error", { error: err.message });
      clients.delete(client);
    });

    // Send optional initial snapshot
    ws.send(
      JSON.stringify({
        type: "system",
        message: "MeroSadak live connection established",
        timestamp: new Date().toISOString(),
        level: "info",
      })
    );
  });

  logInfo("🔌 WebSocket initialized at /ws/live");
};

/**
 * 📡 Broadcast helper (safe JSON)
 */
const broadcast = (payload: any) => {
  if (!wss || clients.size === 0) return;

  let data: string;
  try {
    data = JSON.stringify(payload);
  } catch {
    logError("[WS] Failed to serialize payload", { payload });
    return;
  }

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      clients.delete(ws);
    }
  }
};

/**
 * 🗺️ Segment-specific map update
 */
export const broadcastMapUpdateSegment = (
  dataType: "roads" | "traffic" | "weather" | "pois" | "alerts",
  segmentIds: number[] = []
) => {
  broadcast({
    type: "data_update",
    dataType,
    segments: segmentIds,
    message: `Updated ${dataType} data`,
    timestamp: new Date().toISOString(),
    level: "info",
  });
};

/**
 * 🌍 Global map update
 */
export const broadcastMapUpdate = (
  dataType: "roads" | "traffic" | "weather" | "pois" | "alerts" | "waze"
) => {
  broadcast({
    type: "data_update",
    dataType,
    message: `New ${dataType} data available`,
    timestamp: new Date().toISOString(),
    level: "info",
  });
};

/**
 * ⏳ Background job progress
 */
export const broadcastProgress = (message: string, progress: number) => {
  broadcast({
    type: "progress",
    message,
    progress: Math.max(0, Math.min(100, progress)),
    timestamp: new Date().toISOString(),
    level: "info",
  });
};

/**
 * 🧾 Live logs (admin dashboard)
 */
export const broadcastLiveLog = (log: {
  type: string;
  message: string;
  level: "info" | "warn" | "error";
  meta?: any;
}) => {
  broadcast({
    ...log,
    isLiveLog: true,
    timestamp: new Date().toISOString(),
  });
};

/**
 * 📊 Get WebSocket stats (diagnostics)
 */
export const getWebSocketStats = () => ({
  connectedClients: clients.size,
  initialized: !!wss,
});

/**
 * 🛑 Graceful shutdown
 */
export const shutdownWebSocket = () => {
  if (!wss) return;

  logInfo("[WS] Shutting down WebSocket server");
  for (const ws of clients) {
    try {
      ws.close();
    } catch { }
  }

  clients.clear();
  wss.close();
  wss = null;
};
