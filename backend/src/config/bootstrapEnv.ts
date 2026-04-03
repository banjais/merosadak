// backend/src/config/bootstrapEnv.ts
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import paths from "./paths.js";

export const NODE_ENV: string = process.env.NODE_ENV || "development";
export const IS_PROD: boolean = NODE_ENV === "production";

const envFile = IS_PROD ? ".env.production" : ".env.development";
const envPath = path.join(paths.ROOT, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envPath}`);
} else {
  console.log(`⚠️  No ${envFile} found, using system environment variables`);
}

interface EnvVars {
  NODE_ENV: string;
  PORT?: string;
  JWT_SECRET?: string;
  GAS_URL?: string;
  SHEET_ID?: string;
  GOOGLE_MAPS_API_KEY?: string;
  TOMTOM_API_KEY?: string;
  WAZE_JSON?: string;
  OPENWEATHERMAP_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL_PRIMARY?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_APP_ID?: string;
  FIREBASE_BACKEND?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  API_PREFIX?: string;
  RENDER_TOKEN?: string;
  SENTRY_DSN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  SMTP_PASS?: string;
}

export const ENV: EnvVars = {
  NODE_ENV,
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  GAS_URL: process.env.GAS_URL,
  SHEET_ID: process.env.SHEET_ID,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  TOMTOM_API_KEY: process.env.TOMTOM_API_KEY,
  WAZE_JSON: process.env.WAZE_JSON,
  OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL_PRIMARY: process.env.GEMINI_MODEL_PRIMARY,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
  FIREBASE_BACKEND: process.env.FIREBASE_BACKEND,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  API_PREFIX: process.env.API_PREFIX,
  RENDER_TOKEN: process.env.RENDER_TOKEN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  SMTP_PASS: process.env.SMTP_PASS,
};

console.log(`📦 ENV loaded: NODE_ENV=${ENV.NODE_ENV}, PORT=${ENV.PORT ?? "(not set)"}`);
