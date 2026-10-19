# Project structure & architecture

An **Astro 5** static site (`"type": "module"`, Node 18+). Content is
file-based: Markdown blog posts and a JSON bookstore index, validated by Astro
content collections. The map is the only client-side JavaScript island
(Leaflet). Authoring/publishing is a set of zero-dependency Node scripts under
`scripts/` (Node built-ins only).

## Layout

```
astro.config.mjs           site/base config (reads SITE/BASE env for Pages)
tsconfig.json              extends astro/tsconfigs/strict
package.json               npm scripts = the author's whole workflow
src/
  pages/
    index.astro            home: intro, featured stores, recent posts
    bookstores.astro       index: full map (all pins) + filterable cards
    bookstores/[id].astro  per-store detail: image, review, map pin, events, posts
    blog/index.astro       blog listing (every non-draft post)
    blog/[slug].astro      rendered article
    contact.astro          mailto "tell me about your bookstore"
  layouts/
    BaseLayout.astro       <html data-theme>, nav, theme switcher, viewport meta
  components/
    Map.astro              Leaflet + OSM map island (pinned CDN + SRI)
    BookstoreCard.astro    index/listing card
    YouTube.astro          MDX embed: parses any YT url/id, shorts vs wide
  content/
    config.ts              content-collection SCHEMAS (bookstores + blog)
    bookstores.json        THE data file: one record per store
    blog/*.{md,mdx}        one article per file (.mdx can embed <YouTube/>)
  data/
    events.json            committed EMPTY stub; sync:events overwrites locally
  lib/
    url.ts                 withBase() — prefix internal links with Astro base
    events.ts              aggregator bridge: map events -> store by sourceAliases
  styles/
    tokens.css             shared token NAMES + :root default
    global.css             base, mobile-first styles (reference tokens only)
    themes/{classic,zine,minimal}.css   full token sets per theme
public/
  favicon.svg
  images/bookstores/*      store photos (placeholder.svg shipped)
  images/blog/*            article hero images
scripts/
  lib.mjs                  shared helpers (slugify, args, prompt, paths)
  new-post.mjs             npm run new:post
  new-bookstore.mjs        npm run new:bookstore (geocodes the address)
  toggle-bookstore.mjs     npm run disable:/enable:bookstore
  geocode.mjs              npm run geocode (OSM Nominatim; also imported by new:bookstore)
  publish.mjs              npm run publish (build + git add/commit/push)
  update.mjs               npm run update (git pull wrapper)
  sync-events.mjs          npm run sync:events (pull aggregator output)
.github/workflows/deploy.yml   build + deploy to GitHub Pages
```

## Data flow

- **Build:** Astro loads `bookstores.json` and `blog/*.md` through the
  collections in `content/config.ts` (schema-validated). Pages query them with
  `getCollection` / `getEntry`. `bookstores/[id].astro` and `blog/[slug].astro`
  are generated via `getStaticPaths`.
- **Map:** `bookstores.astro` filters to `enabled` stores with numeric
  `lat`/`lng`, builds a `MapPin[]`, and passes it to `Map.astro`, which
  serializes it into a `data-map` attribute and hydrates Leaflet client-side.
- **Events bridge:** `lib/events.ts` dynamically imports `src/data/events.json`
  (always resolvable — a stub is committed) and matches events to a store by
  `sourceAliases` / name / location substring, filtered to upcoming.
- **Publish:** author runs `npm run publish` → `scripts/publish.mjs` builds, then
  `git add/commit/push` → GitHub Actions builds and deploys to Pages.

## Cross-cutting patterns & conventions

- **File-based content, schema-validated.** Add stores by editing
  `bookstores.json` (or `npm run new:bookstore`); add posts as Markdown. The
  schema in `content/config.ts` is the contract — a bad record fails the build.
- **`enabled`-aware validation.** The bookstore schema requires numeric
  `lat`/`lng` ONLY when `enabled` (via `superRefine`). Disabled stores may hold
  `null` coordinates. Keep this rule if you touch the schema.
- **Tokens, never hard-coded style.** Components reference CSS custom properties
  (`var(--color-bg)`, `var(--space)`, `var(--radius)`, `var(--card-shadow)`,
  etc.) only. A new theme is a new `[data-theme="…"]` file; never hard-code
  colors/fonts/spacing in a component. Swapping `data-theme` must reskin
  everything.
- **Mobile-first.** Base CSS targets phones; widen at `min-width` breakpoints.
  Keep ~44px tap targets, fluid type (`clamp()`), and the responsive map
  (`invalidateSize()` on resize/orientation).
- **Base-aware links.** Use `withBase()` from `lib/url.ts` for internal links in
  `.astro` files so they work under the Pages project subpath. (Markdown body
  links are a known gap — see README.)
- **Scripts are plain Node, git-hidden.** `scripts/*.mjs` use Node built-ins
  only (no deps). They assume the author doesn't know git: wrap git in friendly
  messages, never surface raw git errors.
- **Defensive external data.** Treat the aggregator's `events.json` and Nominatim
  responses as untrusted/variable: tolerate missing fields, fail soft (empty
  events, graceful geocode fallback) rather than break the build.
- **Pinned, tamper-evident map assets.** Leaflet CSS/JS load from a pinned CDN
  version with SRI hashes in `Map.astro`. If you bump the version, recompute the
  SRI hashes.

## Verification (no automated test suite)

- After any change: `npm run build` and `npm run check` (Astro diagnostics).
- For script changes: run the script (e.g.
  `npm run new:bookstore -- --name … --address …`, `npm run geocode -- "…"`).
- When touching the published output, confirm no PII/secrets leak — there are
  none by design; keep it that way.

## Housekeeping

- Do not commit generated artifacts: `dist/`, `.astro/`, `node_modules/`.
- `src/data/events.json` is committed as an EMPTY stub on purpose (the dynamic
  import must resolve). `npm run sync:events` overwrites it locally; only commit
  real synced data if you want events in the published site.
