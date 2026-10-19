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
- **Theme + color mode:** styling is driven by CSS custom properties (design
  tokens) under `data-theme`. The site uses one active theme, **classic**
  (`src/styles/themes/classic.css`); `zine`/`minimal` files exist but are not
  loaded. The header exposes only a light/dark **color mode** toggle
  (`data-mode`), persisted in `localStorage`. A theme is a full reskin (colors,
  fonts, spacing, shape) — not just dark mode — but there is no in-page theme
  picker.

## Relationship to book-events-aggregator

The sibling `book-events-aggregator` repo crawls bookstore event pages into
`output/events.json`. There's an optional bridge that can list a store's
upcoming events on its detail page — `npm run sync:events` copies the aggregator
output into `src/data/events.json`, and events are matched to a store via its
`sourceAliases` (plus a name/location substring fallback).

**This bridge is currently DISABLED** via a feature flag (`eventsFeature.disabled
= true` in `src/lib/events.ts`): no events render anywhere, even if synced. All
the wiring is intentionally left in place; flip the flag to re-enable. The bridge
is additive — the committed `src/data/events.json` is an empty stub and the
aggregator schema is never changed, so the site builds fine regardless.

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

No comments, no visitor submissions, no analytics. The visitor's light/dark
choice is kept in `localStorage` on-device only. The only external runtime calls
are OpenStreetMap tile fetches (attribution shown) and any YouTube embeds a post
includes (loaded from youtube-nocookie.com).
