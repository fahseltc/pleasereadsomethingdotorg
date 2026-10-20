# Please Read Something

A small static website for **Front Range independent bookstore reviews**. It has:

- a **map** of reviewed bookstores (Leaflet + OpenStreetMap — no API key, no
  billing),
- a browsable **bookstore index** (image, name, review, address,
  directions),
- a **blog** for articles (store-specific or standalone),
- a **contact** page ("tell me about your bookstore"),
- and simple **`npm run` commands** so you can add content and publish the live
  site **without ever using git**.

It's built with [Astro](https://astro.build/) and deploys free to GitHub Pages.
There's no server, no database, and no secrets.

---

## For the writer: the everyday workflow

You only need four commands. You never touch git.

### 1. Add a blog post

```bash
npm run new:post
```

It asks a few questions and creates a file at `src/content/blog/<slug>.mdx`.
Open that file, write your article under the `---` block, and set `draft: false`
when it's ready. (Hero image optional — drop it in `public/images/blog/` and set
`heroImage` in the file.) Posts are `.mdx` so you can embed a YouTube video; for
everyday writing it's just Markdown.

Prefer one line? `npm run new:post -- --title "My first review"`

### 2. Add a bookstore

```bash
npm run new:bookstore
```

It asks for the name, address, a short review, tags, and website. It
**automatically looks up the map location from the address** and shows you what
it found. The new store is added to `src/content/bookstores.json`.

Then:

- Add a photo at `public/images/bookstores/<id>.jpg` (or `.png`/`.webp`) and
  change that store's `"image"` to `"/images/bookstores/<id>.jpg"`.
- If the location looked wrong, re-run `npm run geocode -- "<the address>"` to
  get coordinates, or edit `lat`/`lng` in the file by hand.

One line: `npm run new:bookstore -- --name "Boulder Bookstore" --address "1107 Pearl St, Boulder, CO 80302"`

Libraries work exactly the same way with `npm run new:library` — it adds to
`src/content/libraries.json` and photos go in `public/images/libraries/`.

### 3. Preview it

```bash
npm run dev
```

Open the URL it prints (usually http://localhost:4321). Leave it running while
you edit — it refreshes automatically. Press `Ctrl+C` to stop.

### 4. Publish it (goes live)

```bash
npm run publish
```

This checks the site builds, then sends your changes to GitHub, which puts them
online in a minute or two. It does all the git work for you and explains
anything that goes wrong in plain language.

If it ever says someone else changed the site, run `npm run update` first, then
`npm run publish` again.

### Hiding a store or library (without deleting it)

```bash
npm run disable:bookstore -- <store-id>      # removes its pin + card
npm run enable:bookstore  -- <store-id>      # brings it back
npm run disable:library   -- <library-id>    # same, for libraries
npm run enable:library    -- <library-id>
```

Run the disable command with no id to see the list of ids.

---

## What goes where

| You want to… | Edit / run |
|---|---|
| Write an article | `npm run new:post`, then `src/content/blog/<slug>.mdx` |
| Add a bookstore | `npm run new:bookstore` |
| Add a library | `npm run new:library` |
| Add a store photo | `public/images/bookstores/<id>.jpg` + set `image` in `bookstores.json` |
| Hide/show a store | `npm run disable:bookstore` / `enable:bookstore` |
| Hide/show a library | `npm run disable:library` / `enable:library` |
| Fix a map pin | `npm run geocode -- "<address>"`, then edit `lat`/`lng` |
| Change contact emails | `.env` locally / GitHub secrets in CI (see "Contact email addresses" below) |
| Put it live | `npm run publish` |

A bookstore record looks like this (`src/content/bookstores.json`):

```json
{
  "id": "boulder-bookstore",
  "name": "Boulder Bookstore",
  "image": "/images/bookstores/boulder-bookstore.jpg",
  "address": "1107 Pearl St, Boulder, CO 80302",
  "lat": 40.01781,
  "lng": -105.28103,
  "review": "Three floors of new and used on the Pearl Street Mall…",
  "tags": ["used", "events", "pearl-street"],
  "website": "https://boulderbookstore.net/",
  "mapsLink": "https://www.google.com/maps/search/?api=1&query=Boulder%20Bookstore%2C%201107%20Pearl%20St%2C%20Boulder%2C%20CO%2080302",
  "sourceAliases": ["Boulder Bookstore"],
  "enabled": true
}
```

- `enabled: false` hides the store from the map and index without deleting it.
- An **enabled** store must have real `lat`/`lng` numbers, or the site won't
  build (this is a safety check so you never publish a broken pin).
- The home page's "Latest indie bookstores" section shows the most recently
  added enabled stores. New stores are appended to the end of
  `bookstores.json` (which is what `npm run new:bookstore` does), so "latest"
  follows that order.
- `mapsLink` (the "Get directions" button) is created for you as a Google Maps
  search for the store's **name + address**, so it opens on the actual business
  (with its hours and reviews), not just a dot on the map. For a store with a
  common name you can replace it by hand with a Google "Place ID" link for an
  exact match — but the default is fine for almost everything, and no Google
  account or API key is involved.

A blog post's top section (front-matter) looks like this:

```markdown
---
title: "Why I started reviewing the Front Range's indie bookstores"
description: "A short summary used for previews."
pubDate: 2026-10-15
# heroImage: "/images/blog/intro.jpg"
tags: ["meta", "front-range"]
# bookstore: "boulder-bookstore"   # optional: link this post to a store
draft: false
---

Your article here.
```

The `bookstore` line is optional. With it, the post is cross-linked to that
store. Without it, the post is a standalone article — it still shows in the blog
list.

### Adding a photo or a YouTube video to an article

- **A photo in the body:** drop the image in `public/images/blog/`, then
  reference it where you want it:

  ```markdown
  ![A short description](/images/blog/storefront.jpg)
  ```

- **A YouTube video or Short:** paste the URL into a `<YouTube/>` tag anywhere
  in the post. It works for both regular (widescreen) videos and vertical
  Shorts — it detects which automatically and sizes the frame to match. No setup
  or import needed:

  ```mdx
  <YouTube url="https://www.youtube.com/watch?v=1Zq5fAD2n0Y" />
  <YouTube url="https://www.youtube.com/shorts/qyL8XcY8ZG4" />
  ```

  You can also pass a `title="…"` for screen readers, or just the bare video id
  (`<YouTube id="1Zq5fAD2n0Y" />`). New posts are created as `.mdx` files so this
  works out of the box — otherwise you write them exactly like normal Markdown.
  (The scaffolded post includes a commented-out example you can uncomment.)

---

## Changing the look (theme)

The site uses the **classic** theme, with a light/dark toggle (the `◐` button in
the header). The default mode is set in `src/layouts/BaseLayout.astro`:

```js
const DEFAULT_THEME = 'classic';
const DEFAULT_MODE = 'light';    // 'light' | 'dark'
```

Styling is driven by CSS design tokens, so the look is easy to change without
touching components. The active theme's tokens live in
`src/styles/themes/classic.css` (with `src/styles/tokens.css` holding the
defaults). Edit those values — colors, fonts, spacing, corners, shadows — and
the whole site restyles, because components read the tokens rather than
hard-coding anything.

Two extra theme files (`zine.css`, `minimal.css`) also exist in
`src/styles/themes/` but are **not** loaded — only `classic.css` is imported in
`BaseLayout.astro`. To switch themes, change that import (and the
`DEFAULT_THEME` value); to add a new one, copy `classic.css`, edit the values
under its `[data-theme="<name>"]` selector, and import it.

---

## Events from book-events-aggregator (currently off)

There's an optional bridge to the sibling
[`book-events-aggregator`](../book-events-aggregator) project that can list each
store's upcoming events on its detail page. **It is currently disabled** — no
events render anywhere, by design.

All the wiring is still in place (`src/lib/events.ts`, `npm run sync:events`,
`src/data/events.json`, and the "Upcoming events" section on the detail page); a
single feature flag short-circuits it. To turn it back on, set `disabled` to
`false` in `src/lib/events.ts`:

```ts
const eventsFeature = {
  disabled: true, // ← set to false to show events again
};
```

With the flag on, running `npm run sync:events` (which copies the aggregator's
`output/events.json` into `src/data/events.json`) has no visible effect. With it
off, events are matched to a store by its `sourceAliases` (plus the store
name/address appearing in the event). Either way the site builds fine.

---

## One-time setup (for whoever sets up the site)

This section is for the initial technical setup. The writer above never needs
it.

### Install

```bash
npm install
```

### Contact email addresses

The `/contact` page shows two addresses, read from environment variables so
they're not hardcoded in the committed source:

| Variable | Used for | Current value |
|---|---|---|
| `PUBLIC_CONTACT_EMAIL` | General "tell me about your bookstore" contact | `dearreader@pleasereadsomething.org` |
| `PUBLIC_ADMIN_EMAIL` | Tech support / problems with the site | `admin@pleasereadsomething.org` |

**Locally:** copy `.env.example` to `.env` and fill in the real addresses.
`.env` is gitignored; `.env.example` holds only placeholders and is committed.

```bash
cp .env.example .env    # then edit .env with the real addresses
```

**In CI / production:** set them as repository secrets so they're injected at
build time instead of living in the repo. In GitHub:
**Settings → Secrets and variables → Actions → New repository secret**, add
`PUBLIC_CONTACT_EMAIL` and `PUBLIC_ADMIN_EMAIL`. The deploy workflow passes them
to the build (see `.github/workflows/deploy.yml`). If a secret isn't set, the
build falls back to `…@example.com` placeholders.

> Reality check: this is a **static** site, so whatever email the page shows is
> visible in the published HTML to anyone who views the page — that's
> unavoidable for a contact page. The `PUBLIC_` prefix is Astro's way of marking
> a value as browser-visible. Using env/secrets here keeps the addresses out of
> the **git repository** (and code search), not out of the browser. Don't treat
> these as secret, and never put a real secret in a `PUBLIC_` variable.

### Domain and base path

This site is served from the custom domain **pleasereadsomething.org**, at the
root, so `astro.config.mjs` pins:

```js
const site = process.env.SITE ?? 'https://pleasereadsomething.org';
const base = process.env.BASE ?? '/';
```

The domain is kept in `public/CNAME`, which Astro copies into the build every
time — that's what keeps GitHub Pages pointed at the custom domain across
deploys. The deploy workflow does **not** feed a base path from
`actions/configure-pages` (for a project repo that would wrongly inject a
`/<repo>/` subpath even under a custom domain), so the pinned `base: '/'` is
what ships.

If you ever move off the custom domain to a project site
(`https://<user>.github.io/<repo>/`), set `base` to `'/<repo>'` and `site` to
that origin, and remove `public/CNAME`.

### Connect the repo to GitHub (enables `npm run publish`)

The repo is already connected to
`github.com/fahseltc/pleasereadsomethingdotorg` on the `main` branch. For a
fresh clone elsewhere you don't need to re-do this. To wire a brand-new repo:

```bash
git init
git add -A
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Note: this environment has a global git rule that rewrites
`https://github.com/...` remotes to SSH (`git@github.com:...`), so pushing uses
your SSH key even when the remote URL is HTTPS.

Then in the repo on GitHub: **Settings → Pages → Build and deployment →
Source: GitHub Actions**, and set the **Custom domain** to
`pleasereadsomething.org` (DNS: four `A` records to GitHub's Pages IPs for the
apex, or a `CNAME` to `fahseltc.github.io` for `www`). The repo must be public
(or on a paid plan) for Pages to work. The workflow in
`.github/workflows/deploy.yml` builds and deploys on every push to `main` —
which is exactly what `npm run publish` triggers.

### Developer commands

```bash
npm run dev       # local dev server
npm run build     # static build into dist/
npm run preview   # serve the built dist/
npm run check     # Astro type/content diagnostics
```

There's no automated test suite; verify changes with `npm run build` and
`npm run check`.

---

## How it's built (quick tour)

- **Astro static site.** Content is files: `src/content/bookstores.json` and
  Markdown in `src/content/blog/`, validated by schemas in
  `src/content/config.ts`.
- **Map** (`src/components/Map.astro`): Leaflet + OpenStreetMap, one pin per
  enabled store, rendered client-side. No key, no billing.
- **Blog:** Markdown/MDX in `src/content/blog/`. `.mdx` lets posts embed the
  `<YouTube/>` component (`src/components/YouTube.astro`); it's registered via
  the `@astrojs/mdx` integration in `astro.config.mjs`.
- **Styling:** CSS design tokens in `src/styles/` — `tokens.css` defaults, the
  active `themes/classic.css`, and mobile-first `global.css`.
- **Scripts** (`scripts/*.mjs`): the npm authoring commands. Plain Node, no
  dependencies.
- **Deploy:** `.github/workflows/deploy.yml` → GitHub Pages, custom domain via
  `public/CNAME`.

See `.kiro/steering/` for deeper architecture notes.

### Note on in-post links

Because the site is served from the root of its custom domain (`base: '/'`),
links written inside a Markdown/MDX post body (e.g. `[the map](/bookstores)`)
work as-is. (This would only need care if the site moved back to a project
subpath, where in-post links aren't auto-prefixed with the base path — the page
templates handle that themselves via `withBase()`.)

---

## License

MIT.
