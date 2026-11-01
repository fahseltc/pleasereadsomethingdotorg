#!/usr/bin/env node
// publish.mjs — put the site live without the author touching git (design §6).
//
//   npm run publish
//   npm run publish -- -m "Add Boulder Bookstore"
//
// Steps: build (safety check) -> stage -> commit -> push to main, which triggers
// the GitHub Actions deploy. All git output is wrapped in plain language.

import { spawnSync } from 'node:child_process';
import { parseArgs, ROOT, log } from './lib.mjs';

// Shown after a successful publish. The timing comes from the GitHub Actions
// "Deploy to GitHub Pages" workflow, measured from run start to the site going
// live. Last 15 successful runs, pulled 2026-11-01: median 143 s. Thirteen of the
// 15 finished in 106 to 193 s. Two slow runs took 403 s and 746 s. Update these
// numbers if the typical time changes.
const SITE_URL = 'https://pleasereadsomething.org/';
const ESTIMATE_MIN_MINUTES = 2;
const ESTIMATE_MAX_MINUTES = 3;

function run(cmd, args, { capture = false } = {}) {
  // On Windows we run through the shell (so `git`/`npm` resolve via PATH),
  // but that means spawnSync joins args into a command string and the shell
  // re-splits on spaces. Quote each arg so values like a commit message with
  // spaces/parens stay a single argument. On non-Windows we pass args directly
  // (no shell), so no quoting is needed.
  const useShell = process.platform === 'win32';
  const finalArgs = useShell ? args.map(quoteArg) : args;
  const res = spawnSync(cmd, finalArgs, {
    cwd: ROOT,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: useShell,
  });
  return res;
}

// Wrap an argument in double quotes for cmd.exe, escaping embedded quotes.
function quoteArg(arg) {
  const s = String(arg);
  if (s.length > 0 && !/[\s"()&|<>^]/.test(s)) return s; // safe bare token
  return `"${s.replace(/"/g, '\\"')}"`;
}

function gitOut(args) {
  const res = run('git', args, { capture: true });
  return (res.stdout || '').trim();
}

function main() {
  const { opts } = parseArgs(process.argv.slice(2));
  const message = typeof opts.m === 'string' ? opts.m : null;

  // 0. Must be a git repo.
  if (gitOut(['rev-parse', '--is-inside-work-tree']) !== 'true') {
    log.err("This folder isn't connected to GitHub yet.");
    log.info('Ask whoever set up the site to run the one-time git/GitHub setup (see README).');
    process.exit(1);
  }

  // 1. Make image names match the files on disk. Runs before the "nothing
  //    changed" check so a casing problem on the live site still gets fixed.
  log.info('Checking image names…');
  const imageCheck = run('node', ['scripts/fix-images.mjs']);
  if (imageCheck.status !== 0) {
    log.err('Some image names still do not match their files, so nothing was published.');
    log.info('Fix the names listed above, then run `npm run publish` again.');
    process.exit(1);
  }

  // 2. Anything to publish?
  const status = gitOut(['status', '--porcelain']);
  if (!status) {
    log.ok('Nothing has changed since the last publish — the live site is already up to date.');
    return;
  }

  // 3. Build as a safety check so a broken site is caught before going live.
  log.info('Checking the site builds…');
  const build = run('npm', ['run', 'build']);
  if (build.status !== 0) {
    log.err('The site did not build, so nothing was published.');
    log.info('Fix the error shown above (often a typo in a post or a missing lat/lng), then run `npm run publish` again.');
    process.exit(1);
  }

  // 4. Stage everything (content + images + data).
  run('git', ['add', '-A']);

  // 5. Commit with an auto message if none provided.
  const auto = message || `Update site content (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`;
  const commit = run('git', ['commit', '-m', auto]);
  if (commit.status !== 0) {
    log.err('Could not save the changes. Nothing was published.');
    process.exit(1);
  }

  // 6. Push to the current branch's upstream (main).
  log.info('Publishing…');
  const push = run('git', ['push'], { capture: true });
  if (push.status !== 0) {
    const err = (push.stderr || '').toLowerCase();
    if (err.includes('rejected') || err.includes('non-fast-forward') || err.includes('fetch first')) {
      log.err('Someone (or another device) changed the site since you last pulled.');
      log.info('Run `npm run update` to pull those changes in, then `npm run publish` again.');
    } else if (err.includes('no upstream') || err.includes('has no upstream branch')) {
      log.err('This copy isn\'t linked to GitHub yet.');
      log.info('Ask whoever set up the site to finish the one-time GitHub setup (see README).');
    } else {
      log.err('Publishing failed. The changes were saved locally but not sent to GitHub.');
      log.info((push.stderr || '').trim());
    }
    process.exit(1);
  }

  log.rule();
  log.ok('Published. Your changes are building now.');
  log.info(`Site: ${SITE_URL}`);
  log.info(`It usually updates in about ${ESTIMATE_MIN_MINUTES} to ${ESTIMATE_MAX_MINUTES} minutes.`);
  log.info('If the page still shows the old version after that, press Ctrl+F5 to reload it. This skips the browser cache.');
}

main();
