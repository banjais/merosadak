const { defineConfig } = require("tsup");
const path = require("path");

module.exports = defineConfig({
  entry: [
    "src/index.ts",
    "src/scripts/*.ts",
    "src/config/bootstrapEnv.ts",
    "src/config/index.ts",
    "src/config/paths.ts",
    "src/constants/*.ts",
    "src/controllers/*.ts",
    "src/routes/*.ts",
    "src/middleware/*.ts",
    "src/services/*.ts",
    "src/logs/*.ts",
    "src/utils/*.ts",
  ],
  outDir: "dist",
  clean: true,
  format: ["esm"],
  target: "es2022",
  sourcemap: true,
  dts: false,
  outExtension({ format }) {
    return { js: `.js` };
  },
  loader: {
    ".ts": "ts",
  },
  external: [
    "ws",
    "ioredis",
    "axios",
    "fuse.js",
    "@sentry/node",
    "@sentry/profiling-node",
    "pdfkit",
    "@upstash/redis",
    "dotenv",
    "cors",
    "express",
    "helmet",
    "morgan",
    "express-rate-limit",
    "jsonwebtoken",
    "node-cron",
    "zod",
    "uuid",
    "web-push",
    "crypto",
    "https",
    "http",
    "url",
    "stream",
    "util",
    "os",
    "fs",
    "path",
    "@turf/turf",
  ],
  splitting: true,
  minify: false,
  treeshake: true,
  esbuildOptions(options) {
    options.logLevel = "error";
    options.platform = "node";
    options.alias = {
      "@": path.resolve(__dirname, "src"),
      "@logs": path.resolve(__dirname, "src/logs"),
    };
    // Resolve .js imports to .ts files
    options.resolveExtensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
  },
});
