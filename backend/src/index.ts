import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { PORT, API_PREFIX, isProd, SENTRY_DSN, WS_ENABLED } from "./config/index.js";
import { logInfo, logError } from "./logs/logs.js";

import apiRouter from "./routes/routerIndex.js";
import { getCachedRoads } from "./services/roadService.js";
import { startAutoRefresh } from "./services/schedulerService.js";

const app = express();

app.set("trust proxy", 1);

if (isProd) app.use(helmet());

app.use(cors({
  origin: [
    "https://merosadak.web.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

/* ----------------------------- */
/* HEALTH CHECK                 */
/* ----------------------------- */

app.get("/health", async (_req, res) => {
  try {
    const roads = await getCachedRoads();

    res.json({
      status: "ok",
      totalRoads: roads.merged.length,
      memoryCache: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------------- */
/* API ROUTES                  */
/* ----------------------------- */

app.use(`${API_PREFIX}/v1`, apiRouter);

/* ----------------------------- */
/* SERVER START                */
/* ----------------------------- */

const server = http.createServer(app);

server.listen(PORT, async () => {
  logInfo(`Backend running on port ${PORT}`);

  try {
    await getCachedRoads();
    logInfo("Initial MEMORY road cache loaded");
  } catch (err: any) {
    logError("Initial load failed", err.message);
  }

  try {
    startAutoRefresh();
    logInfo("Auto refresh enabled");
  } catch (err: any) {
    logError("Auto refresh failed", err.message);
  }
});