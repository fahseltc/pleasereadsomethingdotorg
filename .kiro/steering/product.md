# Please Read Something

A static website for **Front Range independent bookstore reviews**, hosted free
on GitHub Pages. Built so a non-technical author can add content with plain
`npm run` commands and never touch git or a database.

## Core value

- **Bookstore index + map:** every reviewed shop is a card (image, name,
  review, address, directions link) and a pin on an interactive Leaflet /
  OpenStreetMap map. Tap a pin to read the review.
- **Blog:** Markdown articles. A post can be about a specific store (cross-linked
  to its pin) or standalone (news, roundups) — both list the same way.
- **Contact:** a "tell me about your bookstore" page (a `mailto:` template; no
  backend, no stored submissions).
- **Zero running cost / no secrets:** no server, no database, no API keys. The
  map needs no billing. Everything is committed files built to static HTML.

## Key domain concepts

- **Bookstore (first-class entity):** one record in
  `src/content/bookstores.json` with a stable `id` (slug). It owns the map pin
  (`lat`/`lng`, pre-geocoded at authoring time), the review, address,
  tags, and `sourceAliases` (see the aggregator bridge).
- **`enabled` flag:** the map/index toggle. `enabled: false` hides a store (no
  pin, no card) without deleting it — e.g. a closed shop, or one still missing
  coordinates. Enabled stores MUST have numeric `lat`/`lng` (build-enforced).
- **Blog post `bookstore` field:** optional reference to a store `id`. Present =
  cross-linked both ways; absent = standalone post that still lists.
- **Theme vs. color mode:** a *theme* (`classic`/`zine`/`minimal`) is a full
  visual reskin via CSS custom properties under `data-theme`; *color mode*
  (`data-mode` light/dark) is an optional layer within a theme. Full reskins,
  not just dark mode.

## Relationship to book-events-aggregator

The sibling `book-events-aggregator` repo crawls bookstore event pages into
`output/events.json`. `npm run sync:events` copies that into
`src/data/events.json`; store detail pages then show matching upcoming events,
mapped to a store via its `sourceAliases` (and a name/location substring
fallback). The bridge is **optional and additive**: the committed
`src/data/events.json` is an empty stub, the aggregator schema is never changed,
and the site builds fine with no events synced.

## Authoring workflow (git-free, by design)

The author is assumed NOT to use git. Everything is an npm command:

1. `npm run new:post` / `npm run new:bookstore` — scaffold content (bookstore
   add includes automatic geocoding of the address).
2. Edit the generated file(s), add images under `public/images/`.
3. `npm run dev` — preview locally.
4. `npm run publish` — builds as a safety check, then stages/commits/pushes for
   them (triggering the Pages deploy). All git output is wrapped in plain
   language. `npm run update` wraps `git pull`.

Also: `npm run disable:bookstore` / `enable:bookstore` toggle a pin without
editing JSON; `npm run geocode -- "<address>"` re-checks coordinates.

## Build & run

- Node 18+ (developed on Node 22). Astro 5.
- `npm run dev` — local dev server.
- `npm run build` — static build into `dist/`.
- `npm run check` — Astro type/content diagnostics.
- Deploys automatically to GitHub Pages via `.github/workflows/deploy.yml` on
  push to `main`.

## Privacy stance

No comments, no visitor submissions, no analytics. A theme choice (if the
visitor uses the switcher) is kept in `localStorage` on-device only. The only
external runtime call is OpenStreetMap tile fetches (attribution shown).
