import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { logInfo, logError } from "@logs/logs";

interface HeartbeatWebSocket extends WebSocket {
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Set<HeartbeatWebSocket>();

const setupHeartbeat = (ws: HeartbeatWebSocket) => {
  ws.isAlive = true;
  
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      clearInterval(interval);
      return;
    }

    if (!ws.isAlive) {
      logInfo("[WS] Client connection stale, terminating...");
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  }, 25000); // 25s is safer for various proxy timeouts

  ws.on("close", () => {
    clearInterval(interval);
  });
};

export const initializeWebSocket = (server: HttpServer) => {
  if (wss) return;

  wss = new WebSocketServer({ server, path: "/ws/live" });

  wss.on("connection", (ws: WebSocket) => {
    const heartbeatWs = ws as HeartbeatWebSocket;
    clients.add(heartbeatWs);
    setupHeartbeat(heartbeatWs);
    logInfo(`[WS] Client connected. Total: ${clients.size}`);

    ws.on("close", () => {
      clients.delete(heartbeatWs);
      logInfo(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on("error", (err) => {
      logError("[WS] Connection error", { error: err.message });
      clients.delete(heartbeatWs);
    });

    ws.send(JSON.stringify({
      type: "system",
      message: "Sadak-Sathi Live Stream Active",
      timestamp: new Date().toISOString(),
      level: "info"
    }));
  });

  logInfo("[WS] Initialized at /ws/live");
};

/**
 * Segment-aware broadcast
 */
export const broadcastMapUpdateSegment = (
  dataType: "roads" | "traffic" | "weather" | "pois",
  segmentIds: number[] = []
) => {
  if (!wss || clients.size === 0) return;

  const payload = {
    type: "data_update",
    message: `New ${dataType} data available for ${segmentIds.length || "all"} segment(s)`,
    dataType,
    segments: segmentIds,
    timestamp: new Date().toISOString(),
    level: "info",
  };

  const data = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
    else clients.delete(ws);
  });
};

/**
 * Global map update broadcast
 */
export const broadcastMapUpdate = (dataType: string) => {
  if (!wss || clients.size === 0) return;

  const payload = {
    type: "data_update",
    message: `Fresh ${dataType} data is now available.`,
    dataType,
    timestamp: new Date().toISOString(),
    level: "info"
  };

  const data = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
};

/**
 * Broadcast progress for background workers/sync
 */
export const broadcastProgress = (message: string, progress: number) => {
  if (!wss || clients.size === 0) return;

  const payload = {
    type: "progress",
    message,
    progress, // 0-100
    timestamp: new Date().toISOString(),
    level: "info"
  };

  const data = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
};

/**
 * Broadcast live logs to superadmin dashboard listeners
 */
export const broadcastLiveLog = (logEntry: {
  type: string;
  message: string;
  level: string;
  meta?: any;
  timestamp?: string;
}) => {
  if (!wss || clients.size === 0) return;

  const payload = {
    ...logEntry,
    timestamp: logEntry.timestamp || new Date().toISOString(),
    isLiveLog: true
  };

  const data = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
};

/**
 * Clean shutdown for the WS server
 */
export const shutdownWebSocket = () => {
  if (wss) {
    logInfo("[WS] Server shutting down...");
    wss.close();
    wss = null;
  }
};
