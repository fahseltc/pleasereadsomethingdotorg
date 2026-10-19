#!/usr/bin/env node
// toggle-bookstore.mjs — show/hide a store on the map without editing JSON by
// hand (design §6). Backs both `npm run disable:bookstore` and `enable:bookstore`.
//
//   npm run disable:bookstore -- boulder-bookstore
//   npm run enable:bookstore -- boulder-bookstore

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs, prompt, paths, log } from './lib.mjs';

async function main() {
  const mode = process.argv[2]; // 'enable' | 'disable' (set by package.json)
  if (mode !== 'enable' && mode !== 'disable') {
    log.err('Internal: expected "enable" or "disable" as the first argument.');
    process.exit(1);
  }
  const { positional, opts } = parseArgs(process.argv.slice(3));

  if (!existsSync(paths.bookstores)) {
    log.err('src/content/bookstores.json not found.');
    process.exit(1);
  }
  const stores = JSON.parse(await readFile(paths.bookstores, 'utf8'));

  let id = positional[0] || opts.id;
  if (!id) {
    log.info('Stores:');
    stores.forEach((s) =>
      log.info(`  ${s.id}  —  ${s.name} ${s.enabled === false ? '(hidden)' : ''}`)
    );
    id = await prompt('Which store id');
  }

  const store = stores.find((s) => s.id === id);
  if (!store) {
    log.err(`No store with id "${id}".`);
    process.exit(1);
  }

  const makeEnabled = mode === 'enable';
  if (makeEnabled && (typeof store.lat !== 'number' || typeof store.lng !== 'number')) {
    log.err(
      `Can't enable "${id}": it has no coordinates. Run \`npm run geocode -- "${store.address}"\` and add lat/lng first.`
    );
    process.exit(1);
  }

  store.enabled = makeEnabled;
  await writeFile(paths.bookstores, JSON.stringify(stores, null, 2) + '\n', 'utf8');

  log.rule();
  if (makeEnabled) {
    log.ok(`"${id}" is now shown — it will appear on the map and in the index.`);
  } else {
    log.ok(`"${id}" is now hidden — it won't appear on the map or in the index.`);
  }
  log.info('Run `npm run publish` to make this live.');
}

main();
