# MeroSadak — Nepal Road & Travel Companion
## Product redesign and engineering plan

Target branch: `redesign/road-travel-companion`
Baseline: `main` (kept unchanged)

## Product vision

Transform MeroSadak from a feature-heavy highway information tool into a map-first, mobile-first Nepal road and travel companion. The experience should feel polished, calm, fast and internationally credible while remaining honest about data coverage and measurement quality.

## Product principles

1. **Map first, actions second.** The map and one prominent destination search are the primary home experience.
2. **One source of truth.** Route Planner and Distance Calculator share the same city catalogue, road graph, surveyed-distance engine and provenance model.
3. **Measured means measured.** DoR surveyed chainage/alignment is authoritative for covered highway segments. A route engine supplies navigable connecting roads and live routing where available. Straight-line distance is never labelled as road distance.
4. **Live means timestamped.** Static surveyed length, live traffic/incident status, and estimated travel time are distinct data types. Show last-updated/source information for live feeds and degrade honestly when unavailable.
5. **Short answers.** Default UI copy and AI replies are concise; detailed methodology is available on demand.
6. **Progressive disclosure.** Keep primary navigation small. Put specialist tools and settings in contextual secondary menus.
7. **Permission and privacy first.** Location, voice, notifications, camera and background tracking are opt-in, clearly explained and easy to stop.

## Proposed information architecture

### Primary navigation
- Explore (default map)
- Plan a trip
- Distance
- My reminders
- MeroSadak AI

### Secondary / contextual tools
- Highway directory
- Road alerts and reports
- Weather and air quality
- Fuel and EV charging
- Tolls
- Offline maps/data
- Data sources and methodology
- Account and settings

Emergency SOS remains a distinct, immediately accessible safety action, not buried in a general menu. Admin tools remain role-gated and separate from public travel navigation.

## Place coverage

The current `cityDataLoader.ts` source list already includes `geojson-town-coords.json` as well as cities, palika coordinates, district HQs/centroids, calculator cities, airports, temples, tourist places and bus stations. Do not rely on the older city-architecture status note without rechecking the live code.

Next coverage work:
- Produce a reproducible inventory by source and place type.
- Deduplicate by stable ID and normalized name + coordinates, preserving aliases and source provenance.
- Prioritize municipalities, rural municipalities, cities, highway towns, junctions and transport hubs in default search.
- Keep attractions/POIs searchable but visually classified separately from settlements.
- Include every routable DoR corridor town where coordinates and graph snapping are validated.
- Display the number of searchable places only when it is computed from the currently loaded catalogue.
- Add search tests for Nepali/English names, aliases, spelling variants, short prefixes and duplicate names.

## Distance and routing model

### Separate the data concepts
- **Official surveyed highway length:** DoR link length / chainage along surveyed geometry.
- **Road-network connector:** navigable road distance from a place or GPS fix to a valid highway access node.
- **Live route distance:** the route returned by the current routing graph/provider for the chosen vehicle and route.
- **Aerial distance:** great-circle reference only; never presented as road distance.
- **Live travel conditions:** traffic, incidents, closures and weather with source and update timestamp.
- **ETA:** an estimate based on route distance, road class/terrain and live conditions when available; label as estimate.

### Routing priority
1. Use a validated DoR surveyed route for covered highway segments.
2. Route off-network origin/destination legs over a real connected road network (for example, a configured routing provider). Add those measured legs to the surveyed highway segment.
3. If a real road connector cannot be obtained, do not call a straight-line stub a connecting road. Return a clearly labelled incomplete/estimated result or aerial fallback, with no false road-route geometry.
4. Never snap across rivers, ridges, disconnected carriageways or inaccessible barriers merely because a point is geometrically close.
5. Do not double-count joins, overlaps or access links. Preserve a per-segment method and source.
6. Compare official published pair distances as a reference, not as a second distance to add to the route total.

### Real-time data policy
Surveyed highway lengths are authoritative but generally static until the survey dataset is updated. “Real-time” applies to traffic, incidents, closures, weather, GPS position and provider-generated ETA—not to the physical surveyed length itself. Every live status must have a source, last-checked time and stale/unavailable state.

## Distance Calculator report

Redesign as a compact result sheet:
- One large total distance.
- Origin → destination.
- One short method/source line.
- A small segment breakdown only when there are multiple measurement types.
- Highway codes/names only when useful.
- ETA only when supported, clearly labelled as an estimate.
- A single expandable “How was this calculated?” detail.
- No repeated source attribution, duplicate distance values or long explanatory paragraphs.
- Map geometry must exactly match the selected result; aerial fallback is drawn as a dashed straight line and labelled.

## AI experience

Consolidate assistant entry points into one MeroSadak AI experience with route context and optional user-approved location context.

The assistant should:
- Understand concise natural-language requests and follow-up references.
- Support English and Nepali text; voice input should follow the selected language and browser/device capability.
- Ask at most one necessary clarification at a time.
- Answer briefly by default and offer detail only when asked.
- Distinguish verified live data, official/static data, estimates and unavailable information.
- Never invent traffic, road closures, places, prices, ETAs or reminder triggers.
- Use an empathetic, calm and practical tone without claiming to detect emotions or physical objects it cannot sense.
- Offer visible controls for voice playback, microphone and context sharing.

## Personal reminders

Create a unified reminder hub for:
- Parked vehicle location (GPS, timestamp, optional user-added note/photo).
- Belongings checklist (keys, wallet, phone, documents, luggage and custom items).
- Departure and arrival reminders.
- Route-distance and geofence reminders when the user enables location tracking.
- Natural-language reminder creation through AI.

Important constraints:
- A saved parking location records where the user parked; it does not track a moving vehicle.
- Background/geofence reminders depend on browser/OS permissions and platform support; provide an in-app fallback and clearly show when tracking is inactive.
- Belongings are user-confirmed checklist items. Do not claim that AI can verify an item is physically present without an explicitly enabled and supported camera/sensor workflow.
- Persist reminders safely, scope server-side records to authenticated users, and avoid using a shared default user ID for private data.
- Provide edit, complete, snooze and delete controls.

## UI direction

- Professional, international-quality travel interface.
- Map-first home screen; single persistent “Where to?” search.
- Keep the existing right-side “My location” floating button; do not show a permanent location card/field. Reveal location details only after the user taps it.
- Compact primary actions and a restrained bottom navigation on mobile; a small utility menu on desktop.
- Clear hierarchy, consistent iconography, accessible contrast, responsive layouts and light/dark themes.
- No decorative cards that repeat information; use compact sheets and contextual panels.
- Preserve fast first paint and lazy-load secondary tools.

## Delivery and validation

Work on this branch only. Do not push directly to `main`.

For each implementation phase:
1. Inspect the existing implementation and its callers.
2. Make small, coherent commits.
3. Add/update tests for data coverage, route measurement, fallback labels, privacy and reminder behaviour.
4. Run type-check, lint, build and targeted tests where an execution environment is available.
5. Inspect the changed-file diff and ensure no secrets, generated credentials or private environment files are committed.
6. Open a pull request to `main` for review; do not merge or deploy without explicit approval.

## Suggested implementation phases

1. Data coverage and routing integrity audit; correct any misleading connector measurements.
2. Shared search/place catalogue and concise Distance Calculator result experience.
3. Map-first navigation and responsive visual system.
4. Unified AI chat and context controls.
5. Parked vehicle + belongings + journey reminder hub.
6. Live-data freshness, offline behaviour, accessibility and performance validation.
