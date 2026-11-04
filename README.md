# Mero Sadak

Static Nepal road-network map (Leaflet) on Firebase Hosting, with a Cloudflare
Worker backend for anything that needs a paid/rate-limited key.

## What changed in this pass

**Bug fixes (previous version):**
- Dropdowns were reading property names (`PROVINCE`, `DISTRICT`, `name_en`, etc.)
  that don't exist in `data/palika.geojson`. The real fields are `District` and
  `FIRST_GaPa`. Fixed to match the actual schema; the "Province" level was
  dropped since the source data has no province attribute at all.
- The Nepal boundary "mask" was built by hand-feeding GeoJSON's `[lng, lat]`
  coordinates into `L.polygon()`, which expects Leaflet's `[lat, lng]` order —
  so the mask holes were plotted nowhere near Nepal, and the map showed a
  solid white square with only route/highway lines drawn on top. Replaced
  with `L.geoJSON()`, which handles coordinate order correctly, drawing the
  boundary as an outline rather than a punch-hole mask.
  **Note:** Map mask/border uses `public/data/nepal-provinces.geojson` (7
  provinces). `public/data/nepal_boundary.geojson` holds full district
  polygons (~77 features) for other GIS uses.

**New in this rebuild:**
- Search-first trip planner: type a place name (Photon autocomplete, free,
  no key), use the mic icon (browser's native Web Speech API, free), or
  click two points on the map (reverse-geocoded via Nominatim).
- "Browse by area" toggle keeps the old District → Palika dropdown flow for
  anyone who prefers it.
- Live weather strip on the destination via Open-Meteo (free, no key).
- Distance and route measurements use the DoR highway graph and published SNH references where coverage exists. Unsupported pairs are labelled as aerial estimates; they are not presented as road distances. OSRM is used by the offline geometry-stitching script, not guaranteed as a live in-app routing service.

## Local development

Run the app server and the Worker in separate terminals:

```bash
# Terminal 1 — frontend + existing Express development API
npm ci
npm run dev
```

```bash
# Terminal 2 — local Cloudflare Worker API (Wrangler listens on port 8787)
cd worker
npm ci --legacy-peer-deps
npx wrangler dev --var ALLOWED_ORIGIN:http://localhost:3000
```

The browser uses the Express server for the existing local `/api/*` routes.
Firebase-authenticated personal endpoints (reminders and private trip data)
are sent to the local Worker at `http://127.0.0.1:8787`. Set
`VITE_WORKER_URL` if your local Worker uses another address. Put local-only
Worker secrets in `worker/.dev.vars`; never commit that file.

## Free APIs in use (no key required)
Called directly from the browser:
- Photon (search-as-you-type place autocomplete)
- Nominatim (reverse geocoding for map clicks)
- OSRM (used by the offline geometry-stitching script; not a guaranteed live in-app router)
- Open-Meteo (weather)

Called from the Worker (proxied):
- Open-Meteo (weather, primary)
- Overpass (POIs, primary)
- Nominatim (POIs, fallback)

## Optional free / generous free-tier APIs (new)
These improve reliability for Nepal road travel. All are optional — if the
key is unset the Worker simply skips that source.

| Service              | Variable                     | Purpose                                      | Free tier                          |
|----------------------|------------------------------|----------------------------------------------|------------------------------------|
| OpenRouteService     | `OPENROUTESERVICE_API_KEY`   | Routing / isochrones / elevation alternative | ~2,000 req/day                     |
| LocationIQ           | `LOCATIONIQ_API_KEY`         | Geocoding / search fallback                  | ~5,000 req/day                     |
| OpenCage             | `OPENCAGE_API_KEY`           | Geocoding / search fallback                  | ~2,500 req/day                     |
| WAQI / AQICN         | `WAQI_API_KEY`               | Air quality (Kathmandu & major cities)       | Free key (aqicn.org)               |
| OpenTopoData         | (no key)                     | Elevation for mountain highways              | Public instances                   |

See `worker/.env.example` and the root `.env.example` for full details.

## Where paid keys live
Nothing in `public/` ever holds a real API key — that folder is served
verbatim to every visitor. All paid/rate-limited keys live only as
Cloudflare Worker secrets (`worker/`), set with:

```
cd worker
wrangler secret put <NAME>
wrangler deploy
```

See `worker/.env.example` for the full list of secrets the worker
reads, what each one is a primary vs. fallback source for, and where to
get a free key. Short version — every Worker-proxied endpoint tries a
free/keyless source first and only falls back to a paid key if that fails:

| Endpoint | Primary | Fallback |
|---|---|---|
| `/api/traffic`, `/api/incidents` | TomTom *(key)* | Waze feed *(partner approval, not self-serve)* |
| `/api/weather` | Open-Meteo *(free)* | OpenWeatherMap *(key)* |
| `/api/pois` | Overpass *(free)* | Nominatim *(free)* |
| `/api/assistant` | Gemini primary model *(key)* | Gemini secondary model *(key)* |
| Distance / route geometry | DoR survey graph + DoR SNH pair references; aerial fallback when unsupported | — |
| Optional external road routing (not currently guaranteed) | OSRM / OpenRouteService | — |
| Geocoding (future) | Photon / Nominatim | LocationIQ or OpenCage |
| Air quality (future) | WAQI | — |

If a secret is unset, that fallback tier is simply skipped — nothing
crashes, the response just degrades gracefully to the next source (or
to empty/`"source":"none"` if every tier is unavailable).

The frontend calls the deployed Worker for traffic/assistant features
rather than calling TomTom/Gemini directly. Canonical Worker URL:

`https://merosadak.banjays.workers.dev`

(Configured in `src/utils/apiConfig.ts`, `index.html` meta `worker-base-url`,
and `public/embed.html`.)

## Deploy the frontend
```
npx --yes firebase-tools@15.30.2 deploy --only hosting
```
