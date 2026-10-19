# Tech stack & conventions

## Stack

- **Astro 5** static site generator (`output: 'static'`). No SSR, no adapter.
- **Content collections** (`astro:content`) with Zod schemas in
  `src/content/config.ts` — the `file()` loader for `bookstores.json`, the
  `glob()` loader for `blog/**/*.{md,mdx}`.
- **MDX** (`@astrojs/mdx@^4`, Astro 5 compatible) so posts can embed components.
  The only embedded component is `YouTube.astro`, made available to every post
  without an import via `<Content components={{ YouTube }} />` in
  `blog/[slug].astro`. `new:post` scaffolds `.mdx`; plain `.md` posts still work.
- **Leaflet 1.9.4 + OpenStreetMap** raster tiles for the map. No API key, no
  billing. Loaded from a pinned unpkg URL with SRI integrity hashes.
- **Styling:** hand-written CSS custom properties (design tokens). No CSS
  framework, no Tailwind. Themes are plain `[data-theme]` CSS files.
- **Authoring scripts:** Node ESM (`.mjs`), Node built-ins only — no runtime
  dependencies beyond Astro's dev/build toolchain.
- **TypeScript:** `astro/tsconfigs/strict`. `@types/node` is a devDependency so
  the scripts/config type-check.

## Node / tooling

- Node 18.14+ (developed on Node 22). `.nvmrc` pins 22.
- npm (lockfile committed). CI uses `npm ci`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run preview:local` | Local dev server (hot reload). |
| `npm run build` | Static build into `dist/`. |
| `npm run preview` | Serve the built `dist/`. |
| `npm run check` | Astro type/content diagnostics (run after edits). |
| `npm run new:post` | Scaffold a blog article. |
| `npm run new:bookstore` | Add a store (auto-geocodes the address). |
| `npm run disable:bookstore` / `enable:bookstore` | Toggle a store's map pin. |
| `npm run geocode -- "<address>"` | OSM Nominatim lookup for lat/lng. |
| `npm run sync:events` | Pull aggregator events into `src/data/events.json`. |
| `npm run publish` | Build + git add/commit/push (git-free for the author). |
| `npm run update` | `git pull` wrapper with friendly output. |

## Verification

There is NO automated test suite. After any change:

1. `npm run build` — must complete; it fails on schema violations (e.g. an
   enabled store missing `lat`/`lng`).
2. `npm run check` — must report 0 errors.
3. For script edits, run the script against real input.

## Conventions & gotchas

- **Astro 5 content API.** Use `getCollection`, `getEntry`, and `render(entry)`
  (not the pre-v5 `entry.render()`). Blog/stored entry id is `entry.id`.
- **`withBase()` for internal links** in `.astro` files (GitHub Pages serves
  from a `/<repo>/` subpath). Markdown body links don't get this — keep that in
  mind for cross-page links written inside posts.
- **Nominatim needs real headers.** `scripts/geocode.mjs` sets a
  `Mozilla/5.0 …` User-Agent plus `Accept`/`Accept-Language`; a bare `fetch` is
  rejected with HTTP 403. Respect Nominatim's usage policy (low volume; it's an
  authoring-time call only).
- **SRI on map assets.** If you change the Leaflet version in `Map.astro`,
  recompute both SRI hashes (sha256, base64) for `leaflet.js` and `leaflet.css`.
- **GitHub Pages base path.** `astro.config.mjs` reads `SITE`/`BASE` env vars;
  the deploy workflow sets them from `actions/configure-pages`. For a user/org
  site or custom domain, set `BASE=/`.
- **No secrets, ever.** There is no `.env` requirement. Don't introduce
  API-keyed services; the whole point is a free, keyless static site.
