// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// GitHub Pages configuration.
//
// This repo is served from its own CUSTOM DOMAIN (pleasereadsomething.org), so
// the site lives at the ROOT of that domain and `base` is '/'. The domain is
// kept in public/CNAME so it survives every Actions deploy.
//
// (If you ever move back to a project subpath — e.g. fahseltc.github.io/<repo>/
// — set base to '/<repo>' and site to that origin.)
//
// SITE / BASE env vars still override these for one-off builds if needed.
const site = process.env.SITE ?? 'https://pleasereadsomething.org';
const base = process.env.BASE ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    // Emit `about/index.html` style paths so clean URLs work on Pages.
    format: 'directory',
  },
  // MDX lets a blog post embed components (e.g. <YouTube/>) while still being
  // plain Markdown otherwise. Posts can be .md OR .mdx.
  integrations: [mdx()],
});
