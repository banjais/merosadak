// backend/src/config/index.ts
import { z } from 'zod';

/**
 * 🔐 Environment Variables Schema
 * All variables are loaded via src/bootstrapEnv.ts before this file is imported.
 */
const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api'),

  // Upstash REST (Required for cacheService via Redis.fromEnv())
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Upstash Admin (For reports/usage stats)
  UPSTASH_API_KEY: z.string().optional(),
  UPSTASH_DB_ID: z.string().optional(),

  // Flags
  USE_MOCK: z.coerce.boolean().default(false),
  FORCE_FETCH: z.coerce.boolean().default(false),

  // Security
  JWT_SECRET: z.string().min(16),

  // External APIs
  GEMINI_API_KEY: z.string().optional(),
  OPENWEATHERMAP_API_KEY: z.string().optional(),
  OPENWEATHERMAP_API_URL: z.string().url().optional(),
  TOMTOM_API_KEY: z.string().optional(),

  // Data
  GAS_URL: z.string().url().optional(),
  WAZE_JSON: z.string().url().optional(),
});

// 4. Validate
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ [Config] Environment validation failed');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

export const config = parsed.data!;

// 7. Backward-compatible export for UPSTASH
export const UPSTASH = {
  REDIS_REST_URL: config.UPSTASH_REDIS_REST_URL,
  REDIS_REST_TOKEN: config.UPSTASH_REDIS_REST_TOKEN,
  ADMIN_KEY: config.UPSTASH_API_KEY, // Rename to match cacheService usage
  DB_ID: config.UPSTASH_DB_ID,
};

export const {
  PORT,
  API_PREFIX,
  NODE_ENV,
  USE_MOCK,
  FORCE_FETCH,
  JWT_SECRET,
  GAS_URL,
  GEMINI_API_KEY,
  OPENWEATHERMAP_API_KEY,
  TOMTOM_API_KEY,
  WAZE_JSON,
} = config;

export const isDev = NODE_ENV === 'development';
export const isProd = NODE_ENV === 'production';
