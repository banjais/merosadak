// backend/src/routes/routerIndex.ts

import { Router } from "express";

// 1. Map Data & Information Routers
import roadRouter from "./roadRouter.js";
import boundaryRouter from "./boundaryRouter.js";
import poiRouter from "./poiRouter.js";
import weatherRouter from "./weatherRouter.js";
import trafficRouter from "./trafficRouter.js";
import monsoonRouter from "./monsoonRouter.js";

// 2. Safety & AI Routers
import alertRouter from "./alertRouter.js";
import geminiRouter from "./geminiRouter.js";

// 3. User & System Routers
import authRouter from "./authRouter.js";
import otpRouter from "./otpRouter.js";
import geocodeRouter from "./geocodeRouter.js";
import searchRouter from "./searchRouter.js";
import superadminRouter from "./superadminRouter.js";

const apiRouter = Router();

/**
 * MAP DATA ENDPOINTS
 * These provide the layers for the frontend map.
 */
apiRouter.use("/roads", roadRouter);       // For master.geojson & road status
apiRouter.use("/boundary", boundaryRouter); // For Nepal boundary & administrative data
apiRouter.use("/pois", poiRouter);         // Points of Interest (hospitals, fuel, etc.)
apiRouter.use("/weather", weatherRouter);   // Current weather conditions
apiRouter.use("/traffic", trafficRouter);   // Real-time congestion data
apiRouter.use("/monsoon", monsoonRouter);   // Landslide & flood risks

/**
 * SAFETY & UTILITIES
 */
apiRouter.use("/alerts", alertRouter);     // Active road alerts & notifications
apiRouter.use("/gemini", geminiRouter);     // AI Safety Assistant (routes analysis)
apiRouter.use("/geocode", geocodeRouter);   // Searching locations/converting coordinates (legacy)
apiRouter.use("/search", searchRouter);     // Unified global search (roads, POI, locations)

/**
 * AUTHENTICATION & SECURITY
 */
apiRouter.use("/auth", authRouter);         // Login, Register, Profile
apiRouter.use("/otp", otpRouter);           // Phone verification for Nepal users
apiRouter.use("/superadmin", superadminRouter); // Admin dashboard, logs, and system sync

export default apiRouter;
