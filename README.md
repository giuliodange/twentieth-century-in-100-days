# The 20th Century in 100 Days

One important day for every year from 1900 to 2000 (101 days), told on a world map, with books, films, documentaries, podcasts, articles, places and archives to go deeper.

It's a static site built with [Astro](https://astro.build). There's no backend, database or CMS. Every day is a Markdown file you edit by hand.

## Requirements

- Node.js 22 or newer (`.nvmrc` pins 24).
- If you don't have Node yet: an LTS build was installed in `~/.local/node`. Add it to your shell once:

```bash
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

Then open a new terminal and install dependencies:

```bash
npm install
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Local site at http://localhost:4321. It reloads as you edit, and **drafts are visible**, with a badge |
| `npm run check` | Validates every day (see below) |
| `npm run test:check` | Self-test of the validator (24 cases) |
| `npm run build` | Runs `check`, then builds the production site into `dist/` (drafts excluded) |
| `npm run preview` | Serves `dist/` locally, to try the production build |

## How to add a day

1. Copy `content/day-template.md` to `content/days/YYYY.md`, e.g. `content/days/1969.md`. **The file name must be the year.**
2. Fill in the frontmatter (the part between `---` lines) and write the story below it in Markdown (300–500 words).
3. Leave `status: draft` while you work. The day shows up in `npm run dev` but not on the live site.
4. Run `npm run check` and fix any `✖` errors.
5. When it's ready, set `status: published`, commit and push.

### Fields

| Field | Required | Notes |
|---|---|---|
| `year` | ✔ | 1900–2000, one day per year |
| `date` | ✔ | ISO `YYYY-MM-DD`, Gregorian calendar, must fall in `year` |
| `date_note` | | For Julian/Gregorian or time-zone ambiguity |
| `title`, `summary`, `why_it_matters` | ✔ | Summary: at most 2 sentences |
| `place.name`, `place.country_then`, `place.country_today`, `place.continent` | ✔ | Continent comes from a closed list. Spell countries the same way every time, or the stats split them |
| `place.lat`, `place.lon` | ✔ | Decimal degrees: south and west are negative |
| `place.zoom` | | Camera zoom: 1 = whole world, default 3, max 12. Above ~8 the coastline looks coarse |
| `people` | | List of names, used only for stats |
| `themes` | ✔ | One or more of: politics, war, science, technology, culture, economy, society, sport, environment, religion |
| `go_deeper` | | See below |
| `sources` | | List of `{ title, url }`, kept separate from go_deeper |
| `visual` | | File name of an image or SVG in `src/assets/visuals/` |
| `status` | ✔ | `draft` or `published` |

Misspelt field names are errors (e.g. `why_it_maters`), so typos don't slip through silently.

### Images

Put your images and SVGs in `src/assets/visuals/` and reference them by file name (`visual: 1969.svg`). Astro optimises them at build time (resized WebP for raster images). SVGs are copied as they are.

## How to add a go_deeper item

Add an entry under `go_deeper:` in the day's file:

```yaml
go_deeper:
  - type: documentary        # book | film | documentary | podcast | article | place | archive
    title: "Title of the work"
    author: "Director or author"   # optional
    year: 1999                     # optional, year of the work
    language: en                   # two-letter ISO 639-1 code: en, it, fr, de, es, ru, ja…
    url: "https://…"               # optional
    note: "One sentence on why you recommend it."
```

It appears on the day, grouped by type, and on the **Go deeper** page, where it can be filtered by type, language, decade and theme.

## Validation

`npm run check` reads every `content/days/*.md` file.

**Errors** (the check fails, and so does the deploy):
- two days for the same year, a year outside 1900–2000, or a file name that doesn't match the year;
- a date that isn't real or isn't in its year;
- missing required fields, or unknown fields;
- a theme, go_deeper type, continent or status that isn't in the closed lists;
- a language that isn't a valid ISO 639-1 code;
- lat/lon missing or out of range;
- a `visual` file that doesn't exist.

**Warnings** (reported, but the check passes):
- a published day with no go_deeper items or no sources;
- the same URL used twice, anywhere on the site;
- a body outside 300–500 words, or a summary longer than 2 sentences;
- country names that differ only in case, spacing or accents.

The three `SAMPLE – …` days are fictional placeholders. They trigger two of the warnings on purpose. Delete them once you have real days.

## How to deploy

The site is static: `npm run build` produces `dist/`, which any static host can serve. The recommended setup is **Cloudflare Pages**. It's free, deploys on every push and serves `/1969/` at the domain root.

1. Put the project on GitHub:
   ```bash
   git init && git add -A && git commit -m "Initial commit"
   ```
   Then create an empty repository on GitHub and push to it.
2. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repository.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables: `SITE_URL` = your public URL (e.g. `https://twentieth-century.pages.dev`), and `NODE_VERSION` = `24`
4. Save. From now on every push to `main` deploys automatically. A day with validation errors stops the deploy, and the live site stays as it was.

`SITE_URL` is used for canonical links, the sitemap and Open Graph image URLs, so set it before sharing links.

**Netlify** works the same way: build `npm run build`, publish `dist`, same environment variables.
**GitHub Pages** also works, but project sites live under `/<repo-name>/`. You'd need a custom domain, or `base` set in `astro.config.mjs`.

## How it's built

```
content/days/          one Markdown file per day (the content)
content/day-template.md
src/schema.ts          data model + closed lists (single source of truth)
src/lib/validate.ts    validation rules (used by npm run check)
src/lib/geo.ts         Equal Earth projection, coastlines, centre of gravity
src/lib/camera.ts      map camera maths (shared by server and browser)
src/lib/stats.ts       all statistics
src/lib/og.ts          Open Graph image rendering
src/i18n/en.ts         every UI string
src/styles/tokens.css  every font, colour, size and duration
src/components/map/    map, scrubber, card + map-client.ts (interaction)
src/components/day/    day overlay, go_deeper list
src/components/charts/ stat blocks and charts
src/pages/             routes: /, /YYYY/, /go-deeper/, /stats/, /og/*.png, /sitemap.xml
scripts/               check.ts, test-check.ts
```

- **Map:** D3 (`d3-geo`) projects Natural Earth coastlines with Equal Earth at build time. There are no modern borders, labels or tiles. The browser only moves the camera (`d3-interpolate`'s `interpolateZoom`). A detailed 1:50m coastline loads lazily once you zoom in.
- **Days as overlays:** each `/YYYY/` is a real static page (so direct links, previews and search all work). Astro's `ClientRouter` keeps the map alive between pages, so opening a day only swaps the overlay.
- **Stats** are computed at build time and rendered without client JavaScript.

## Design

Styling is deliberately neutral. To restyle the site:
- `src/styles/tokens.css`: fonts, colours (map and charts included), spacing, motion;
- `src/i18n/en.ts`: all wording.

Open Graph images read their colours from the same tokens file.

## Adding Italian later

- Add `src/i18n/it.ts` with the same keys as `en.ts`. TypeScript flags any missing ones.
- Add `'it'` to `i18n.locales` in `astro.config.mjs`.
- Put translated days in `content/days/it/` as a second collection.
- Add pages under `src/pages/it/`.

The data model and components don't need to change.
