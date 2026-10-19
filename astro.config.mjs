// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// GitHub Pages configuration.
//
// If this repo is published as a PROJECT site (the default), the site lives at
//   https://<user>.github.io/<repo>/
// and `base` MUST be the repo name (leading slash). If you instead use a custom
// domain or a <user>.github.io USER site, set `base: '/'` and point `site` at
// the custom domain.
//
// Override without editing this file by setting the SITE / BASE env vars
// (the GitHub Actions workflow does this automatically from the repo name).
const site = process.env.SITE ?? 'https://your-username.github.io';
const base = process.env.BASE ?? '/pleasereadsomething';

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
