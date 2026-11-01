#!/usr/bin/env node
// fix-images.mjs — keeps image file names and references in exact lowercase
// agreement, so the live site (case-sensitive) serves every image.
//
//   npm run fix-images
//
// Runs on every `npm run dev` and `npm run publish`. It always does the following,
// with no flags:
//
//   1. Renames files under public/ that have capital letters to lowercase on
//      disk. public/CNAME is kept as-is, because GitHub Pages requires it.
//   2. Rewrites each /images/... reference in src/ whose case no longer matches
//      the file on disk.
//   3. Updates git's index so git tracks the disk spelling. Nothing is committed
//      here. Publish commits the change.
//
// Why this exists: Windows file systems ignore letter case, so
// /images/libraries/calhan.png finds Calhan.png during local development. GitHub
// Pages serves from a case-sensitive Linux system, where the same URL returns 404
// after the deploy.
//
// Also warns about references to files that are not in public/ at all. Those
// may be images that have not been added yet. The script exits with code 1 only
// when an error remains after the fixes.
//
// Node built-ins only.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { ROOT, log } from './lib.mjs';

const PUBLIC_DIR = join(ROOT, 'public');
const SRC_DIR = join(ROOT, 'src');
// GitHub Pages requires the custom-domain file to be named exactly CNAME.
const KEEP_UPPERCASE = new Set(['CNAME']);

// An image URL starts with /images/ and is not preceded by a word character, dot,
// or slash. That keeps "public/images/..." inside prose from matching.
const IMAGE_URL = /(?<![\w./])\/images\/[^"'\s)\]}`<>]+/g;

// Lines that are comments in their file's syntax are not real references.
const COMMENT_LINE = /^(#|\*|\/\/)/;

// Comments in Markdown and MDX never render, so text inside them is not a reference.
// The new-post template puts its photo instructions inside {/* ... */}.
const BLOCK_COMMENT = /\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g;

const dirCache = new Map();

/** Names inside a directory, spelled exactly as the file system stores them. */
function namesIn(dir) {
  if (!dirCache.has(dir)) {
    const isDir = statSync(dir, { throwIfNoEntry: false })?.isDirectory();
    dirCache.set(dir, isDir ? readdirSync(dir) : []);
  }
  return dirCache.get(dir);
}

/**
 * Resolve a URL path such as /images/libraries/calhan.png against public/.
 * Returns { status: 'ok' }, { status: 'case', actual } when the path matches only
 * with case ignored (actual is the on-disk spelling), or { status: 'missing' }.
 */
function resolveOnDisk(urlPath) {
  const parts = urlPath.split('/').filter(Boolean);
  let dir = PUBLIC_DIR;
  const actual = [];
  let exact = true;
  for (const part of parts) {
    const names = namesIn(dir);
    const name = names.includes(part)
      ? part
      : names.find((n) => n.toLowerCase() === part.toLowerCase());
    if (name === undefined) return { status: 'missing' };
    if (name !== part) exact = false;
    actual.push(name);
    dir = join(dir, name);
  }
  return exact ? { status: 'ok' } : { status: 'case', actual: '/' + actual.join('/') };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Blank out comment regions but keep their newlines, so line numbers stay correct. */
function stripComments(text) {
  return text.replace(BLOCK_COMMENT, (m) => m.replace(/[^\n]/g, ''));
}

/** Every /images/... reference in the site source, with its file and line. */
function collectReferences() {
  const refs = [];
  for (const file of walk(SRC_DIR)) {
    if (!/\.(json|md|mdx|astro)$/.test(file)) continue;
    const raw = readFileSync(file, 'utf8');
    const text = /\.mdx?$/.test(file) ? stripComments(raw) : raw;
    text.split(/\r?\n/).forEach((line, i) => {
      if (COMMENT_LINE.test(line.trim())) return;
      for (const match of line.matchAll(IMAGE_URL)) {
        const url = match[0].replace(/[.,;:!?]+$/, '');
        if (url.endsWith('/')) continue; // a folder name in prose, not an image
        refs.push({ url, file: relative(ROOT, file), line: i + 1 });
      }
    });
  }
  return refs;
}

/** Paths git tracks under public/, relative to the project root. Null if git is unavailable. */
function trackedPublicFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', 'public'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/** Find every mismatch between the references, git's names, and the disk. */
function analyze() {
  const refs = collectReferences();
  const caseRefs = [];
  const missing = [];
  for (const ref of refs) {
    const result = resolveOnDisk(ref.url);
    if (result.status === 'case') caseRefs.push({ ...ref, actual: result.actual });
    else if (result.status === 'missing') missing.push(ref);
  }

  const tracked = trackedPublicFiles();
  const gitMismatches = [];
  if (tracked !== null) {
    for (const path of tracked) {
      const gitUrl = '/' + path.slice('public/'.length);
      const result = resolveOnDisk(gitUrl);
      if (result.status === 'case') {
        gitMismatches.push({ gitPath: path, diskPath: 'public' + result.actual });
      }
    }
  }

  return { refs, caseRefs, missing, gitMismatches, gitAvailable: tracked !== null };
}

/** Rewrite each mismatched reference in its source file to the disk spelling. */
function fixReferences(caseRefs) {
  const byFile = new Map();
  for (const ref of caseRefs) {
    if (!byFile.has(ref.file)) byFile.set(ref.file, []);
    byFile.get(ref.file).push(ref);
  }

  let changed = 0;
  for (const [file, refs] of byFile) {
    const abs = join(ROOT, file);
    const lines = readFileSync(abs, 'utf8').split('\n');
    for (const ref of refs) {
      const i = ref.line - 1;
      const updated = lines[i].split(ref.url).join(ref.actual);
      if (updated !== lines[i]) {
        lines[i] = updated;
        changed++;
      }
    }
    writeFileSync(abs, lines.join('\n'));
  }
  return changed;
}

/** Make git track the disk spelling. Removing the old entry first avoids the case-insensitive index match. */
function renameInGitIndex({ gitPath, diskPath }) {
  const opts = { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' };
  execFileSync('git', ['rm', '--cached', '--quiet', '--', gitPath], opts);
  execFileSync('git', ['add', '--', diskPath], opts);
}

/**
 * Rename every file under public/ whose name has capitals to lowercase on disk.
 * Returns the number of files renamed. Git's names and the references are
 * updated afterward by main().
 */
function lowercasePublicFiles() {
  const files = walk(PUBLIC_DIR).map((abs) => relative(ROOT, abs).replace(/\\/g, '/'));
  const fileSet = new Set(files);
  const renames = [];
  for (const rel of files) {
    const name = basename(rel);
    if (name === name.toLowerCase() || KEEP_UPPERCASE.has(name)) continue;
    const to = rel.slice(0, rel.length - name.length) + name.toLowerCase();
    // Two files differing only by case would merge into one name. Stop before any rename.
    if (fileSet.has(to)) throw new Error(`Cannot rename "${rel}": "${to}" already exists.`);
    renames.push({ from: rel, to });
  }

  for (const { from, to } of renames) {
    renameSync(join(ROOT, from), join(ROOT, to));
    log.ok(`Renamed "${from}" to "${to}".`);
  }
  dirCache.clear(); // directory listings changed on disk
  return renames.length;
}

function main() {
  lowercasePublicFiles();

  const first = analyze();

  if (first.caseRefs.length > 0) {
    const changed = fixReferences(first.caseRefs);
    log.ok(`Updated ${changed} image reference(s) to match the files on disk.`);
  }
  for (const m of first.gitMismatches) {
    try {
      renameInGitIndex(m);
      log.ok(`git now tracks "${m.diskPath}" (it was "${m.gitPath}").`);
    } catch (err) {
      log.err(`Could not update git's name for "${m.gitPath}": ${err.message.split('\n')[0]}`);
      process.exit(1);
    }
  }

  const report = analyze();
  const errors = [];
  for (const r of report.caseRefs) {
    errors.push(
      `${r.file}:${r.line}  "${r.url}" still does not match the file on disk ("${r.actual}").`,
    );
  }
  for (const m of report.gitMismatches) {
    errors.push(`git tracks "${m.gitPath}", but the file on disk is "${m.diskPath}".`);
  }
  for (const r of report.missing) {
    log.warn(`${r.file}:${r.line}  "${r.url}" does not match any file in public/. The image may not be added yet.`);
  }
  if (!report.gitAvailable) {
    log.warn('git is not available, so the git spelling check was skipped.');
  }

  for (const e of errors) log.err(e);

  if (errors.length > 0) {
    log.info(`Image check failed with ${errors.length} error(s) that could not be fixed automatically.`);
    process.exit(1);
  }
  log.ok(`Image paths match the files exactly (${report.refs.length} references checked).`);
}

main();
