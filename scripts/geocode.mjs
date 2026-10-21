#!/usr/bin/env node
// geocode.mjs — look up lat/lng for an address via OpenStreetMap Nominatim.
//
// Used inside `new:bookstore`, and callable alone to re-check a pin:
//   npm run geocode -- "1107 Pearl St, Boulder, CO 80302"
//
// This is an AUTHORING-TIME step. Coordinates get committed to bookstores.json,
// so the published site makes zero geocoding calls (design §6).

import { parseArgs, log, color } from './lib.mjs';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires an identifying User-Agent, and in practice
// also expects a browser-like Accept header set — a bare fetch is rejected 403.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 pleasereadsomething-site/0.1 (bookstore geocoder)',
  Accept: 'application/json',
  'Accept-Language': 'en',
};

/**
 * Remove a secondary unit/suite designator from an address. Nominatim matches
 * to the building/parcel level and FAILS when a "Unit 110" / "Suite 3" / "#110"
 * token is present (it won't just ignore it). e.g.
 *   "3040 Blake St Unit 110, Denver, CO"  ->  "3040 Blake St, Denver, CO"
 * Returns null if nothing was stripped (so callers can skip a pointless retry).
 */
export function stripUnit(address) {
  // Match a unit designator as a whole word, followed by a unit value that
  // looks like a unit (digits, optionally with a letter, or "#123"). Requiring
  // that value shape avoids eating ordinary words — e.g. "United States" must
  // NOT be caught by a "no"/"unit" alternative. "#110" (bare hash) also works.
  const designator = String.raw`(?:unit|suite|ste|apt|apartment|room|rm|fl|floor|bldg|building|no)`;
  const value = String.raw`#?\s*\d+[a-z]?|#\s*\w+`;
  // Either "<designator> <value>"  OR  a bare "#123" with no designator word.
  const re = new RegExp(
    String.raw`[,]?\s*(?:\b${designator}\b\.?\s*(?:${value})|#\s*\w+)`,
    'gi',
  );
  const stripped = String(address)
    .replace(re, '')
    .replace(/\s*,\s*,/g, ',') // collapse any ", ," left behind
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped !== address.trim() ? stripped : null;
}

/** One raw Nominatim query. Returns [] on no match, throws on HTTP error. */
async function query(address, limit) {
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

/**
 * Return up to `limit` candidate matches: { lat, lng, label }.
 * If the full address yields nothing, automatically retry WITHOUT a secondary
 * unit/suite designator (a common reason Nominatim returns no match). The
 * `retried` flag on the returned array notes when the fallback was used.
 * Throws on network/HTTP error so callers can fall back gracefully.
 */
export async function geocode(address, limit = 5) {
  let matches = await query(address, limit);
  if (matches.length === 0) {
    const unitless = stripUnit(address);
    if (unitless) {
      // Be polite to Nominatim's 1 req/sec policy between the two calls.
      await new Promise((r) => setTimeout(r, 1100));
      const retry = await query(unitless, limit);
      if (retry.length > 0) {
        retry.retried = unitless; // annotate: this came from the unit-stripped form
        return retry;
      }
    }
  }
  return matches;
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
      log.err(`No coordinates found for "${address}".`);
      log.info('Nominatim (OpenStreetMap) could not resolve this address. Tips:');
      log.info('  • Drop any unit/suite number (e.g. "Unit 110") — it often blocks a match.');
      log.info('  • Use "St/Ave" + "CO" + ZIP, e.g. "3040 Blake St, Denver, CO 80205".');
      log.info('  • Or paste lat/lng into bookstores.json by hand.');
      process.exit(2);
    }
    if (matches.retried) {
      log.warn(`No match for the full address; used "${matches.retried}" (unit/suite removed).`);
    }
    log.info(`Matches for "${address}":`);
    matches.forEach((m, i) => {
      log.info(`  ${i + 1}. lat ${m.lat}, lng ${m.lng}  ${color.dim('— ' + m.label)}`);
    });
    log.info('');
    log.ok(`Found it — "lat": ${matches[0].lat}, "lng": ${matches[0].lng}`);
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
