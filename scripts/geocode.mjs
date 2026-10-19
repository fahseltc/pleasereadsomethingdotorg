#!/usr/bin/env node
// geocode.mjs — look up lat/lng for an address via OpenStreetMap Nominatim.
//
// Used inside `new:bookstore`, and callable alone to re-check a pin:
//   npm run geocode -- "1107 Pearl St, Boulder, CO 80302"
//
// This is an AUTHORING-TIME step. Coordinates get committed to bookstores.json,
// so the published site makes zero geocoding calls (design §6).

import { parseArgs, log } from './lib.mjs';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires an identifying User-Agent, and in practice
// also expects a browser-like Accept header set — a bare fetch is rejected 403.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 pleasereadsomething-site/0.1 (bookstore geocoder)',
  Accept: 'application/json',
  'Accept-Language': 'en',
};

/**
 * Return up to `limit` candidate matches: { lat, lng, label }.
 * Throws on network/HTTP error so callers can fall back gracefully.
 */
export async function geocode(address, limit = 5) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(address)}&format=jsonv2&limit=${limit}&addressdetails=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Nominatim returned HTTP ${res.status}`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((d) => ({
    lat: Number(Number(d.lat).toFixed(5)),
    lng: Number(Number(d.lon).toFixed(5)),
    label: d.display_name,
  }));
}

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));
  const address = positional.join(' ') || opts.address;
  if (!address) {
    log.err('Usage: npm run geocode -- "123 Main St, Denver, CO"');
    process.exit(1);
  }
  try {
    const matches = await geocode(address);
    if (matches.length === 0) {
      log.warn(`No matches for "${address}". Try a more specific address.`);
      process.exit(2);
    }
    log.info(`Matches for "${address}":`);
    matches.forEach((m, i) => {
      log.info(`  ${i + 1}. lat ${m.lat}, lng ${m.lng}  —  ${m.label}`);
    });
    log.info('');
    log.ok(`Best guess: "lat": ${matches[0].lat}, "lng": ${matches[0].lng}`);
  } catch (err) {
    log.err(`Geocoding failed: ${err.message}`);
    log.info('You can paste coordinates into bookstores.json by hand instead.');
    process.exit(3);
  }
}

// Only run main() when invoked directly (not when imported).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('geocode.mjs')) {
  main();
}
