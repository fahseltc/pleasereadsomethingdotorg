#!/usr/bin/env node
// toggle-entry.mjs — show/hide a bookstore or library on the map without
// editing JSON by hand. Backs disable:/enable: for both collections.
//
//   npm run disable:bookstore -- boulder-bookstore
//   npm run enable:bookstore  -- boulder-bookstore
//   npm run disable:library   -- denver-central-library
//   npm run enable:library    -- denver-central-library

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs, prompt, paths, log } from './lib.mjs';

async function main() {
  // package.json passes: <mode> <collection>  e.g. "disable" "library"
  const mode = process.argv[2]; // 'enable' | 'disable'
  const collection = process.argv[3]; // 'bookstore' | 'library'
  if (mode !== 'enable' && mode !== 'disable') {
    log.err('Internal: expected "enable" or "disable" as the first argument.');
    process.exit(1);
  }
  if (collection !== 'bookstore' && collection !== 'library') {
    log.err('Internal: expected "bookstore" or "library" as the second argument.');
    process.exit(1);
  }

  const file = collection === 'library' ? paths.libraries : paths.bookstores;
  const relPath = `src/content/${collection === 'library' ? 'libraries' : 'bookstores'}.json`;
  const disableCmd = `npm run disable:${collection}`;

  const { positional, opts } = parseArgs(process.argv.slice(4));

  if (!existsSync(file)) {
    log.err(`${relPath} not found.`);
    process.exit(1);
  }
  const entries = JSON.parse(await readFile(file, 'utf8'));

  let id = positional[0] || opts.id;
  if (!id) {
    log.info(`${collection === 'library' ? 'Libraries' : 'Stores'}:`);
    entries.forEach((e) =>
      log.info(`  ${e.id}  —  ${e.name} ${e.enabled === false ? '(hidden)' : ''}`)
    );
    id = await prompt(`Which ${collection} id`);
  }

  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    log.err(`No ${collection} with id "${id}". Run \`${disableCmd}\` with no id to list them.`);
    process.exit(1);
  }

  const makeEnabled = mode === 'enable';
  if (makeEnabled && (typeof entry.lat !== 'number' || typeof entry.lng !== 'number')) {
    log.err(
      `Can't enable "${id}": it has no coordinates. Run \`npm run geocode -- "${entry.address}"\` and add lat/lng first.`
    );
    process.exit(1);
  }

  entry.enabled = makeEnabled;
  await writeFile(file, JSON.stringify(entries, null, 2) + '\n', 'utf8');

  log.rule();
  if (makeEnabled) {
    log.ok(`"${id}" is now shown — it will appear on the map and in the index.`);
  } else {
    log.ok(`"${id}" is now hidden — it won't appear on the map or in the index.`);
  }
  log.info('Run `npm run publish` to make this live.');
}

main();
