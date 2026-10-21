// Shared helpers for the authoring scripts. Node built-ins only.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');
export const paths = {
  bookstores: resolve(ROOT, 'src/content/bookstores.json'),
  libraries: resolve(ROOT, 'src/content/libraries.json'),
  blogDir: resolve(ROOT, 'src/content/blog'),
  dataDir: resolve(ROOT, 'src/data'),
  storeImages: resolve(ROOT, 'public/images/bookstores'),
  libraryImages: resolve(ROOT, 'public/images/libraries'),
  blogImages: resolve(ROOT, 'public/images/blog'),
};

/** Turn a title/name into a URL-safe slug. */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Parse `--key value` / `--key=value` / bare positional args. */
export function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inlineV] = a.slice(2).split('=');
      if (inlineV !== undefined) {
        opts[k] = inlineV;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        opts[k] = argv[++i];
      } else {
        opts[k] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

/** Minimal interactive prompt (resolves to '' on empty / non-TTY). */
export function prompt(question, fallback = '') {
  if (!process.stdin.isTTY) return Promise.resolve(fallback);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    const suffix = fallback ? ` [${fallback}]` : '';
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      res(answer.trim() || fallback);
    });
  });
}

// ANSI colors — on only for an interactive terminal, and disabled when NO_COLOR
// is set or output is piped/redirected (so logs stay clean in CI/pipes).
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
export const color = {
  green: (s) => paint('32', s),
  red: (s) => paint('31;1', s), // bold red for errors
  yellow: (s) => paint('33', s),
  dim: (s) => paint('2', s),
};

export const log = {
  info: (m) => console.log(m),
  ok: (m) => console.log(color.green(`\u2713 ${m}`)),
  warn: (m) => console.warn(color.yellow(`! ${m}`)),
  err: (m) => console.error(color.red(`\u2717 ${m}`)),
  rule: () => console.log(color.dim('\u2500'.repeat(60))),
};

/**
 * Build a Google Maps "search" link that lands on the BUSINESS, not just a map
 * dot. Google's search URL takes any free-text query, so we query by store
 * NAME + address: the name makes Google resolve the actual place (showing its
 * card, hours, reviews), and the address disambiguates common names. No API
 * key or runtime lookup — Google does the search when the user clicks.
 *
 * For an exact match on an ambiguous store, set `mapsLink` by hand in
 * bookstores.json to a Place ID URL:
 *   https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<ID>
 */
export function mapsLinkFor(name, address) {
  const query = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
