# The 20th Century in 100 Days

Personal side project: a static site with one important day per year, 1900–2000 (101 days). Each day has a story, a place on a world map and "go deeper" suggestions (books, films, documentaries, podcasts, articles, places, archives). The site is in English; the owner talks to Claude in Italian. Italian may be added later, so don't hard-code UI strings.

## Ground rules
- **Never write historical content** unless explicitly asked. The owner writes the days by hand. Sample days are clearly fictional ("SAMPLE – …", example.com URLs).
- Everything must work with 0, a few or 101 days. Stats show "N of 101 days: not yet meaningful" below 20 days (`SPARSE_THRESHOLD` in src/lib/stats.ts).
- Styling stays minimal and neutral; the owner will design it later. All design values go in `src/styles/tokens.css`. All UI text goes in `src/i18n/en.ts`.
- Static only: no backend, DB, login, CMS or analytics. Out of scope for now: voting, newsletter, comments.

## Stack
- Astro 7 (static output, content collection with a `glob` loader on `content/days/*.md`, Zod v4 via `astro/zod`).
- `ClientRouter` + `transition:persist="map-shell"`: the map survives navigations, and only the day overlay changes.
- D3 modules only (no full `d3` bundle): d3-geo and topojson-client run at build time, so the browser never projects. d3-interpolate/d3-ease drive the camera in the browser. d3-scale/d3-shape/d3-array are used for stats.
- `@resvg/resvg-js` renders OG PNGs at build time, using Inter TTFs from `src/assets/fonts/`.
- Node is installed at `~/.local/node/bin` (not on the default PATH on this Mac). Prefix commands with `export PATH=~/.local/node/bin:$PATH`.

## Key files
- `src/schema.ts`: the data model and closed lists. Single source of truth for Astro and for `npm run check`. Keep it free of `astro:*` imports, because it runs under tsx.
- `src/lib/validate.ts`: errors vs warnings. Tests are in `scripts/test-check.ts`; add a case when you add a rule.
- `src/lib/camera.ts`: a view is `[cx, cy, w]` in world units (WORLD_W = 1000, Equal Earth). `Frame` describes the free screen area (above the card and slider, left of the overlay on wide screens). The same maths is used on the server (SSR viewBox) and in the browser.
- `src/components/map/map-client.ts`: selection, camera flights, input (scrubber drag, ←/→ with Shift/PageUp/PageDown/Home/End, wheel, swipe/drag on the map, point clicks), and the overlay/history logic.
- `src/pages/[year].astro`: day page = MapView + DayOverlay. `src/pages/index.astro`: MapView only.

## Behaviour decisions (agreed with the owner)
- Home starts on the whole world, then flies to the latest day. `prefers-reduced-motion` gives instant jumps, no flights.
- Scrubbing uses `history.replaceState` to `/#YYYY`. Opening a day pushes `/YYYY/`. Prev/next in the overlay *replaces*. Close/Esc does `history.back()` if the overlay was opened from the map, otherwise navigates to `/#YYYY`.
- An empty year leaves the camera where it is and the card says "Not yet written". Points of earlier years stay faint; later years are hidden.
- The home map is not freely pannable or zoomable: wheel, drag and swipe move through time.
- While the overlay is open, the slider/card HUD is hidden. On wide screens the map stays visible on the left and its points are clickable.
- Drafts appear only in `astro dev`, with a badge, and are excluded from builds.
- `date` is Gregorian; ambiguity goes in `date_note`. `country_then` is the historical name, `country_today` the modern one.
- `visual` is a file name in `src/assets/visuals/`, resolved with `import.meta.glob`.
- `place.zoom` is optional (default 3, max 12). The 1:50m coastline swaps in at effective zoom ≥ 2.5, after the camera settles.
- Hosting: Cloudflare Pages (root-level URLs), build `npm run build` (runs the check first), env `SITE_URL` and `NODE_VERSION=24`.

## Commands
`npm run dev` · `npm run check` · `npm run test:check` · `npm run build` · `npm run preview`
