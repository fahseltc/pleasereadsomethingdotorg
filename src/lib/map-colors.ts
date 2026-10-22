/**
 * Category colors for map pins and legends — the single source of truth.
 *
 * These are plain color values (not CSS tokens) because they're serialized into
 * the Leaflet pin SVGs at build time, where a `var(--…)` wouldn't resolve.
 * BOOKSTORE_COLOR also matches the theme accent (--color-accent in tokens.css).
 */
export const BOOKSTORE_COLOR = '#7a4a2b'; // bookish brown (the site accent)
export const LIBRARY_COLOR = '#2e7d6b'; // teal-green, distinct from bookstores
