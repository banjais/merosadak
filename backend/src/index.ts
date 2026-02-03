// backend/src/index.ts
import "./bootstrapEnv.js"; // MUST stay at the top
import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { PORT, API_PREFIX, NODE_ENV } from "./config/index.js";
import apiRouter from "./routes/routerIndex.js";
import healthRouter from "./routes/healthRouter.js";
import { logInfo, logError } from "./logs/logs.js";
import { DATA_DIR, CACHE_DIR } from "./config/paths.js";

// Services
import { initializeWebSocket, shutdownWebSocket } from "./services/websocketService.js";
import { startAutoRefresh } from "./services/schedulerService.js";
import { getSyncHealth } from "./services/roadService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bootServer = async () => {
  try {
    logInfo("🚀 Starting SadakSathi Backend...");

    // Create necessary directories
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const app = express();
    const isProd = NODE_ENV === "production";

    // Middleware
    app.use(cors({
      origin: isProd 
        ? ["https://sadaksathi.web.app", "https://sadaksathi.firebaseapp.com"] 
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }));
    app.use(express.json());

    // ----------------------
    // 1️⃣ HEALTH CHECK
    // ----------------------
    app.use("/api/health", healthRouter);

    // Optional inline quick health endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        mode: NODE_ENV,
        uptime: Math.floor(process.uptime()) + "s",
        sync: getSyncHealth(),
        service: "SadakSathi Core",
      });
    });

    // ----------------------
    // 2️⃣ API ROUTES
    // ----------------------
    app.use(API_PREFIX, apiRouter);

    // ----------------------
    // 3️⃣ PRODUCTION FRONTEND HOSTING
    // ----------------------
    if (isProd) {
      const frontendPath = path.resolve(__dirname, "../../frontend/dist");

      if (await fs.stat(frontendPath).catch(() => false)) {
        app.use(express.static(frontendPath));
        app.get("*", (req, res) => {
          if (!req.path.startsWith(API_PREFIX)) {
            res.sendFile(path.join(frontendPath, "index.html"));
          }
        });
        logInfo(`📦 PRODUCTION: Serving Frontend from ${frontendPath}`);
      } else {
        logError(`⚠️ Frontend dist not found at ${frontendPath}`);
      }
    } else {
      logInfo("🛠️ DEVELOPMENT: API Only Mode");
    }

    // ----------------------
    // 4️⃣ START SERVER
    // ----------------------
    const server = http.createServer(app);

    // Optimize timeouts for cloud environments (Render, Cloudflare, etc.)
    server.keepAliveTimeout = 65000; // slightly higher than most proxy defaults (60s)
    server.headersTimeout = 66000;

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        logError(`❌ Port ${PORT} is busy. Please run 'npx kill-port ${PORT}'`);
        process.exit(1);
      }
    });

    server.listen(PORT, "0.0.0.0", () => {
      logInfo(`✅ Server Live: http://localhost:${PORT}`);

      // Start services
      initializeWebSocket(server);
      startAutoRefresh();
    });

    // ----------------------
    // 5️⃣ GRACEFUL SHUTDOWN
    // ----------------------
    const shutdown = async (signal: string) => {
      logInfo(`🛑 ${signal} received. Closing server...`);
      shutdownWebSocket();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 3000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (err: any) {
    logError("❌ BOOT ERROR:", { error: err.message });
    process.exit(1);
  }
};

// Launch
bootServer();
