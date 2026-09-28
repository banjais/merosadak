# Mero Sadak — agent notes

Nepal road-travel PWA (Leaflet map + Firebase Hosting + Cloudflare Worker).

## Product rules
- One share modal and one pre-trip checklist modal (owned by `App.tsx`).
- After a route is calculated: KPI row → Driving/Passenger mode → module tabs.
- **Ahead** = ordered hazards/weather/stops along the route only.
- **Cost & eco** = fuel/toll/carbon for drivers only.
- Speech recognition language follows app `language` (`en-US` / `ne-NP`).
- Do not hardcode Kathmandu→Pokhara when planning from a highway; resolve endpoint names to city ids.

## Deploy
- Push to `main` triggers `.github/workflows/ci-cd.yml` (typecheck, build, worker, Firebase Hosting).
- Worker name: `merosadak` → `merosadak.banjays.workers.dev`.
- Hosting site: `merosadak` (Firebase).

## Data
- Free browser APIs: Photon, Nominatim, OSRM, Open-Meteo.
- Worker proxies rate-limited keys (TomTom, Gemini, etc.).
