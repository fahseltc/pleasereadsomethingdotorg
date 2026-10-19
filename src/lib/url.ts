/**
 * Prefix an internal path with Astro's configured `base` so links work both
 * locally and under a GitHub Pages project subpath (e.g. /pleasereadsomething).
 * Pass root-relative paths like "/blog" or "blog".
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL; // always has a trailing slash in Astro
  const clean = path.replace(/^\/+/, '');
  return (base.endsWith('/') ? base : base + '/') + clean;
}
