import http from "http";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";

import paths from "./config/paths.js";
import { PORT, API_PREFIX, isProd, SENTRY_DSN, WS_ENABLED } from "./config/index.js";

import { initializeSentry } from "./utils/sentry.js";
import { initializeWebSocket } from "./services/websocketService.js";
import loadGeoJSON from "./utils/loadGeoJSON.js";
import { logInfo, logError } from "./logs/logs.js";
import apiRouter from "./routes/routerIndex.js";
import { getCachedRoads } from "./services/roadService.js";
import { forceRefresh, startAutoRefresh } from "./services/schedulerService.js";

// -----------------------------
// 1️⃣ Initialize Sentry (Optional)
// -----------------------------
if (SENTRY_DSN) {
  try {
    initializeSentry();
  } catch (err: any) {
    console.warn("[Sentry] Initialization skipped:", err.message);
  }
}

// -----------------------------
// 2️⃣ Express App Setup
// -----------------------------
const app = express();

if (isProd) {
  app.use(helmet());
}

app.use(cors());

app.use(express.json());

// -----------------------------
// 3️⃣ Health Check
// -----------------------------
app.get("/health", async (_req: Request, res: Response) => {
  try {
    const roads = await getCachedRoads();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      roadCacheLoaded: roads.merged.length > 0,
      totalRoads: roads.merged.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 4️⃣ Load GeoJSON
// -----------------------------
const geoFiles = [
  { name: "Boundary", path: paths.BOUNDARY_DATA },
  { name: "Master Roads", path: paths.BASE_DATA },
];

geoFiles.forEach((file) => {
  try {
    const data = fs.existsSync(file.path) ? loadGeoJSON(file.path) : null;
    logInfo(`${file.name} loaded`, { features: data?.features?.length ?? 0 });
  } catch (err: any) {
    logError(`Failed to load ${file.name}`, { error: err.message });
  }
});

// -----------------------------
// 5️⃣ Mount API Router
// -----------------------------
app.use(`${API_PREFIX}/v1`, apiRouter);

// -----------------------------
// 6️⃣ HTTP & WebSocket
// -----------------------------
const server = http.createServer(app);

if (WS_ENABLED) {
  initializeWebSocket(server);
}

// -----------------------------
// 7️⃣ Start Server
// -----------------------------
server.listen(PORT, async () => {
  logInfo(`Backend running on port ${PORT}`);
  console.log(`🚀 Backend listening at http://localhost:${PORT}`);

  try {
    await getCachedRoads();
    logInfo("Initial roads cache loaded");
  } catch (err: any) {
    logError("Initial roads load failed", { error: err.message });
  }

  try {
    startAutoRefresh();
    logInfo("✅ Background auto-refresh enabled.");
  } catch (err: any) {
    logError("❌ Failed to start auto-refresh", { error: err.message });
  }
});

// -----------------------------
// 8️⃣ Graceful Shutdown
// -----------------------------
const shutdown = () => {
  logInfo("Shutting down server...");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
