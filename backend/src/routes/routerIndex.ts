// backend/src/routes/routerIndex.ts
import { Router } from "express";

// ----------------------
// MAP DATA & INFO ROUTERS
// ----------------------
import roadRouter from "@/routes/roadRouter.js";
import highwayRouter from "@/routes/highwayRouter.js";
import boundaryRouter from "@/routes/boundaryRouter.js";
import poiRouter from "@/routes/poiRouter.js";
import weatherRouter from "@/routes/weatherRouter.js";
import trafficRouter from "@/routes/trafficRouter.js";
import monsoonRouter from "@/routes/monsoonRouter.js";

// ----------------------
// SAFETY & ALERTS
// ----------------------
import alertRouter from "@/routes/alertRouter.js";
import geminiRouter from "@/routes/geminiRouter.js";
import geocodeRouter from "@/routes/geocodeRouter.js";
import searchRouter from "@/routes/searchRouter.js";

// ----------------------
// AUTHENTICATION & ADMIN
// ----------------------
import authRouter from "@/routes/authRouter.js";
import otpRouter from "@/routes/otpRouter.js";
import superadminRouter from "@/routes/superadminRouter.js";

// ----------------------
// USER REPORTING
// ----------------------
import incidentRouter from "@/routes/incidentRouter.js";

// ----------------------
// NEW FEATURES (Tier 2 & 3)
// ----------------------
import analyticsRouter from "@/routes/analyticsRouter.js";
import etaRouter from "@/routes/etaRouter.js";
import routePlanningRouter from "@/routes/routePlanningRouter.js";
import userRouter from "@/routes/userRouter.js";
import webPushRouter from "@/routes/webPushRouter.js";
import cacheRouter from "@/routes/cacheRouter.js";
import uptimeRouter from "@/routes/uptimeRouter.js";
import aiUIRouter from "@/routes/aiUIRouter.js";
import governmentRouter from "@/routes/governmentRouter.js";
import verificationRouter from "@/services/verificationRouter.js";

// ----------------------
// MAIN API ROUTER
// ----------------------
const apiRouter = Router();

// ----------------------
// MAP DATA ENDPOINTS
// ----------------------
apiRouter.use("/roads", roadRouter);
apiRouter.use("/highways", highwayRouter);
apiRouter.use("/boundary", boundaryRouter);
apiRouter.use("/pois", poiRouter);
apiRouter.use("/weather", weatherRouter);
apiRouter.use("/traffic", trafficRouter);
apiRouter.use("/monsoon", monsoonRouter);

// ----------------------
// SAFETY & UTILITY ENDPOINTS
// ----------------------
apiRouter.use("/alerts", alertRouter);
apiRouter.use("/gemini", geminiRouter);
apiRouter.use("/geocode", geocodeRouter);
apiRouter.use("/search", searchRouter);

// ----------------------
// AUTHENTICATION & SECURITY
// ----------------------
apiRouter.use("/auth", authRouter);
apiRouter.use("/otp", otpRouter);
apiRouter.use("/superadmin", superadminRouter);

// ----------------------
// USER REPORTING
// ----------------------
apiRouter.use("/incidents", incidentRouter);

// ----------------------
// NEW FEATURES
// ----------------------
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/eta", etaRouter);
apiRouter.use("/routes", routePlanningRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/push", webPushRouter);
apiRouter.use("/cache", cacheRouter);
apiRouter.use("/monitoring", uptimeRouter);
apiRouter.use("/ai", aiUIRouter);
apiRouter.use("/government", governmentRouter);
/** Public Safety QR Verification - Ensure no global auth is applied above this */
apiRouter.use("/verify", verificationRouter);

// ----------------------
// Helper: Extract routes recursively
// ----------------------
export function extractRoutes(router: Router, prefix = ""): string[] {
  const routes: string[] = [];

  router.stack.forEach((layer: any) => {
    if (layer.route && layer.route.path) {
      // Simple route
      routes.push(prefix + layer.route.path);
    } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
      // Nested router: clean regex safely
      const source = layer.regexp?.source || "";
      const cleaned = source
        .replace(/^\\^/, "")
        .replace(/\\\/\?\(\?:\(\.\*\)\)\$|\\$/g, "");
      const newPrefix = prefix + (cleaned || "");
      routes.push(...extractRoutes(layer.handle, newPrefix));
    }
  });

  return routes;
}

// ----------------------
// Default Export
// ----------------------
export default apiRouter;
