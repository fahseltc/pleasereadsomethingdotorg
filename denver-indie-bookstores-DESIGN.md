# Denver Indie Bookstores — Site Design Doc

A static website for **Denver-area independent bookstore reviews**, hosted on
GitHub Pages. It has a blog, a curated index of bookstores (each with an image,
description/review, address, and map link), an interactive map with pins for
every reviewed bookstore, and a "contact / tell me about your bookstore" page.

The site is intentionally static: no server, no database, no runtime API calls.
All content lives as files in the repo (Markdown for articles, JSON for
bookstores), the map renders client-side, and GitHub Actions builds and
publishes the site.

---

## 1. Goals & scope

**In scope**

1. **Blog** — a place to add articles (Markdown files), with templated
   front-matter so the author knows exactly what to fill in.
2. **Indie bookstore index** — a browsable list of Denver-local bookstores,
   each with image, name, description/review, rating, address, and a maps link.
3. **Map** — Leaflet + OpenStreetMap, showing all reviewed bookstores as pins,
   popups linking to each bookstore's detail page. No API key, no billing.
4. **Contact page** — "tell me about your bookstore" / contact the author.
5. **Simple npm commands** that walk the author through creating a new blog post
   or adding a new bookstore (scaffolding + templating + telling them where the
   file landed and what metadata to fill in).

**Out of scope**

- No comments anywhere on the site.
- No visitor-submitted reviews, no runtime write access.
- No runtime geocoding — coordinates are pre-filled at authoring time and
  committed.
- No account-gated map provider (so no Google Maps by default).

**Hosting constraint:** everything must build to static files publishable by
GitHub Pages. The only "backend" is a GitHub Actions build step.

---

## 2. Technology choices

| Concern | Choice | Why |
|---|---|---|
| Site generator | **Astro** (Eleventy is the fallback) | First-class Markdown/content collections, type-checked data, trivial static output, clean component model for the map. |
| Map | **Leaflet + OpenStreetMap tiles** | Free, open source, no API key, no billing. Best fit for a hobby/static site. |
| Geocoding | **Pre-geocode at build/authoring time** | Store `lat`/`lng` in the bookstore data file. No runtime API calls, nothing to break for visitors. |
| Blog content | **Markdown files** with front-matter | Easy to write, versioned in git, templated by a scaffolding script. |
| Bookstore data | **JSON data file** (one record per store) | Drives both the index listing and the map pins from a single source of truth. |
| Styling / theming | **CSS custom properties (design tokens) under `data-theme`**, optionally organized with **Open Props** | Swap the whole look by changing one attribute or importing a different token file. No lock-in. See §13. |
| Responsive | **Mobile-first CSS**, fluid layout, responsive Leaflet map | The site is checked mostly on phones; map + reviews must work at small widths. See §13. |
| Deploy | **GitHub Pages via GitHub Actions** | Zero hosting cost, builds on push to `main`. |

### Astro vs. Eleventy

Both deploy to GitHub Pages cleanly and both satisfy every requirement. Astro is
the recommendation because its **content collections** give schema-validated
front-matter and typed JSON data out of the box (a build fails loudly if a
bookstore is missing `lat`/`lng`), which pairs well with the "templated so the
author knows what to fill in" requirement. Eleventy is the fallback if a
simpler, zero-config-feeling pipeline is preferred — the data model and scripts
below are generator-agnostic.

---

## 3. Relationship to `book-events-aggregator`

The existing `book-events-aggregator` repo crawls bookstore/event pages and
emits events whose `location` is a **free-text string** (bookstore name +
address) with a `source` label — e.g.:

```json
{
  "title": "Author Talk",
  "start": "2026-10-23T18:00:00",
  "location": "Boulder Bookstore, 1107 Pearl St, Boulder, CO 80302",
  "url": "https://boulderbookstore.net/events/calendar",
  "source": "Boulder Bookstore",
  "extractor": "jsonld"
}
```

Those events are **tied to the same bookstores** this site reviews and pins on
the map. The design goal is a shared vocabulary so events and reviews line up on
both the map layer and the blog layer.

**Design decision: the bookstore becomes the first-class entity.** In the
aggregator, the store is implied by a `location`/`source` string. Here, each
bookstore gets a stable `id` (a slug) and owns its geocoded pin. Events then
*reference* a bookstore by `id` instead of repeating its address, which:

- lets a single pin on the map show both the review **and** upcoming events;
- removes the need to geocode the aggregator's free-text `location` strings;
- keeps the aggregator's output unchanged — we add an optional, additive
  mapping rather than rewriting its schema.

### Bridging the two

The aggregator keeps emitting `output/events.json` exactly as today. This site
maps each event's `source`/`location` to a bookstore `id` via a small lookup
(`sourceAliases` on each bookstore record — see §4). Events whose source matches
a known bookstore surface on that store's detail page and (optionally) as a pin
badge; unmatched events are simply ignored by this site. Nothing in the
aggregator has to change, and the site degrades gracefully if the events file is
absent.

---

## 4. Data model

A single JSON file is the source of truth for the index **and** the map. The
shape is a superset of the fields the user sketched (`name`, `address`, `lat`,
`lng`, `rating`, `review`, `tags`), extended with the fields the pages need
(image, slug id, maps link) and the aggregator bridge (`sourceAliases`).

### `src/content/bookstores.json` (or one file per store)

```json
[
  {
    "id": "boulder-bookstore",
    "name": "Boulder Bookstore",
    "image": "/images/bookstores/boulder-bookstore.jpg",
    "address": "1107 Pearl St, Boulder, CO 80302",
    "lat": 40.0190,
    "lng": -105.2810,
    "rating": 4,
    "review": "Three floors of new and used on the Pearl Street Mall. Strong local-author section; the staff picks shelf is reliably good.",
    "tags": ["used", "events", "pearl-street"],
    "website": "https://boulderbookstore.net/",
    "mapsLink": "https://www.google.com/maps/search/?api=1&query=1107+Pearl+St+Boulder+CO+80302",
    "sourceAliases": ["Boulder Bookstore"],
    "enabled": true
  }
]
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable slug; the detail page URL (`/bookstores/<id>`) and the key events reference. |
| `name` | yes | Display name. |
| `image` | yes | Path to the store photo under `public/images/bookstores/`. |
| `address` | yes | Street address (also shown on the index + detail page). |
| `lat`, `lng` | yes (if `enabled`) | Pre-geocoded coordinates for the map pin. Filled in by the `new:bookstore` command. Build fails if an **enabled** store is missing them; a disabled store may leave them `null`. |
| `rating` | no | 1–5; shown as stars on the index and detail page. |
| `review` | yes | The description/review body (short form; long form can live in a linked blog post). |
| `tags` | no | Free-form labels for filtering the index (e.g. `used`, `cafe`, `rare`). |
| `website` | no | The store's own site. |
| `mapsLink` | no | Deep link to Google/Apple/OSM maps for directions. Auto-generated from `address` if omitted. |
| `sourceAliases` | no | Strings that match the aggregator's `source`/`location` so its events attach to this store. |
| `enabled` | no (default `true`) | **Map toggle.** When `false`, the store drops off the map (no pin) and out of the index listing, without deleting the record — mirrors how `book-events-aggregator` uses `enabled`. Useful for a store that's closed, unverified, or still missing coordinates. |

**`mapsLink` note:** this is just a URL to an external maps app for directions —
it does **not** require a Google API key or account. It coexists with the
Leaflet/OSM map, which is what actually renders the pins.

### Blog post front-matter — `src/content/blog/<slug>.md`

```markdown
---
title: "Why I started reviewing Denver's indie bookstores"
description: "A short summary used for previews and SEO."
pubDate: 2026-10-15
author: "Your Name"
heroImage: "/images/blog/intro.jpg"   # optional
tags: ["meta", "denver"]               # optional
bookstore: "boulder-bookstore"         # optional: link this post to a store id
draft: false                           # true keeps it out of the build
---

Write the article body here in Markdown.
```

The `bookstore` field is **optional**. When set, it cross-links the article to a
store so the store's detail page can list "related articles" and the article can
link back to the pin. When **omitted**, the post is a standalone article (news,
a roundup, an opinion piece, an event recap) that isn't about any single store —
these still appear in the main blog listing exactly like store-linked posts.
Store association only adds the cross-link; it is never required for a post to be
published or listed.

---

## 5. Repo structure

```
denver-indie-bookstores/
  astro.config.mjs
  package.json
  src/
    pages/
      index.astro            # home: intro + featured stores + recent posts
      bookstores.astro       # index list + embedded map (all pins)
      bookstores/[id].astro  # per-store detail: image, name, review, address, map link, related events/posts
      blog/index.astro       # blog listing
      blog/[slug].astro      # rendered article
      contact.astro          # "tell me about your bookstore" / contact
    components/
      Map.astro              # Leaflet map, reads bookstores.json -> pins
      BookstoreCard.astro    # index/listing card (image, name, rating, snippet)
      Rating.astro           # star rating
    content/
      config.ts              # Astro content-collection schemas (validate front-matter + bookstore JSON)
      bookstores.json        # THE data file: one record per store (§4)
      blog/
        *.md                 # one Markdown file per article
    layouts/
      BaseLayout.astro
    data/
      events.json            # optional copy/symlink of aggregator output for related-events (gitignored or synced)
  public/
    images/
      bookstores/*.jpg       # store photos referenced by `image`
      blog/*.jpg             # article hero images
  scripts/
    new-post.mjs             # `npm run new:post` — scaffold a blog article
    new-bookstore.mjs        # `npm run new:bookstore` — add a store to the index
    geocode.mjs              # optional helper: address -> lat/lng at authoring time
    sync-events.mjs          # optional: pull aggregator output/events.json into src/data/
  .github/
    workflows/
      deploy.yml             # build + publish to GitHub Pages
  README.md
```

---

## 6. Authoring workflow (npm commands)

The requirement: simple npm-based commands that step the author through creating
content, tell them where the new file is, and template it well so they know what
to write where and what metadata to fill in manually.

**Assume the author does not use git from the command line.** Every step they
need — scaffolding a post, adding a store (including geocoding), previewing, and
**publishing the live site** — is a plain `npm run <something>` command. The git
operations that actually ship a change (stage, commit, push, which triggers the
GitHub Actions deploy in §9) are wrapped behind an npm command so the author
never types a git command themselves. The intended loop is:

1. `npm run new:post` or `npm run new:bookstore` to create/scaffold content.
2. Edit the generated file(s) in their editor and add any images.
3. `npm run preview:local` to see it locally (optional but encouraged).
4. `npm run publish` to put it live — this is the command that does the git work
   for them.

### `npm run new:post`

Interactive (or arg-driven) scaffold for a blog article.

- Prompts for: title, (optional) description, author, tags, linked bookstore id.
- Slugifies the title into `src/content/blog/<slug>.md`.
- Writes the file with the full front-matter block from §4, each field
  commented with a one-line hint, `pubDate` pre-filled to today, `draft: true`.
- Prints the exact path it created and a reminder of what to fill in:
  > Created `src/content/blog/why-i-started.md`. Fill in the body below the
  > front-matter. Set `draft: false` when ready to publish. Drop a hero image in
  > `public/images/blog/` and reference it as `heroImage`.

Example: `npm run new:post -- --title "My first review" --author "Me"`

### `npm run new:bookstore`

Interactive (or arg-driven) scaffold that appends a new record to
`bookstores.json`.

- Prompts for: name, address, rating, short review, tags, website.
- Derives `id` (slug) from the name; warns if the id already exists.
- **Geocoding is a built-in step of adding a store** (not a separate chore). The
  command takes the address the author just entered and runs an OSM/Nominatim
  lookup (`scripts/geocode.mjs`) to fill `lat`/`lng` automatically, then shows
  the result so the author can confirm the pin looks right. If the lookup is
  offline, rate-limited, or ambiguous (multiple matches), it:
  - lists the candidate matches and lets the author pick one, or
  - writes a clearly-marked `"lat": null, "lng": null` placeholder **and sets
    `"enabled": false`** so the store doesn't ship a broken/missing pin, then
    tells the author how to fix it (re-run, pick a match, or paste coordinates).
  This keeps geolocation part of the add flow while never blocking the author or
  shipping a store with no location.
- Sets `enabled: true` by default (or `false` when coordinates couldn't be
  resolved — see above). The author can flip `enabled` later to show/hide the
  store on the map without deleting it.
- Auto-generates `mapsLink` from the address.
- Reminds the author to add the photo and confirm the pin:
  > Added **Boulder Bookstore** to `src/content/bookstores.json` (id
  > `boulder-bookstore`). I looked up the address and set the map pin to
  > `40.0190, -105.2810` — open the preview to confirm it's in the right spot.
  > Add a photo at `public/images/bookstores/boulder-bookstore.jpg`. To hide
  > this store from the map/index for now, set `"enabled": false`.

Example: `npm run new:bookstore -- --name "Boulder Bookstore" --address "1107 Pearl St, Boulder, CO 80302"`

### `npm run disable:bookstore` / `npm run enable:bookstore`

Convenience toggles so hiding or showing a store on the map doesn't require
hand-editing JSON (and doesn't need git knowledge). Each takes a store `id` (or
prompts with a pickable list), flips the record's `enabled` flag in
`bookstores.json`, and prints what changed:

> `boulder-bookstore` is now **hidden** — it won't appear on the map or in the
> index. Run `npm run publish` to make this live.

Example: `npm run disable:bookstore -- boulder-bookstore`

### Publishing without git (`npm run publish`)

The author never touches git. `npm run publish` (backed by
`scripts/publish.mjs`) does the whole ship-it step for them:

1. Optionally runs `npm run build` first as a safety check so a broken site is
   caught locally before going live (a failed build stops the publish with a
   plain-English message).
2. Stages the changed content (new/edited Markdown, `bookstores.json`, images).
3. Commits with an auto-generated message (e.g.
   `Add bookstore: Boulder Bookstore` or `New post: My first review`), or a
   message the author passes with `-- -m "…"`.
4. Pushes to `main`, which triggers the GitHub Actions deploy in §9.
5. Prints a plain-language result and the live URL:
   > Published. Your changes are building now and will be live at
   > `https://<user>.github.io/<repo>/` in a minute or two.

If the push fails because the repo changed elsewhere, the command explains it in
non-git terms and offers `npm run update` (below) rather than surfacing raw git
errors.

### Keeping a local copy current (`npm run update`)

For authors working across two machines (or after editing files directly on
GitHub), `npm run update` wraps `git pull` so they can refresh their local copy
with one friendly command before writing. It reports plainly whether anything
changed and, if there's a conflict it can't resolve automatically, tells the
author to ask for help rather than dumping git output.

### Other scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run preview:local` | Local Astro dev server with hot reload — the author's "see it before publishing" command. Run by the user, not in CI. |
| `npm run build` | Static build into `dist/` (also run automatically inside `publish`). |
| `npm run geocode -- "<address>"` | Look up `lat`/`lng` for an address (OSM/Nominatim) — used inside `new:bookstore`, also callable alone to re-check a pin. |
| `npm run sync:events` | Optional: copy `../book-events-aggregator/output/events.json` into `src/data/` so detail pages can show related events. |

Pre-geocoding stays an **authoring-time** step: coordinates are resolved when the
store is added and then committed, so the published site makes zero geocoding
calls and visitors load nothing extra.

---

## 7. The map

`src/components/Map.astro` renders a Leaflet map centered on Denver and drops one
marker per **enabled** bookstore read from `bookstores.json`:

- Tiles: OpenStreetMap raster tiles (`https://{s}.tile.openstreetmap.org/...`),
  with the required OSM attribution shown. No key, no billing.
- **Disabled stores are skipped.** A record with `"enabled": false` (or without
  resolved `lat`/`lng`) gets no pin and no index card, so the author can hide a
  store without deleting it — the same `enabled` toggle used by the
  `disable:bookstore` / `enable:bookstore` commands.
- Each marker's popup shows the store name, thumbnail, rating, and a link to its
  detail page (`/bookstores/<id>`).
- The map appears on `bookstores.astro` (all pins) and, zoomed to a single pin,
  on each store's detail page.
- Leaflet's CSS/JS are pinned to a specific version (self-hosted or a pinned CDN
  URL with SRI) so builds are reproducible and offline-friendly.

Because pins come straight from the committed data file, the map needs no server
and no runtime lookups.

---

## 8. Pages

- **Home (`/`)** — short intro, a few featured bookstores, recent blog posts, a
  link into the full map.
- **Bookstores (`/bookstores`)** — the index: filterable cards (by `tags`) plus
  the full map with all pins.
- **Bookstore detail (`/bookstores/<id>`)** — image, name, star rating,
  review/description, address + maps link, a single-pin map, related blog posts
  (`bookstore` front-matter) and related upcoming events (from the aggregator
  bridge, if present).
- **Blog (`/blog`, `/blog/<slug>`)** — article listing and rendered posts. The
  listing shows **every** non-draft post, whether or not it's tied to a store.
  Store-linked posts can show a small "about <store>" tag and link to the pin;
  standalone posts (no `bookstore` field) list the same way, just without that
  tag. A post is never hidden for lacking a store association.
- **Contact (`/contact`)** — "tell me about your bookstore" / contact the
  author. Since the site is static with no comments and no backend, this is
  either a `mailto:` link or a third-party form embed (e.g. Formspree) — no
  server code and no stored submissions in the repo.

---

## 9. Deployment (GitHub Pages via Actions)

`.github/workflows/deploy.yml`:

1. Trigger on push to `main`.
2. `actions/checkout`, set up Node 18+, `npm ci`.
3. `npm run build` → `dist/`.
4. Upload `dist/` with `actions/upload-pages-artifact` and publish via
   `actions/deploy-pages`.

Set Astro's `site` and `base` in `astro.config.mjs` to the Pages URL (project
sites are served from `https://<user>.github.io/<repo>/`, so `base` must match
the repo name unless a custom domain is used).

---

## 10. Build-time validation

Astro content collections (`src/content/config.ts`) enforce the schemas so bad
data fails the build instead of shipping broken pages:

- Every bookstore must have `id`, `name`, `image`, `address`, `review`. For an
  **enabled** store, `lat`/`lng` must be numbers (catches the `null` geocode
  placeholders before they reach production); a **disabled** store may leave
  them `null`, since it ships no pin. `enabled` defaults to `true` when absent.
- Every blog post must have `title`, `pubDate`; `draft: true` posts are excluded
  from the production build.
- `bookstore` references in posts and `sourceAliases` collisions can be checked
  by a small build-time assertion.

---

## 11. Privacy / safety

- No comments, no visitor submissions, no analytics required.
- Theme choice (if a toggle is added) is stored in `localStorage` on-device only
  — no tracking, no consent banner needed.
- The contact page uses `mailto:` or a third-party form; nothing is persisted in
  the repo.
- OSM tile usage follows the OpenStreetMap tile usage policy (reasonable traffic,
  attribution shown); if traffic grows, switch to a free-tier vector tile host
  without changing the data model.

---

## 12. Mobile-friendliness & styling / theming

### Mobile-first & responsive

The site is assumed to be viewed mostly on phones (people check a bookstore map
and reviews on the go), so layout is **mobile-first**: base styles target small
screens and progressively enhance at wider breakpoints via `min-width` media
queries.

- **Viewport & fluid layout** — set `<meta name="viewport" content="width=device-width, initial-scale=1">`
  in `BaseLayout.astro`; use a single fluid column on phones, expanding to a
  grid of `BookstoreCard`s at larger widths (CSS grid with `auto-fit`/`minmax`).
- **Responsive map** — the Leaflet map container uses a fluid width and a
  viewport-relative height (e.g. `height: 60vh` capped with `max-height`), and
  calls `map.invalidateSize()` on resize/orientation change so tiles re-layout.
  Markers/popups and the attribution control stay usable at phone widths.
- **Touch targets & type** — minimum ~44px tap targets for nav and pins/popup
  links; fluid type (`clamp()`) so headings scale without horizontal scroll.
- **Images** — store/hero images use responsive `width`/`height` + `srcset` (or
  Astro's `<Image>`), `loading="lazy"` below the fold, to keep phone data light.
- **No horizontal scroll** — content max-width + `box-sizing: border-box`
  everywhere; test at 320px.
- **Verification** — check each page at 320px, 768px, and desktop widths; the
  map, the bookstore index, and a blog post are the three to confirm.

Astro ships no runtime JS by default, so pages are light on mobile out of the
box; only the map island hydrates.

### Swappable styles (theming)

Requirement: swap the site's look fairly easily. **This means full visual
reskins, not just a light/dark color toggle** — a theme can change color
palette, fonts, type scale, spacing/density, border radius, borders vs.
shadows, button and card shapes, even layout accents. Light vs. dark is just the
narrowest case of the same mechanism.

Two independent axes, both driven by the same token system:

- **Theme** — the whole look (palette + typography + spacing + shape). e.g.
  `classic`, `zine`, `minimal`. This is the "swap styles" requirement.
- **Color mode** — light vs. dark *within* a theme (optional per theme).

The mechanism that fits a static Astro site best is **design tokens expressed as
CSS custom properties**, selected by a `data-theme` attribute on `<html>`
(optionally plus `data-mode` for light/dark). A theme is a full set of token
values across every design dimension — not only colors — so swapping is changing
one attribute or importing a different token file, with no component rewrites.

```css
/* Each theme sets the FULL token set: color, type, spacing, shape — not just colors. */

/* "classic" — warm, serif, generous spacing, soft corners */
[data-theme="classic"] {
  --color-bg: #faf7f2;
  --color-fg: #1b1b1b;
  --color-accent: #7a4a2b;
  --font-body: "Georgia", serif;
  --font-heading: "Georgia", serif;
  --text-scale: 1.2;            /* ratio between heading sizes */
  --space: 1rem;                /* base spacing / density */
  --radius: 10px;               /* rounded cards & buttons */
  --card-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  --card-border: none;
}

/* "zine" — bold, condensed sans, tight & punchy, hard edges, no shadows */
[data-theme="zine"] {
  --color-bg: #fff8e7;
  --color-fg: #111;
  --color-accent: #e4322b;
  --font-body: "Helvetica Neue", Arial, sans-serif;
  --font-heading: "Impact", "Arial Black", sans-serif;
  --text-scale: 1.5;            /* bigger jumps = louder hierarchy */
  --space: 0.6rem;             /* denser */
  --radius: 0px;               /* hard corners */
  --card-shadow: none;
  --card-border: 3px solid #111; /* heavy outlines instead of shadows */
}

/* "minimal" — monochrome, airy, thin hairlines */
[data-theme="minimal"] {
  --color-bg: #ffffff;
  --color-fg: #222;
  --color-accent: #222;
  --font-body: system-ui, sans-serif;
  --font-heading: system-ui, sans-serif;
  --text-scale: 1.15;
  --space: 1.4rem;             /* roomier */
  --radius: 2px;
  --card-shadow: none;
  --card-border: 1px solid #e5e5e5;
}

/* Optional light/dark WITHIN a theme, layered on top. */
[data-theme="classic"][data-mode="dark"] {
  --color-bg: #15130f;
  --color-fg: #efe9df;
  --color-accent: #d8a05a;
}
```

```html
<!-- swap the entire look by changing one attribute -->
<html data-theme="zine" data-mode="light"> ... </html>
```

Components reference tokens for *every* visual property, not just color —
`background: var(--color-bg)`, `font-family: var(--font-body)`,
`border-radius: var(--radius)`, `padding: var(--space)`,
`box-shadow: var(--card-shadow)`, `border: var(--card-border)` — so switching
`data-theme` restyles layout density, typography, and shape in one move, not
only the palette. A new theme is a new `[data-theme="…"]` block (or its own
token file imported in `BaseLayout.astro`); no markup or component changes. The
richer the token set (type scale, spacing, radius, borders, shadows), the more a
theme can diverge visually. Light/dark is then an optional `data-mode` layer on
top of whichever theme is active, defaulting to `@media (prefers-color-scheme)`.

**Framework options for the styling layer** (ranked for this project):

| Option | What it is | Fit |
|---|---|---|
| **CSS custom properties + `data-theme`** (recommended) | Hand-written tokens, zero dependencies | Simplest, no lock-in; swap = one attribute or one file. |
| **Open Props** | A drop-in library of CSS variables (colors, spacing, type scale, shadows) you override to theme | Great middle ground: gives a ready token system to theme against, still plain CSS. |
| **Tailwind CSS** | Utility classes; theming via `tailwind.config` + CSS-variable colors, built-in dark mode | Pick if you prefer utility-class speed; has an official Astro integration. |
| **Pico CSS / Water.css** | Classless CSS frameworks — style semantic HTML with almost no classes, themeable by stylesheet | Fastest to a decent look; swap by changing the stylesheet. Less control. |
| shadcn-style component kits | Prebuilt themed components | Usually heavier than this site needs. |

**Recommendation:** CSS custom properties under `data-theme`, optionally sitting
on top of **Open Props** for a ready-made token scale. This keeps the swap
trivial (change `data-theme`, or import a different `tokens.css`), works with
Astro's scoped styles, and avoids coupling the content/data model to any CSS
framework. If utility classes are preferred later, Tailwind can be added without
touching the data model or page structure.

Keep each theme in its own file for clean swapping, e.g.
`src/styles/tokens.css` (shared token *names* + a `:root` default) and
`src/styles/themes/{classic,zine,minimal}.css` (each a full token set),
imported once in `BaseLayout.astro`. Selecting the site-wide look is editing the
`data-theme` default on `<html>` — a one-line change that reskins everything.
Optionally add a small toggle that sets `data-theme`/`data-mode` and remembers
the choice in `localStorage`, but that's a visitor convenience, separate from
authoring new themes. Because a theme is pure CSS tokens, adding or swapping one
never touches the content, data model, or page components.

---

## 13. Build order (suggested)

1. Scaffold the Astro project + `BaseLayout`, deploy an empty site to Pages to
   prove the pipeline end-to-end.
2. Add the `bookstores.json` schema + 2–3 real stores + the index page.
3. Add the Leaflet `Map.astro` component and wire pins from the data file.
4. Add per-store detail pages.
5. Add the blog collection + listing + a first post.
6. Add the `new:post` / `new:bookstore` / `geocode` scripts.
7. Add the contact page.
8. (Optional) Add the `sync:events` bridge to the aggregator and related-events
   on detail pages.
