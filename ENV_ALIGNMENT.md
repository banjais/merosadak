# Environment Variables Alignment Audit
**Date:** April 14, 2026

---

## 1. Frontend `.env.*` vs Backend `config/index.ts` Alignment

### ❌ Issue: No `CLOUDFLARE_API_TOKEN` in frontend `.env.*`
| File | Has `CLOUDFLARE_API_TOKEN`? | Used By |
|------|---------------------------|---------|
| `backend/src/config/index.ts` | ✅ Yes (`CLOUDFLARE_API_TOKEN: z.string().optional()`) | Cloudflare management |
| `wrangler.toml` | ❌ No (only `RENDER_BACKEND`) | Worker deploy |
| `.github/workflows/ci-cd.yml` | ✅ Yes (GitHub Secret) | Worker deploy |
| `frontend/.env.*` | ❌ **Not needed** | Frontend doesn't use Cloudflare |

**Status:** ✅ **OK** - `CLOUDFLARE_API_TOKEN` is backend-only, not needed in frontend.

---

## 2. Frontend `.env.*` Variables Alignment

### `.env.development` (10 vars)
| Variable | Used In | Backend Config Match? | Status |
|----------|---------|----------------------|--------|
| `VITE_API_URL` | `api.ts`, `config/config.ts` | N/A (frontend only) | ✅ |
| `VITE_WS_URL` | `App.tsx` | N/A (frontend only) | ✅ |
| `VITE_GEMINI_API_KEY` | `geminiService.ts` | Backend: `GEMINI_API_KEY` | ✅ Same key |
| `VITE_APP_NAME` | `config/config.ts` | N/A (frontend only) | ✅ |
| `VITE_DEFAULT_LANGUAGE` | `config/config.ts` | Backend: `DEFAULT_LANGUAGE` | ✅ Matches |
| `VITE_LOGIN_REQUIRED` | `config/config.ts` | N/A (frontend only) | ✅ |
| `VITE_ENABLE_GEOLOCATION` | `config/config.ts` | N/A (frontend only) | ✅ |
| `VITE_ENABLE_3D_MODE` | `config/config.ts` | N/A (frontend only) | ✅ |
| `VITE_USE_MOCK` | `config/config.ts` | Backend: `USE_MOCK` | ✅ Matches |
| `VITE_ENABLE_SW` | ❌ **Not used** | N/A | ❌ **Removed** |

### `.env.production` (10 vars)
Same as development, different values for API URL and WS URL.

**Status:** ✅ **Clean** - 9 active vars, 1 removed.

---

## 3. Backend `config/index.ts` - All Expected Env Vars

### Required (must be set in production)
| Variable | Frontend Equivalent? | Render Set? | GitHub Set? | Status |
|----------|---------------------|-------------|-------------|--------|
| `JWT_SECRET` | No | ❌ Missing | ⚠️ Check | 🔴 Add to Render |
| `GEMINI_API_KEY` | `VITE_GEMINI_API_KEY` | ❌ Missing | ⚠️ Check | 🔴 Add to Render |

### Optional (features disabled if missing)
| Variable | Frontend Equivalent? | Render Set? | Status |
|----------|---------------------|-------------|--------|
| `CLOUDFLARE_API_TOKEN` | No | ❌ Missing | Optional |
| `CLOUDFLARE_URL` | No | ❌ Missing | Optional |
| `UPSTASH_REDIS_REST_URL` | No | ❌ Missing | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | No | ❌ Missing | Optional |
| `OPENWEATHERMAP_API_KEY` | No | ❌ Missing | Optional |
| `VAPID_PUBLIC_KEY` | No | ❌ Missing | Optional |
| `VAPID_PRIVATE_KEY` | No | ❌ Missing | Optional |
| `SENTRY_DSN` | No | ❌ Missing | Optional |
| `TELEGRAM_BOT_TOKEN` | No | ❌ Missing | Optional |
| `TELEGRAM_CHAT_ID` | No | ❌ Missing | Optional |

### Auto-set by Environment
| Variable | Source | Status |
|----------|--------|--------|
| `NODE_ENV` | Render `production` | ✅ |
| `PORT` | Render auto-set | ✅ |
| `RATE_LIMIT_MAX` | Render `100` | ✅ |

---

## 4. Hardcoded Keys Check

### Searched Patterns:
| Pattern | Found In | Severity | Status |
|---------|----------|----------|--------|
| `AIza*` (Google API key) | `.env.*` files only | 🔴 Critical | ✅ **Not hardcoded in source** |
| `sk-*` (OpenAI key) | None | 🔴 Critical | ✅ Clean |
| `BMm9MNfi*` (VAPID key) | `pushNotificationService.ts` | 🟡 Low | ⚠️ **Hardcoded fallback** |
| IP addresses with keys | None | 🔴 Critical | ✅ Clean |

### VAPID Key in `pushNotificationService.ts`:
```typescript
const VAPID_PUBLIC_KEY = "BMm9MNfi-V2gbhuSyrxadHwATb_rQfQLbBsKoFnOUC-750Zwy31XdKbwFBJSiGXgHNaTdZtlxImdAxNpjCvsYQo";
```
**Impact:** Low - This is a PUBLIC key (safe to expose). Used only as fallback if backend doesn't provide one.

---

## 5. Summary: What to Fix

### 🔴 Critical (Do Now)
| Action | Where |
|--------|-------|
| Add `JWT_SECRET` to Render dashboard | Render → Settings → Environment Variables |
| Add `GEMINI_API_KEY` to Render dashboard | Render → Settings → Environment Variables |

### 🟡 Optional (Features Disabled)
| Action | Impact |
|--------|--------|
| Add `CLOUDFLARE_API_TOKEN` to Render | Cloudflare management |
| Add `UPSTASH_REDIS_*` | Redis caching |
| Add `VAPID_*` keys | Push notifications |
| Add `TELEGRAM_*` to Render | Backend Telegram alerts |

### ✅ Already Clean
- ✅ No hardcoded secrets in source code
- ✅ `CLOUDFLARE_API_TOKEN` not needed in frontend
- ✅ `VITE_API_URL` is single source of truth
- ✅ Firebase dead code removed from env files
- ✅ `VITE_ENABLE_SW` dead var removed
