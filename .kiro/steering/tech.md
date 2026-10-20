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
  framework, no Tailwind. Themes are plain `[data-theme]` CSS files; only
  `classic.css` is imported/active (zine/minimal exist but are not loaded). The
  header has a light/dark toggle only — no theme-picker dropdown.
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
| `npm run new:library` | Add a library (same flow, writes libraries.json). |
| `npm run disable:bookstore` / `enable:bookstore` | Toggle a store's map pin. |
| `npm run disable:library` / `enable:library` | Toggle a library's map pin. |
| `npm run geocode -- "<address>"` | OSM Nominatim lookup for lat/lng. |
| `npm run sync:events` | Pull aggregator events into `src/data/events.json` (events bridge is currently DISABLED — see events.ts flag — so this has no visible effect). |
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
- **`withBase()` for internal links** in `.astro` files. The site currently
  serves from the root of a custom domain (`base: '/'`), so this is effectively
  a no-op today — but keep using it so links survive a move back to a project
  subpath. Markdown/MDX body links don't get `withBase()`; fine at `base: '/'`.
- **Nominatim needs real headers.** `scripts/geocode.mjs` sets a
  `Mozilla/5.0 …` User-Agent plus `Accept`/`Accept-Language`; a bare `fetch` is
  rejected with HTTP 403. Respect Nominatim's usage policy (low volume; it's an
  authoring-time call only).
- **SRI on map assets.** If you change the Leaflet version in `Map.astro`,
  recompute both SRI hashes (sha256, base64) for `leaflet.js` and `leaflet.css`.
- **GitHub Pages / custom domain.** Served from `pleasereadsomething.org` at the
  root. `astro.config.mjs` pins `site: 'https://pleasereadsomething.org'` and
  `base: '/'` (env `SITE`/`BASE` can still override for one-off builds). The
  deploy workflow deliberately does NOT feed `actions/configure-pages` base_path
  into the build (it would inject a wrong `/<repo>/` subpath). `public/CNAME`
  holds the domain so it persists across deploys.
- **No secrets, ever.** There is no `.env` requirement. Don't introduce
  API-keyed services; the whole point is a free, keyless static site.
- **Analytics: GoatCounter (cookieless, keyless).** The count script is loaded
  in `BaseLayout.astro` (endpoint `GOATCOUNTER_ENDPOINT`, a public value — no
  key). Pageviews are automatic; `BookshopLink.astro` fires a custom
  `buy-click/<isbn>` event via `window.goatcounter.count({ event: true })`. It's
  cookieless/no-consent, so it stays within the privacy stance. Currently enabled
  in dev too; gate with `import.meta.env.PROD` to exclude local runs later. Fire
  more events with the same one-line pattern (e.g. outbound/directions clicks).
