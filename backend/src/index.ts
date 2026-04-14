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
import { generalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler, initializeGlobalErrorHandlers } from "./middleware/errorHandler.js";
import { initializeWebPush } from "./services/pushService.js";
import { initializeProfiles } from "./services/userProfileService.js";
import { initializeAnalytics } from "./services/analyticsService.js";

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

// Fix for redirect loops - ensure proper handling
app.set("trust proxy", 1);

// Security headers
if (isProd) {
  app.use(helmet());
}

// CORS configuration
app.use(cors({
  origin: ['https://merosadak.web.app', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all routes
app.use(generalLimiter);

// Root endpoint for testing
app.get("/", (_req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    message: "Mero Sadak API is running",
    timestamp: new Date().toISOString()
  });
});

// -----------------------------
// 3️⃣ Health Checks
// -----------------------------

// Basic health check (for load balancers)
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

// Liveness probe - is the server alive?
app.get("/health/live", (_req: Request, res: Response) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

// Readiness probe - is the server ready to serve traffic?
app.get("/health/ready", async (_req: Request, res: Response) => {
  try {
    // Check if critical services are initialized
    const roads = await getCachedRoads();
    const isReady = roads.merged.length > 0;

    if (!isReady) {
      return res.status(503).json({
        status: "not_ready",
        message: "Road cache not yet initialized",
        checks: {
          roadCache: false,
        },
      });
    }

    res.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      checks: {
        roadCache: true,
        totalRoads: roads.merged.length,
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: "not_ready",
      message: "Health check failed",
      error: err.message,
    });
  }
});

// Detailed health (existing endpoint moved to /api/v1/health/)

// -----------------------------
// 4️⃣ Boundary files info logged only if non-empty (optional)
// -----------------------------
logInfo("Boundary data paths configured", {
  districts: paths.DISTRICT_DATA,
  provinces: paths.PROVINCE_DATA,
  local: paths.LOCAL_DATA
});

// -----------------------------
// 5️⃣ Mount API Router
// -----------------------------
app.use(`${API_PREFIX}/v1`, apiRouter);

// -----------------------------
// 6️⃣ 404 Handler
// -----------------------------
app.use(notFoundHandler);

// -----------------------------
// 7️⃣ Global Error Handler
// -----------------------------
app.use(errorHandler);

// -----------------------------
// 8️⃣ HTTP & WebSocket
// -----------------------------
const server = http.createServer(app);

if (WS_ENABLED) {
  initializeWebSocket(server);
}

// -----------------------------
// 7️⃣ Start Server
// -----------------------------
// Initialize global error handlers
initializeGlobalErrorHandlers();

server.listen(PORT, async () => {
  logInfo(`Backend running on port ${PORT}`);
  console.log(`🚀 Backend listening at http://localhost:${PORT}`);

  try {
    await getCachedRoads();
    logInfo("Initial roads cache loaded");
  } catch (err: any) {
    logError("Initial roads load failed", { error: err.message });
  }

  // Initialize new services
  try {
    await initializeWebPush();
    logInfo("✅ Web Push service initialized");
  } catch (err: any) {
    logError("Web Push init failed", { error: err.message });
  }

  try {
    await initializeProfiles();
    logInfo("✅ User Profile service initialized");
  } catch (err: any) {
    logError("User Profile init failed", { error: err.message });
  }

  try {
    await initializeAnalytics();
    logInfo("✅ Analytics service initialized");
  } catch (err: any) {
    logError("Analytics init failed", { error: err.message });
  }

  try {
    startAutoRefresh();
    logInfo("✅ Background auto-refresh enabled.");
  } catch (err: any) {
    logError("❌ Failed to start auto-refresh", { error: err.message });
  }
});

// -----------------------------
// 8️⃣ Self-Ping Keep-Warm (prevents Render free tier sleep)
// -----------------------------
if (isProd) {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const PING_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

  setInterval(async () => {
    try {
      const res = await fetch(`${SELF_URL}/health/live`);
      logInfo(`[KeepWarm] Self-ping OK — ${res.status}`);
    } catch (err: any) {
      logInfo(`[KeepWarm] Self-ping failed (non-critical): ${err.message}`);
    }
  }, PING_INTERVAL_MS);

  logInfo(`[KeepWarm] Self-ping scheduled every 10 min → ${SELF_URL}/health/live`);
}

// -----------------------------
// 9️⃣ Graceful Shutdown
// -----------------------------
const shutdown = () => {
  logInfo("Shutting down server...");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
