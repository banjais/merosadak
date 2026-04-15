// backend/src/routes/routerIndex.ts
import { Router } from "express";

// ----------------------
// MAP DATA & INFO ROUTERS
// ----------------------
import roadRouter from "./roadRouter.js";
import highwayRouter from "./highwayRouter.js";
import boundaryRouter from "./boundaryRouter.js";
import poiRouter from "./poiRouter.js";
import weatherRouter from "./weatherRouter.js";
import trafficRouter from "./trafficRouter.js";
import monsoonRouter from "./monsoonRouter.js";

// ----------------------
// SAFETY & ALERTS
// ----------------------
import alertRouter from "./alertRouter.js";
import geminiRouter from "./geminiRouter.js";
import geocodeRouter from "./geocodeRouter.js";
import searchRouter from "./searchRouter.js";

// ----------------------
// AUTHENTICATION & ADMIN
// ----------------------
import authRouter from "./authRouter.js";
import otpRouter from "./otpRouter.js";
import superadminRouter from "./superadminRouter.js";

// ----------------------
// USER REPORTING
// ----------------------
import incidentRouter from "./incidentRouter.js";

// ----------------------
// NEW FEATURES (Tier 2 & 3)
// ----------------------
import analyticsRouter from "./analyticsRouter.js";
import etaRouter from "./etaRouter.js";
import routePlanningRouter from "./routePlanningRouter.js";
import userRouter from "./userRouter.js";
import webPushRouter from "./webPushRouter.js";
import cacheRouter from "./cacheRouter.js";
import uptimeRouter from "./uptimeRouter.js";
import aiUIRouter from "./aiUIRouter.js";
import governmentRouter from "./governmentRouter.js";

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
