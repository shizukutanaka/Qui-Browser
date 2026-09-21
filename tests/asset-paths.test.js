/**
 * Static-asset path coherence: every literal '/…' asset URL must resolve to a
 * file that actually ships.
 *
 * Two resolution classes:
 *  - src/ runtime fetches → served from public/ verbatim (plus the built
 *    bundles). A path that isn't under public/ is a guaranteed 404.
 *  - index.html link/script refs → resolved by Vite at build time against the
 *    repo root (public/, then repo-root assets/), and public/ html refs are
 *    served verbatim.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

const literalUrls = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/['"`](\/(?:assets|icons|sounds|sounds|fonts)[^'"`\s]*)['"`]/g)]
    .map((m) => m[1]);

describe('static asset paths resolve to shipped files', () => {
  test('runtime asset URLs in src/ exist under public/', () => {
    const violations = [];
    for (const file of walk(SRC).filter((f) => f.endsWith('.js'))) {
      for (const url of literalUrls(file)) {
        if (!fs.existsSync(path.join(PUBLIC, url))) {
          violations.push(`${path.relative(ROOT, file)}: ${url}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('index.html asset refs resolve against public/ or repo-root assets/', () => {
    const violations = [];
    const file = path.join(ROOT, 'index.html');
    for (const m of fs.readFileSync(file, 'utf8')
      .matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const url = m[1];
      if (!url.startsWith('/') || url.startsWith('//')) {
        continue;
      }
      const ok =
        fs.existsSync(path.join(PUBLIC, url)) ||
        fs.existsSync(path.join(ROOT, url));
      if (!ok) {
        violations.push(url);
      }
    }
    expect(violations).toEqual([]);
  });

  test('public html asset refs exist under public/', () => {
    const violations = [];
    for (const file of walk(PUBLIC).filter((f) => f.endsWith('.html'))) {
      for (const m of fs.readFileSync(file, 'utf8')
        .matchAll(/(?:href|src)="([^"#]+)"/g)) {
        const url = m[1];
        if (!url.startsWith('/')) {
          continue;
        }
        if (!fs.existsSync(path.join(PUBLIC, url))) {
          violations.push(`${path.relative(PUBLIC, file)}: ${url}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('no shadowed root-level duplicates of public/ entry points', () => {
    // manifest.json / service-worker.js / offline.html live in public/ and are
    // copied to dist verbatim. Stale duplicates at the repo root served
    // different content under the raw-root Vercel deploy and confuse anyone
    // editing the wrong copy.
    for (const name of ['manifest.json', 'service-worker.js', 'offline.html']) {
      expect(fs.existsSync(path.join(ROOT, name))).toBe(false);
    }
  });
});
