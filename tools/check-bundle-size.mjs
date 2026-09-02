/**
 * Budget the bundle that actually ships.
 *
 * This replaces `tools/benchmark.js`, which timed `require()` of files under
 * `assets/js/` — deleted in Session 74. With nothing left to measure it found
 * zero modules and crashed on its own summary, so the CI job running it was
 * permanently red while saying nothing about the code. Its companion regression
 * checker compared against a baseline file that is not in the repo.
 *
 * What is worth measuring instead is size, for a reason specific to this
 * product: on a standalone headset every byte is downloaded and parsed on a
 * mobile SoC before the user sees anything, and the regression that matters is
 * silent. It has already happened here — `TextureManager` wired a KTX2
 * transcoder path that dragged three's `KTX2Loader` into the tier1 chunk, and
 * nobody noticed until the module was deleted for unrelated reasons and the
 * chunk fell from 31.4 kB gzip to 7.3 kB. Nothing would have caught that.
 *
 * Per-chunk budgets, not just a total: a 24 kB library landing in a 7 kB chunk
 * barely moves a total dominated by three.js, but it quadruples that chunk. The
 * total is the second net, for growth spread thinly across everything.
 *
 * Budgets are deliberately edited, never auto-updated. A tool that rewrites its
 * own baseline records regressions instead of preventing them.
 *
 * Verified by injection rather than a unit test, as the other tools here are:
 *   - KTX2Loader made reachable from tier1 (the real Session 74 regression)
 *     -> FAIL, tier1 30.2 kB against a 12 kB budget, plus the total
 *   - chunk-identity regex broken, the one fail-open risk in this file
 *     -> FAIL, every chunk reported unbudgeted; it cannot pass silently
 * Both restored to exit 0 afterwards.
 *
 * Usage: npm run build && npm run verify:size
 */

import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = join(REPO_ROOT, 'dist');

/**
 * Gzipped budgets in bytes, keyed by chunk name with the content hash stripped.
 *
 * Set from the measured size plus headroom — enough that ordinary feature work
 * does not trip the check, tight enough that a stray library does. Raising one
 * is a normal thing to do; doing it without knowing what grew is not.
 */
const BUDGETS = {
  // Measured against the tree `npm ci` installs (three 0.181.2). An earlier
  // figure of 118.7 kB here came from a stale node_modules holding an older
  // three — the same stale-install mistake that hid an ESLint 9 failure, found
  // together. Three did not grow 22 kB in a commit; the old number was wrong.
  'vendor-three': 152_000, // three.js itself; only moves on an upgrade
  app: 60_000,
  index: 5_000,
  tier1: 12_000, // was 31.4 kB while KTX2Loader was reachable — that is the shape to catch
  'tier2-input': 13_000,
  'tier2-audio': 5_000,
  'tier2-interaction': 4_000,
  'web-vitals': 4_000,
  'service-worker': 7_000,
  assets: 4_000 // the single stylesheet
};

/** Total gzipped JS + CSS. Guards growth spread too thinly to trip any one chunk. */
const TOTAL_BUDGET = 248_000;

/** Content hashes Vite appends: `-` plus 8 base64url characters. */
const HASH = /-[A-Za-z0-9_-]{8}$/;

/** Chunk identity, independent of the build's content hash. */
export function chunkName(file) {
  const stem = basename(file, extname(file));
  return stem.replace(HASH, '');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function main() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    console.error('verify:size — dist/ missing. Run `npm run build` first.');
    process.exit(2);
  }

  const code = files.filter((f) => ['.js', '.css'].includes(extname(f)));
  if (!code.length) {
    console.error('verify:size — dist/ contains no JS or CSS. That is not a build.');
    process.exit(2);
  }

  const rows = code
    .map((f) => ({
      name: chunkName(f),
      rel: f.slice(DIST.length + 1),
      gz: gzipSync(readFileSync(f)).length
    }))
    .sort((a, b) => b.gz - a.gz);

  const failures = [];
  const kb = (n) => (n / 1000).toFixed(1).padStart(7) + ' kB';

  console.log('verify:size — gzipped size of what ships\n');
  for (const r of rows) {
    const budget = BUDGETS[r.name];
    if (budget === undefined) {
      // An unbudgeted chunk is not a pass: a new chunk should be a deliberate
      // decision, and silently exempting it is how budgets stop meaning anything.
      failures.push(`${r.rel} (${kb(r.gz)}) has no budget — add one to BUDGETS`);
      console.log(`  FAIL  ${kb(r.gz)}  ${r.rel}  (no budget)`);
      continue;
    }
    const ok = r.gz <= budget;
    if (!ok) {
      failures.push(`${r.rel}: ${kb(r.gz)} exceeds its ${kb(budget)} budget`);
    }
    const pct = Math.round((r.gz / budget) * 100);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${kb(r.gz)}  ${r.rel}  (${pct}% of budget)`);
  }

  const total = rows.reduce((n, r) => n + r.gz, 0);
  const totalOk = total <= TOTAL_BUDGET;
  if (!totalOk) {
    failures.push(`total ${kb(total)} exceeds the ${kb(TOTAL_BUDGET)} budget`);
  }
  console.log(
    `\n  ${totalOk ? 'ok  ' : 'FAIL'}  ${kb(total)}  TOTAL js+css ` +
      `(${Math.round((total / TOTAL_BUDGET) * 100)}% of ${kb(TOTAL_BUDGET)})\n`
  );

  if (failures.length) {
    console.error(`FAIL — ${failures.length} budget problem(s):`);
    for (const f of failures) {
      console.error('  • ' + f);
    }
    console.error(
      '\nIf the growth is intended, raise the budget in tools/check-bundle-size.mjs\n' +
        'and say in the commit what grew. If it is not, find what got pulled in.'
    );
    process.exit(1);
  }
  console.log('PASS — every chunk and the total are within budget.');
}

main();
