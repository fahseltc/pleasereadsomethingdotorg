#!/usr/bin/env node
// optimize-images.mjs — shrinks oversized photos so pages load fast.
//
//   npm run optimize-images            # fix every oversized photo
//   npm run optimize-images -- --dry-run   # only list what would change
//
// Runs automatically on `npm run dev` and `npm run publish`, so new photos are
// handled without thinking about it. Safe to run any number of times: photos
// that are already small enough are left alone.
//
// What it does, for each photo under public/images/{bookstores,libraries,blog}:
//
//   1. Skips it if it is already within MAX_EDGE pixels and under MAX_BYTES.
//   2. Copies the untouched original to image-originals/ (gitignored), so
//      nothing is ever lost. Delete that folder whenever you like.
//   3. Applies the camera's rotation, resizes so the longest side is at most
//      MAX_EDGE, and re-encodes:
//        - JPEG stays JPEG.
//        - PNG/WebP with no transparency becomes JPEG (photos saved as PNG are
//          often 5-10x bigger than they need to be). The file gets a .jpg
//          name and every reference in src/ is updated to match.
//        - PNG with transparency stays PNG (logos, cut-outs).
//   4. Prints before/after sizes.
//
// SVGs, logos (public/images/logos), and the placeholders are never touched.
//
// Uses `sharp` (the image library Astro itself uses). Everything else is Node
// built-ins.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { ROOT, log, parseArgs } from './lib.mjs';

const MAX_EDGE = 1600; // px, longest side
const MAX_BYTES = 500 * 1024; // files bigger than this get re-encoded
const JPEG_QUALITY = 80;

const PUBLIC_DIR = join(ROOT, 'public');
const BACKUP_DIR = join(ROOT, 'image-originals');
const SRC_DIR = join(ROOT, 'src');
const FOLDERS = ['images/bookstores', 'images/libraries', 'images/blog'];
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  log.err('The image tool (sharp) is not installed. Run `npm install` and try again.');
  process.exit(1);
}

const { opts } = parseArgs(process.argv.slice(2));
const dryRun = Boolean(opts['dry-run']);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const kb = (n) => `${Math.round(n / 1024).toLocaleString()} KB`;
const urlOf = (abs) => '/' + relative(PUBLIC_DIR, abs).replace(/\\/g, '/');

/** Replace an image URL everywhere it appears in src/ (json, md, mdx, astro). */
function rewriteReferences(fromUrl, toUrl) {
  let count = 0;
  for (const file of walk(SRC_DIR)) {
    if (!/\.(json|md|mdx|astro|ts)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes(fromUrl)) continue;
    const parts = text.split(fromUrl);
    count += parts.length - 1;
    if (!dryRun) writeFileSync(file, parts.join(toUrl));
  }
  return count;
}

async function optimize(abs) {
  const ext = extname(abs).toLowerCase();
  // Read into memory first: on Windows, sharp keeps an input FILE open, which
  // blocks writing the result back to the same path.
  const input = readFileSync(abs);
  const before = input.length;
  const image = sharp(input, { failOn: 'none' });
  const meta = await image.metadata();
  // Orientations 5-8 are rotated 90°, so the stored width/height are swapped.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const tooBig = Math.max(width ?? 0, height ?? 0) > MAX_EDGE;
  if (!tooBig && before <= MAX_BYTES) return null;

  const opaque = ext === '.jpg' || ext === '.jpeg' ? true : (await image.stats()).isOpaque;
  const toJpeg = opaque;
  const outAbs = toJpeg && ext !== '.jpg' ? abs.slice(0, -ext.length) + '.jpg' : abs;
  if (outAbs !== abs && existsSync(outAbs)) {
    log.warn(`${urlOf(abs)}: skipped, because ${urlOf(outAbs)} already exists. Rename one of them.`);
    return null;
  }

  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  if (tooBig) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
  pipeline = toJpeg
    ? pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    : pipeline.png({ compressionLevel: 9, palette: true });
  const buffer = await pipeline.toBuffer();

  // Re-encoding a small, already-compressed file can make it bigger. Keep the original then.
  if (!tooBig && outAbs === abs && buffer.length >= before) return null;

  const result = { from: urlOf(abs), to: urlOf(outAbs), before, after: buffer.length, refs: 0 };
  if (dryRun) {
    if (result.from !== result.to) result.refs = rewriteReferences(result.from, result.to);
    return result;
  }

  const backup = join(BACKUP_DIR, relative(PUBLIC_DIR, abs));
  if (!existsSync(backup)) {
    mkdirSync(dirname(backup), { recursive: true });
    copyFileSync(abs, backup);
  }
  writeFileSync(outAbs, buffer);
  if (outAbs !== abs) {
    unlinkSync(abs);
    result.refs = rewriteReferences(result.from, result.to);
  }
  return result;
}

async function main() {
  const files = FOLDERS.flatMap((f) => walk(join(PUBLIC_DIR, f))).filter(
    (f) => RASTER.has(extname(f).toLowerCase()) && !/placeholder/i.test(f),
  );
  let saved = 0;
  let changed = 0;
  for (const abs of files) {
    try {
      const r = await optimize(abs);
      if (!r) continue;
      changed++;
      saved += r.before - r.after;
      const rename = r.from !== r.to ? ` -> ${r.to} (${r.refs} reference${r.refs === 1 ? '' : 's'} updated)` : '';
      log.ok(`${dryRun ? '[dry run] ' : ''}${r.from}: ${kb(r.before)} -> ${kb(r.after)}${rename}`);
    } catch (err) {
      log.warn(`${urlOf(abs)}: could not be processed (${err.message}). Left as-is.`);
    }
  }
  if (changed === 0) {
    log.ok(`Photos are already web-sized (${files.length} checked).`);
  } else {
    log.ok(
      `${dryRun ? 'Would shrink' : 'Shrank'} ${changed} photo(s), saving ${kb(saved)}.` +
        (dryRun ? '' : ' Originals are in image-originals/.'),
    );
  }
}

await main();
