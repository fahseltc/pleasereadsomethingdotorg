/**
 * Real pixel dimensions for images in public/, read at BUILD time.
 *
 * Pages pass these as <img width/height> so the browser reserves the right
 * space before the photo loads (no layout jump, better Core Web Vitals). It's
 * automatic: a new photo is measured on the next build, with nothing to keep in
 * sync. Reads only the file header (fast) and caches per build.
 */
import sharp from 'sharp';
import { join } from 'node:path';

export interface ImageSize {
  width: number;
  height: number;
}

// Resolved from the project root: at build time this module runs from a bundled
// chunk under dist/, so a path relative to import.meta.url would be wrong.
const PUBLIC_DIR = join(process.cwd(), 'public');
const cache = new Map<string, Promise<ImageSize | undefined>>();

/** Size of a site path like "/images/bookstores/x.jpg", or undefined if unknown. */
export function imageSize(src: string | undefined | null): Promise<ImageSize | undefined> {
  if (!src || /^https?:/i.test(src)) return Promise.resolve(undefined);
  const key = src.replace(/^\/+/, '').split(/[?#]/)[0];
  let hit = cache.get(key);
  if (!hit) {
    hit = sharp(join(PUBLIC_DIR, key))
      .metadata()
      .then((m) => {
        if (!m.width || !m.height) return undefined;
        // EXIF orientations 5-8 are rotated 90 degrees, so width/height swap on screen.
        const rotated = (m.orientation ?? 1) >= 5;
        return rotated ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
      })
      .catch(() => undefined);
    cache.set(key, hit);
  }
  return hit;
}

/** True for a real photo worth using as a share image (not an SVG placeholder). */
export function isPhoto(src: string | undefined | null): src is string {
  return !!src && !/\.svg$/i.test(src) && !/placeholder/i.test(src);
}
