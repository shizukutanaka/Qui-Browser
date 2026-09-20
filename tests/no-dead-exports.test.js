/**
 * Dead-export sweep: every name exported from src/ must be referenced by at
 * least one other file (src, tests, or index.html). An `export` nobody
 * imports is dead public surface — it advertises an API that doesn't exist.
 * Measured 2026-09-20: 20 exported names (layout constants, helpers) were
 * referenced only inside their own module; the `export` keyword was removed.
 *
 * Known exclusion: src/monitoring.js exports (initSentry, initGoogleAnalytics,
 * trackPageView, …) are pending owner decision N-2 in
 * docs/OUTSTANDING_ISSUES.md — telemetry intent, not dead by accident.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EXCLUDED_FILES = new Set([path.join(SRC, 'monitoring.js')]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

const srcFiles = [...walk(SRC)];
const otherSources = [
  ...srcFiles,
  ...fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'tests', f)),
  path.join(ROOT, 'index.html'),
].map((p) => [p, fs.readFileSync(p, 'utf8')]);

const cases = [];
for (const file of srcFiles) {
  if (EXCLUDED_FILES.has(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n && /^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
    }
  }
  for (const name of names) {
    const rel = path.relative(ROOT, file);
    const referenced = otherSources.some(([p, body]) => p !== file && new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`).test(body));
    cases.push([`${rel}: ${name}`, referenced]);
  }
}

test.each(cases)('%s is referenced outside its own module', (_label, referenced) => {
  expect(referenced).toBe(true);
});
