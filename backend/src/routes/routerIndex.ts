// backend/src/routes/routerIndex.ts
import { Router } from "express";

// ----------------------
// MAP DATA & INFO ROUTERS
// ----------------------
import roadRouter from "./roadRouter.js";
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
// MAIN API ROUTER
// ----------------------
const apiRouter = Router();

// ----------------------
// MAP DATA ENDPOINTS
// ----------------------
apiRouter.use("/roads", roadRouter);
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
