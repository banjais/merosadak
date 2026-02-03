module.exports = {
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  target: "es2022",
  clean: true,
  platform: "node",
  shims: true,
  bundle: true,
  splitting: false,
  sourcemap: true,
  skipNodeModulesBundle: true,
  external: ["fs", "path", "crypto", "os", "events", "node:fs", "node:path", "node:fs/promises"],
  tsconfig: "tsconfig.json",
  // 🚀 Only start the server if we are watching (npm run dev)
  onSuccess: process.argv.includes('--watch') 
    ? "node -r dotenv/config dist/index.js dotenv_config_path=.env.development" 
    : undefined
};