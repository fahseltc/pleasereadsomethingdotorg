#!/usr/bin/env node
// sync-events.mjs — copy book-events-aggregator output into src/data/ so store
// detail pages can show related upcoming events (design §3/§6). Optional: if the
// source file isn't found, the site still builds (events are just empty).
//
//   npm run sync:events
//   npm run sync:events -- --from ../book-events-aggregator/output/events.json
//
// By default this pulls the aggregator's FILTERED feed (events-filtered.json) —
// only book-relevant events (author talks, signings, book clubs, …) per the
// aggregator's config/filters.json — not the full firehose that also includes
// unrelated library programs. It falls back to the unfiltered events.json if a
// filtered file isn't present. Override the source with --from.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs, ROOT, paths, log } from './lib.mjs';

// Prefer the filtered feed; fall back to the full feed. Checks both the sibling
// layout (../) and one level up (../../) for each.
const DEFAULTS = [
  '../book-events-aggregator/output/events-filtered.json',
  '../../book-events-aggregator/output/events-filtered.json',
  '../book-events-aggregator/output/events.json',
  '../../book-events-aggregator/output/events.json',
];

async function main() {
  const { opts } = parseArgs(process.argv.slice(2));
  const candidates = opts.from ? [opts.from] : DEFAULTS;

  let src = null;
  for (const c of candidates) {
    const abs = resolve(ROOT, c);
    if (existsSync(abs)) {
      src = abs;
      break;
    }
  }

  if (!src) {
    log.warn('Could not find the aggregator events file.');
    log.info(`Looked in: ${candidates.join(', ')}`);
    log.info('Run the aggregator\'s `npm run pipeline` first, or pass --from <path>.');
    log.info('The site still builds without it — detail pages just show no events.');
    process.exit(0);
  }

  const raw = await readFile(src, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.err(`${src} is not valid JSON.`);
    process.exit(1);
  }

  const events = Array.isArray(parsed.events) ? parsed.events : [];
  await mkdir(paths.dataDir, { recursive: true });
  const out = join(paths.dataDir, 'events.json');
  await writeFile(
    out,
    JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2) + '\n',
    'utf8'
  );

  const which = src.includes('events-filtered') ? 'filtered' : 'UNFILTERED (fallback)';
  log.ok(`Synced ${events.length} ${which} event(s) from the aggregator into src/data/events.json.`);
  if (which !== 'filtered') {
    log.warn('No events-filtered.json found — used the full feed. Run the aggregator\'s `npm run filter` to produce the book-relevant set.');
  }
  log.info('Rebuild/preview to see events on the Events page and store detail pages.');
}

main();
