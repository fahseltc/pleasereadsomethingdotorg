#!/usr/bin/env node
// update.mjs — refresh the local copy from GitHub with one friendly command
// (design §6). Wraps `git pull` and translates the result into plain language.
//
//   npm run update

import { spawnSync } from 'node:child_process';
import { ROOT, log } from './lib.mjs';

function git(args, capture = true) {
  // See publish.mjs: on Windows we run via the shell, so quote each arg to keep
  // values with spaces intact.
  const useShell = process.platform === 'win32';
  const finalArgs = useShell ? args.map(quoteArg) : args;
  return spawnSync('git', finalArgs, {
    cwd: ROOT,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: useShell,
  });
}

function quoteArg(arg) {
  const s = String(arg);
  if (s.length > 0 && !/[\s"()&|<>^]/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

function main() {
  const inRepo = (git(['rev-parse', '--is-inside-work-tree']).stdout || '').trim();
  if (inRepo !== 'true') {
    log.err("This folder isn't connected to GitHub yet.");
    log.info('Ask whoever set up the site to run the one-time setup (see README).');
    process.exit(1);
  }

  // Warn (don't block) if there are unsaved local edits.
  const dirty = (git(['status', '--porcelain']).stdout || '').trim();
  if (dirty) {
    log.warn('You have local edits that haven\'t been published yet.');
    log.info('If `npm run update` reports a conflict below, publish or ask for help before continuing.');
  }

  log.info('Checking GitHub for newer changes…');
  const pull = git(['pull', '--ff-only'], false);
  if (pull.status === 0) {
    log.ok('Your copy is up to date.');
    return;
  }

  // ff-only failed: histories diverged. Try a normal merge pull for a clearer message.
  const merge = git(['pull'], true);
  const out = `${merge.stdout || ''}\n${merge.stderr || ''}`.toLowerCase();
  if (merge.status === 0) {
    log.ok('Pulled in the latest changes.');
  } else if (out.includes('conflict')) {
    log.err('Your changes and the ones on GitHub overlap and can\'t be merged automatically.');
    log.info('This one needs a hand — ask whoever set up the site to help resolve it.');
    process.exit(1);
  } else {
    log.err('Could not update automatically.');
    log.info((merge.stderr || '').trim());
    process.exit(1);
  }
}

main();
