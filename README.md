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

It asks a few questions and creates a file at `src/content/blog/<slug>.md`. Open
that file, write your article under the `---` block, and set `draft: false` when
it's ready. (Hero image optional — drop it in `public/images/blog/` and set
`heroImage` in the file.)

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

### Hiding a store (without deleting it)

```bash
npm run disable:bookstore -- <store-id>    # removes its pin + card
npm run enable:bookstore  -- <store-id>    # brings it back
```

Run `npm run disable:bookstore` with no id to see the list of store ids.

---

## What goes where

| You want to… | Edit / run |
|---|---|
| Write an article | `npm run new:post`, then `src/content/blog/<slug>.md` |
| Add a bookstore | `npm run new:bookstore` |
| Add a store photo | `public/images/bookstores/<id>.jpg` + set `image` in `bookstores.json` |
| Hide/show a store | `npm run disable:bookstore` / `enable:bookstore` |
| Fix a map pin | `npm run geocode -- "<address>"`, then edit `lat`/`lng` |
| Change contact email | `CONTACT_EMAIL` in `src/pages/contact.astro` |
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

## Changing the look (themes)

The site ships three full looks — **classic**, **zine**, **minimal** — plus a
light/dark toggle. Visitors can switch using the control in the header.

To change the **default** look for everyone, edit one line in
`src/layouts/BaseLayout.astro`:

```js
const DEFAULT_THEME = 'classic'; // 'classic' | 'zine' | 'minimal'
const DEFAULT_MODE = 'light';    // 'light' | 'dark'
```

A theme is a full visual reskin (colors, fonts, spacing, corners, shadows), not
just dark mode. To add a new theme, copy
`src/styles/themes/classic.css` to `src/styles/themes/<name>.css`, change the
values under the `[data-theme="<name>"]` selector, and import it in
`BaseLayout.astro` (and add it to the switcher's `<select>`). Components never
hard-code styles — they read these tokens — so a new theme restyles everything.

---

## Showing events from book-events-aggregator (optional)

If you also use the sibling [`book-events-aggregator`](../book-events-aggregator)
project, you can show each store's upcoming events on its page:

```bash
npm run sync:events
```

This copies the aggregator's `output/events.json` into `src/data/events.json`.
Events are matched to a store by its `sourceAliases` (plus the store
name/address appearing in the event). If you never run this, the site builds
fine — detail pages just show no events.

---

## One-time setup (for whoever sets up the site)

This section is for the initial technical setup. The writer above never needs
it.

### Install

```bash
npm install
```

### Point it at your GitHub Pages URL

Edit `astro.config.mjs` defaults, or rely on the deploy workflow which sets them
automatically for a **project site** served from
`https://<user>.github.io/<repo>/`:

```js
const site = process.env.SITE ?? 'https://your-username.github.io';
const base = process.env.BASE ?? '/pleasereadsomething';
```

For a user/org site (`<user>.github.io`) or a custom domain, set `base` to `/`.

### Connect the repo to GitHub (enables `npm run publish`)

```bash
git init
git add -A
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds
and deploys on every push to `main` — which is exactly what `npm run publish`
triggers.

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
- **Styling:** CSS design tokens in `src/styles/` — `tokens.css` + one file per
  theme + mobile-first `global.css`.
- **Scripts** (`scripts/*.mjs`): the npm authoring commands. Plain Node, no
  dependencies.
- **Deploy:** `.github/workflows/deploy.yml` → GitHub Pages.

See `.kiro/steering/` for deeper architecture notes.

### Known limitation

Links written **inside a Markdown post body** (e.g. `[the map](/bookstores)`)
are not automatically prefixed with the GitHub Pages base path. On a project
site served from a subpath, prefer linking to full paths or keep cross-links in
the page templates (which use `withBase()`). On a user site / custom domain
(base `/`) this isn't an issue.

---

## License

MIT.
