# Environment Variables Audit Report

**Date:** April 14, 2026

---

## 1. FRONTEND (.env.*)

### `.env.development`
| Variable | Value | Used In | Status |
|----------|-------|---------|--------|
| `VITE_API_URL` | `http://localhost:4000/api` | `api.ts`, `config.ts` | ✅ Active |
| `VITE_WS_URL` | `ws://localhost:4000/ws/live` | `App.tsx` | ✅ Active |
| `VITE_GEMINI_API_KEY` | `AIzaSyDjHapYaWswK1lhK1eYmNj1V0AbwcO2j4k` | `geminiService.ts` | ✅ Active |
| `VITE_APP_NAME` | `MeroSadak-Dev` | `config.ts` | ✅ Active |
| `VITE_DEFAULT_LANGUAGE` | `en` | `config.ts` | ✅ Active |
| `VITE_LOGIN_REQUIRED` | `false` | `config.ts` | ✅ Active |
| `VITE_ENABLE_GEOLOCATION` | `true` | `config.ts` | ✅ Active |
| `VITE_ENABLE_3D_MODE` | `false` | `config.ts` | ✅ Active |
| `VITE_USE_MOCK` | `false` | `config.ts` | ✅ Active |
| `VITE_ENABLE_SW` | `false` | Not used | ⚠️ Unused |

### `.env.production`
| Variable | Value | Used In | Status |
|----------|-------|---------|--------|
| `VITE_API_URL` | `https://sadaksathi.onrender.com/api` | `api.ts`, `config.ts` | ✅ Active |
| `VITE_WS_URL` | `wss://sadaksathi.onrender.com/ws/live` | `App.tsx` | ✅ Active |
| `VITE_GEMINI_API_KEY` | `AIzaSyDjHapYaWswK1lhK1eYmNj1V0AbwcO2j4k` | `geminiService.ts` | ✅ Active |
| `VITE_APP_NAME` | `MeroSadak` | `config.ts` | ✅ Active |
| `VITE_DEFAULT_LANGUAGE` | `en` | `config.ts` | ✅ Active |
| `VITE_LOGIN_REQUIRED` | `false` | `config.ts` | ✅ Active |
| `VITE_ENABLE_GEOLOCATION` | `true` | `config.ts` | ✅ Active |
| `VITE_ENABLE_3D_MODE` | `false` | `config.ts` | ✅ Active |
| `VITE_USE_MOCK` | `false` | `config.ts` | ✅ Active |
| `VITE_ENABLE_SW` | `true` | Not used | ⚠️ Unused |

### Frontend Env Summary
- ❌ **REMOVED**: `VITE_API_BASE_URL` (was duplicate of `VITE_API_URL`)
- ❌ **REMOVED**: All Firebase vars (SDK not installed, dead code)
- ✅ **Consolidated**: Single `VITE_API_URL` used everywhere

---

## 2. BACKEND (config/index.ts)

### Required (Critical - must be set)
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `JWT_SECRET` | `temp-*` (prod) / `super-secret-key` (dev) | Auth tokens | ⚠️ **SHOULD BE SET** |
| `NODE_ENV` | `development` | Environment mode | ✅ Auto-set by Render |

### Important (Should be set)
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `PORT` | `4000` | Server port | ✅ Auto-set by Render |
| `RATE_LIMIT_MAX` | `5` | Rate limiting | ✅ Set in render.yaml (100) |
| `API_PREFIX` | `/api` | API route prefix | ✅ OK |

### API Keys (Optional - enable features)
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `GEMINI_API_KEY` | `` | AI chatbot | ⚠️ **SHOULD BE SET** |
| `OPENWEATHERMAP_API_KEY` | `` | Weather data | ⚠️ Missing |
| `OPEN_METEO_API_BASE` | `https://api.open-meteo.com/v1` | Weather fallback | ✅ OK |
| `GOOGLE_MAPS_API_KEY` | `` | Map services | ⚠️ Missing |
| `TOMTOM_API_KEY` | `` | Traffic/POI | ⚠️ Missing |

### Third Party Integrations
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `UPSTASH_REDIS_REST_URL` | `` | Redis cache | ⚠️ Missing |
| `UPSTASH_REDIS_REST_TOKEN` | `` | Redis cache | ⚠️ Missing |
| `SENTRY_DSN` | `` | Error tracking | ⚠️ Missing |
| `VAPID_PUBLIC_KEY` | `` | Push notifications | ⚠️ Missing |
| `VAPID_PRIVATE_KEY` | `` | Push notifications | ⚠️ Missing |
| `TELEGRAM_BOT_TOKEN` | `` | Notifications | ⚠️ Missing |
| `TELEGRAM_CHAT_ID` | `` | Notifications | ⚠️ Missing |

### SMTP/Email
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `SMTP_HOST` | `` | Email alerts | ⚠️ Missing |
| `SMTP_PORT` | `465` | Email alerts | ❓ Not configured |
| `SMTP_USER` | `` | Email auth | ❓ Not configured |
| `SMTP_PASS` | `` | Email auth | ❓ Not configured |

### Data Sources (Optional)
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `GAS_URL` | `` | Google Apps Sheet | ⚠️ Missing |
| `SHEET_ID` | `` | Google Sheets data | ⚠️ Missing |
| `WAZE_JSON` | `` | Waze traffic | ⚠️ Missing |
| `CLOUDFLARE_URL` | `` | Cloudflare API | ⚠️ Missing |
| `CLOUDFLARE_API_TOKEN` | `` | Cloudflare management | ⚠️ Missing |

### Firebase (Optional)
| Variable | Default | Used For | Status |
|----------|---------|----------|--------|
| `FIREBASE_BACKEND` | `` | Legacy API fallback | ⚠️ Missing |

---

## 3. GITHUB SECRETS (Required for CI/CD)

### Required
| Secret | Used By | Status |
|--------|---------|--------|
| `RENDER_DEPLOY_HOOK` | Backend deploy trigger | ✅ Configured |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase hosting deploy | ✅ Configured (updated) |
| `JWT_SECRET` | Backend build | ⚠️ **Check if set** |
| `CLOUDFLARE_API_TOKEN` | Worker deploy | ✅ Configured |

### Optional (notifications)
| Secret | Used By | Status |
|--------|---------|--------|
| `TELEGRAM_BOT_TOKEN` | Telegram alerts | ⚠️ **Check if set** |
| `TELEGRAM_CHAT_ID` | Telegram alerts | ⚠️ **Check if set** |
| `VITE_API_BASE_URL` | Frontend build | ❌ **NOT NEEDED** (removed) |
| `VITE_GEMINI_API_KEY` | Frontend build | ⚠️ **Check if set** |

---

## 4. RENDER SECRETS (Backend Server)

### Required in Render Dashboard
| Variable | Source | Status |
|----------|--------|--------|
| `NODE_ENV` | `production` (set in render.yaml) | ✅ |
| `RATE_LIMIT_MAX` | `100` (set in render.yaml) | ✅ |
| `PORT` | Auto-set by Render | ✅ |
| `RENDER_EXTERNAL_URL` | Auto-set by Render | ✅ |
| `JWT_SECRET` | **Must add manually** | ❌ **MISSING** |
| `GEMINI_API_KEY` | **Must add manually** | ❌ **MISSING** |

### Optional in Render Dashboard
| Variable | Purpose | Status |
|----------|---------|--------|
| `UPSTASH_REDIS_REST_URL` | Redis caching | ❌ Not set |
| `UPSTASH_REDIS_REST_TOKEN` | Redis caching | ❌ Not set |
| `SENTRY_DSN` | Error tracking | ❌ Not set |
| `VAPID_PUBLIC_KEY` | Push notifications | ❌ Not set |
| `VAPID_PRIVATE_KEY` | Push notifications | ❌ Not set |
| `TELEGRAM_BOT_TOKEN` | Notifications | ❌ Not set |
| `TELEGRAM_CHAT_ID` | Notifications | ❌ Not set |
| `OPENWEATHERMAP_API_KEY` | Weather API | ❌ Not set |

---

## 5. CLOUDFLARE WORKER (wrangler.toml)

### Hardcoded in wrangler.toml
| Variable | Value | Status |
|----------|-------|--------|
| `FIREBASE_BACKEND` | `https://us-central1-merosadak.cloudfunctions.net` | ⚠️ Old URL |
| `RENDER_BACKEND` | `https://sadaksathi.onrender.com` | ✅ Current |

### Environment Vars (can set via `wrangler secret put`)
| Variable | Purpose | Status |
|----------|---------|--------|
| `FIREBASE_BACKEND` | Firebase legacy API | ⚠️ Hardcoded |
| `RENDER_BACKEND` | Render backend URL | ⚠️ Hardcoded |
| `UPTIMEROBOT_API_KEY` | UptimeRobot stats | ❌ Not set |

---

## 6. ENV VAR NAMING CONSISTENCY

### Current State
| Location | Variable Name | Value | Consistent? |
|----------|--------------|-------|-------------|
| Frontend `.env.*` | `VITE_API_URL` | ✅ Used everywhere | ✅ |
| Backend `config/index.ts` | No API URL env var | N/A | N/A (internal) |
| Render | `RENDER_EXTERNAL_URL` | Auto-set | ✅ |
| Wrangler | `RENDER_BACKEND` | `https://sadaksathi.onrender.com` | ✅ |
| GitHub CI | `VITE_API_BASE_URL` | ❌ Removed | ✅ (removed) |
| GitHub CI | `VITE_GEMINI_API_KEY` | Used in frontend build | ✅ |

### ❌ Issues Found
| Issue | Location | Fix Needed |
|-------|----------|------------|
| Firebase dead code | Frontend `.env.*` | ✅ Already removed |
| `VITE_API_BASE_URL` duplicate | Frontend `.env.*` | ✅ Already removed |
| Firebase hardcoded in wrangler | `wrangler.toml` | ⚠️ Should be removed or updated |
| `VITE_ENABLE_SW` unused | Frontend `.env.*` | ⚠️ Dead var |

---

## 7. MISSING SECRETS CHECKLIST

### 🔴 Critical (App functionality affected)
| Secret | Where Needed | Impact | Action |
|--------|-------------|--------|--------|
| `JWT_SECRET` | Backend (Render), GitHub CI | Auth broken if missing | **Add to Render + GitHub** |
| `GEMINI_API_KEY` | Frontend, Backend (Render) | AI chatbot broken if missing | **Add to Render** |

### 🟠 Important (Features disabled)
| Secret | Where Needed | Impact | Action |
|--------|-------------|--------|--------|
| `OPENWEATHERMAP_API_KEY` | Backend (Render) | Weather data limited | Add to Render |
| `UPSTASH_REDIS_REST_URL` | Backend (Render) | Redis caching disabled | Add to Render |
| `UPSTASH_REDIS_REST_TOKEN` | Backend (Render) | Redis caching disabled | Add to Render |
| `VAPID_PUBLIC_KEY` | Backend (Render) | Push notifications broken | Add to Render |
| `VAPID_PRIVATE_KEY` | Backend (Render) | Push notifications broken | Add to Render |

### 🟢 Nice to Have
| Secret | Where Needed | Impact | Action |
|--------|-------------|--------|--------|
| `TELEGRAM_BOT_TOKEN` | Backend, GitHub CI | No deploy alerts | Add to Render + GitHub |
| `TELEGRAM_CHAT_ID` | Backend, GitHub CI | No deploy alerts | Add to Render + GitHub |
| `SENTRY_DSN` | Backend (Render) | No error tracking | Add to Render |
| `UPTIMEROBOT_API_KEY` | Backend (Render) | Limited monitoring stats | Add to Render |

---

## 8. SUMMARY: WHAT TO DO NOW

### 1. Add to Render Dashboard (Critical):
```
JWT_SECRET=<generate a 32+ char secret>
GEMINI_API_KEY=<your Gemini API key>
```

### 2. Add to GitHub Secrets (if not already):
```
JWT_SECRET=<same as Render>
VITE_GEMINI_API_KEY=<same as frontend .env>
TELEGRAM_BOT_TOKEN=<your bot token>
TELEGRAM_CHAT_ID=<your chat ID>
```

### 3. Remove from wrangler.toml (cleanup):
```toml
FIREBASE_BACKEND = "..."  # Remove this - Firebase not used
```

### 4. Remove dead vars from .env.*:
```
VITE_ENABLE_SW  # Not used anywhere
```
