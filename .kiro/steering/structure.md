# Project structure & architecture

An **Astro 5** static site (`"type": "module"`, Node 18+). Content is
file-based: Markdown blog posts and a JSON bookstore index, validated by Astro
content collections. The map is the only client-side JavaScript island
(Leaflet). Authoring/publishing is a set of zero-dependency Node scripts under
`scripts/` (Node built-ins only).

## Layout

```
astro.config.mjs           site/base pinned for custom domain (base '/'); + mdx() + sitemap()
tsconfig.json              extends astro/tsconfigs/strict
package.json               npm scripts = the author's whole workflow
src/
  pages/
    index.astro            home: intro, upcoming events, latest stores + posts
    bookstores.astro       index: full map (all pins) + filterable cards
    bookstores/[id].astro  per-store detail: image, review, map pin, events, posts
    blog/index.astro       blog listing (every non-draft post)
    blog/[slug].astro      rendered article
    contact.astro          mailto "tell me about your bookstore"
    events.astro           all upcoming events (month groups) + Event JSON-LD
    libraries.astro        library index (map + cards)
    libraries/[id].astro   per-library detail (mirrors bookstores/[id])
    404.astro              custom not-found page (emitted as dist/404.html)
  layouts/
    BaseLayout.astro       <html data-theme="classic">, nav, light/dark toggle, viewport meta
  components/
    Map.astro              Leaflet + OSM map island (pinned CDN + SRI)
    BookstoreCard.astro    index/listing card
    NearbyStores.astro     "More <kind> in <city>" / "Nearby <kind>" list on detail pages
    YouTube.astro          MDX embed: parses any YT url/id, shorts vs wide
  content/
    config.ts              content-collection SCHEMAS (bookstores + blog)
    bookstores.json        THE data file: one record per store
    blog/*.{md,mdx}        one article per file (.mdx can embed <YouTube/>)
  data/
    events.json            synced aggregator events (sync:events locally, CI before build)
    youtube-shorts.json    channel Shorts (id, title, publishedAt, url); refreshed by sync-youtube at build
  lib/
    url.ts                 withBase() — prefix internal links with Astro base
    events.ts              aggregator bridge: map events -> store by sourceAliases
    jsonld.ts              schema.org JSON-LD builders + address parser (see SEO below)
    seo.ts                 snippet(): word-boundary meta-description trimming
    nearby.ts              nearest-place ranking (haversine on lat/lng) + cityOf()
  styles/
    tokens.css             shared token NAMES + :root default
    global.css             base, mobile-first styles (reference tokens only)
    themes/{classic,zine,minimal}.css   token sets per theme (only classic is imported)
public/
  robots.txt               allows all; points at sitemap-index.xml
  CNAME                    custom domain (pleasereadsomething.org); copied into dist
  favicon.svg
  images/bookstores/*      store photos (placeholder.svg shipped)
  images/blog/*            article hero images
scripts/
  lib.mjs                  shared helpers (slugify, args, prompt, paths)
  new-post.mjs             npm run new:post
  new-bookstore.mjs        npm run new:bookstore (geocodes the address)
  new-library.mjs          npm run new:library (same flow -> libraries.json)
  toggle-entry.mjs         npm run disable:/enable:bookstore and :library
  geocode.mjs              npm run geocode (OSM Nominatim; also imported by new:bookstore)
  publish.mjs              npm run publish (build + git add/commit/push)
  update.mjs               npm run update (git pull wrapper)
  sync-events.mjs          npm run sync:events (pull aggregator output)
  sync-youtube.mjs         npm run sync:youtube (YouTube Data API -> Shorts list; runs first in npm run build)
.github/workflows/deploy.yml   build + deploy to GitHub Pages
```

## Data flow

- **Build:** Astro loads `bookstores.json` and `blog/**/*.{md,mdx}` through the
  collections in `content/config.ts` (schema-validated). Pages query them with
  `getCollection` / `getEntry`. `bookstores/[id].astro` and `blog/[slug].astro`
  are generated via `getStaticPaths`.
- **Map:** `bookstores.astro` filters to `enabled` stores with numeric
  `lat`/`lng`, builds a `MapPin[]`, and passes it to `Map.astro`, which
  serializes it into a `data-map` attribute and hydrates Leaflet client-side.
- **Events bridge (ENABLED):** `lib/events.ts` dynamically imports
  `src/data/events.json` (always resolvable) and matches events to a store by
  `sourceAliases` / name / location substring, filtered to upcoming. The flag
  `eventsFeature.disabled` is `false`; set it to `true` to hide events
  site-wide. CI runs the aggregator before building, so events are only as
  fresh as the last deploy (there is no scheduled rebuild yet).
- **YouTube Shorts:** `npm run build` runs `scripts/sync-youtube.mjs` first. It
  calls the YouTube Data API (key from `YOUTUBE_API_KEY`) and rewrites
  `src/data/youtube-shorts.json`. If the key is missing or the API fails, it
  keeps the last file and the build still runs.
- **Publish:** author runs `npm run publish` → `scripts/publish.mjs` builds, then
  `git add/commit/push` → GitHub Actions builds and deploys to Pages.

## SEO (automatic for new content)

- **Sitemap + robots:** `@astrojs/sitemap` (in `astro.config.mjs`) writes
  `sitemap-index.xml` at build; `public/robots.txt` points to it. The 404 page
  is excluded automatically.
- **Head tags:** `BaseLayout.astro` emits a canonical URL, `og:*`,
  `twitter:card`, and a site-default description when a page passes none.
  Optional props: `image` (og:image, defaults to the logo), `ogType`
  (`article` for posts), `jsonLd` (object or array).
- **Structured data:** `lib/jsonld.ts` builds BookStore/Library (address split
  into a PostalAddress by `parseAddress`, plus geo), Article (links its
  store/library via `about`), Event (venue from a matched store, else the
  feed's text), BreadcrumbList, and WebSite/Organization on the home page. Pages
  build it from fields they already have, so no extra authoring is needed.
  `parseAddress` uses a `CITIES` list for addresses with no comma before the
  city; add new cities there. Reviews/ratings are deliberately NOT marked up.
- **Descriptions:** store/library pages use `snippet(review)`; posts use their
  `description` frontmatter.
- **Nearby links:** `NearbyStores.astro` + `lib/nearby.ts` list the 4 nearest
  other enabled stores (or libraries) within 30 miles, by lat/lng rather than
  city name. The heading reads "More <kind> in <city>" only when every listed
  place is in that city.
- **Not done yet:** compressed images / per-page og:image, a scheduled rebuild,
  area landing pages, and alt text + image dimensions everywhere.

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
  `.astro` files. The site serves from a custom-domain root (`base: '/'`), so
  this is a no-op today, but keep it for portability back to a subpath. Markdown/
  MDX body links don't get `withBase()` — fine at `base: '/'`.
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
- `src/data/events.json` must always exist (the dynamic import must resolve).
  It is committed with real synced events; `npm run sync:events` overwrites it
  locally and CI regenerates it before each deploy.
