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
  **Note:** `data/nepal_boundary.geojson` currently contains only 7 sample
  district polygons (one per province), not a full dissolved country
  outline — it needs to be regenerated from a complete source before the
  outline will look right.

**New in this rebuild:**
- Search-first trip planner: type a place name (Photon autocomplete, free,
  no key), use the mic icon (browser's native Web Speech API, free), or
  click two points on the map (reverse-geocoded via Nominatim).
- "Browse by area" toggle keeps the old District → Palika dropdown flow for
  anyone who prefers it.
- Live weather strip on the destination via Open-Meteo (free, no key).
- Routing/distance via OSRM (free, no key) — unchanged from before.

## Free APIs in use (no key required)
Called directly from the browser:
- Photon (search-as-you-type place autocomplete)
- Nominatim (reverse geocoding for map clicks)
- OSRM (routing, distance, ETA)
- Open-Meteo (weather)
- CARTO basemap tiles

Called from the Worker (proxied, see table above):
- Open-Meteo (weather, primary)
- Overpass (POIs, primary)
- Nominatim (POIs, fallback)

## Where paid keys live
Nothing in `public/` ever holds a real API key — that folder is served
verbatim to every visitor. All paid/rate-limited keys live only as
Cloudflare Worker secrets (`worker/`), set with:

```
cd worker
wrangler secret put <NAME>
wrangler deploy
```

See `worker/.env.example` for the full list of six secrets the worker
reads, what each one is a primary vs. fallback source for, and where to
get a free key. Short version — every Worker-proxied endpoint tries a
free/keyless source first and only falls back to a paid key if that fails:

| Endpoint | Primary | Fallback |
|---|---|---|
| `/api/traffic`, `/api/incidents` | TomTom *(key)* | Waze feed *(partner approval, not self-serve)* |
| `/api/weather` | Open-Meteo *(free)* | OpenWeatherMap *(key)* |
| `/api/pois` | Overpass *(free)* | Nominatim *(free)* |
| `/api/assistant` | Gemini primary model *(key)* | Gemini secondary model *(key)* |

If a secret is unset, that fallback tier is simply skipped — nothing
crashes, the response just degrades gracefully to the next source (or
to empty/`"source":"none"` if every tier is unavailable).

The frontend calls the deployed Worker for traffic/assistant features
rather than calling TomTom/Gemini directly — see `WORKER_URL` near the
top of `public/index.html`'s script. **Note:** this README previously
said the worker lives at `merosadak.banjais.workers.dev`, but the code
actually calls `merosadak.banjays.workers.dev` (note the extra "y").
One of these is a typo — worth confirming against your actual Cloudflare
`workers.dev` subdomain before relying on it, since a wrong hostname
would make every Worker-proxied call fail silently (they're all wrapped
in try/catch that falls back to empty data).

## Deploy the frontend
```
firebase deploy --only hosting
```
