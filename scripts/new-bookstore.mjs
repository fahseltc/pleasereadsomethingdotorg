#!/usr/bin/env node
// new-bookstore.mjs — add a store to the index, geocoding its address as part
// of the flow (design §6). Appends a record to src/content/bookstores.json.
//
//   npm run new:bookstore
//   npm run new:bookstore -- --name "Boulder Bookstore" --address "1107 Pearl St, Boulder, CO 80302"

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs, prompt, slugify, mapsLinkFor, paths, log } from './lib.mjs';
import { geocode } from './geocode.mjs';

async function readStores() {
  if (!existsSync(paths.bookstores)) return [];
  const raw = await readFile(paths.bookstores, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function resolveCoords(address) {
  // Built-in geocoding step. Returns { lat, lng, enabled, note }.
  try {
    const matches = await geocode(address);
    if (matches.length === 0) {
      return {
        lat: null,
        lng: null,
        enabled: false,
        note: 'No geocoding match — set coordinates by hand, then flip enabled:true.',
      };
    }
    if (matches.length === 1 || !process.stdin.isTTY) {
      const m = matches[0];
      return { lat: m.lat, lng: m.lng, enabled: true, note: '' };
    }
    log.info('Multiple matches — pick one:');
    matches.forEach((m, i) => log.info(`  ${i + 1}. ${m.lat}, ${m.lng}  —  ${m.label}`));
    const pick = await prompt('Which match number', '1');
    const idx = Math.max(1, Math.min(matches.length, parseInt(pick, 10) || 1)) - 1;
    const m = matches[idx];
    return { lat: m.lat, lng: m.lng, enabled: true, note: '' };
  } catch (err) {
    return {
      lat: null,
      lng: null,
      enabled: false,
      note: `Geocoding unavailable (${err.message}) — add coordinates by hand, then enabled:true.`,
    };
  }
}

async function main() {
  const { opts } = parseArgs(process.argv.slice(2));

  const name = opts.name || (await prompt('Store name'));
  if (!name) {
    log.err('A name is required.');
    process.exit(1);
  }
  const address = opts.address || (await prompt('Address'));
  if (!address) {
    log.err('An address is required (used for the map pin + directions).');
    process.exit(1);
  }

  const review = opts.review || (await prompt('Short review / description'));
  const tagsRaw = opts.tags || (await prompt('Tags, comma-separated (optional)'));
  const website = opts.website || (await prompt('Website URL (optional)'));

  const id = slugify(opts.id || name);
  const stores = await readStores();
  if (stores.some((s) => s.id === id)) {
    log.err(`A store with id "${id}" already exists. Pick a different name or pass --id.`);
    process.exit(1);
  }

  log.info(`Looking up coordinates for "${address}"…`);
  const { lat, lng, enabled, note } = await resolveCoords(address);

  const record = {
    id,
    name,
    image: '/images/bookstores/placeholder.svg',
    address,
    lat,
    lng,
    review: review || 'TODO: write a review.',
    tags: tagsRaw
      ? String(tagsRaw).split(',').map((t) => t.trim()).filter(Boolean)
      : [],
    ...(website ? { website } : {}),
    mapsLink: mapsLinkFor(name, address),
    sourceAliases: [name],
    enabled,
  };

  stores.push(record);
  await writeFile(paths.bookstores, JSON.stringify(stores, null, 2) + '\n', 'utf8');

  log.rule();
  log.ok(`Added ${name} to src/content/bookstores.json (id "${id}").`);
  if (enabled) {
    log.info(`I set the map pin to ${lat}, ${lng} — open the preview to confirm it's right.`);
  } else {
    log.warn(note);
  }
  log.info(`Add a photo at public/images/bookstores/${id}.jpg (or .png/.webp) and`);
  log.info(`update "image" to "/images/bookstores/${id}.jpg".`);
  log.info('To hide this store from the map/index, set "enabled": false (or run `npm run disable:bookstore`).');
  log.info('When ready, preview with `npm run dev`, then publish with `npm run publish`.');
}

main();
