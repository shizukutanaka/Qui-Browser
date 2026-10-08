/**
 * Static-surface honesty (round 856).
 *
 * Vite serves only publicDir ('public') plus bundled imports — every absolute
 * '/...' URL referenced by index.html or the manifest must resolve under
 * public/, and every file shipped in public/ must be referenced by the live
 * entry graph. Anything else is either a 404 waiting to happen or dead weight
 * deployed to production.
 *
 * Class pins:
 *  - every absolute src/href in index.html resolves under public/ or src/
 *  - every '"src": "/..."' in public/manifest.json resolves under public/
 *  - no file in public/ is unreferenced by index.html, src/, service-worker.js,
 *    or public/manifest.json
 *  - dead shipped files stay deleted (legacy sw.js / vr-browser / pwa era)
 *  - dead root configs stay deleted (root manifest.json duplicate, vercel.json)
 *  - netlify.toml builds dist/ and carries no header rules for deleted paths
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const listFiles = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk(dir);
  return out;
};

describe('static surface honesty', () => {
  test('absolute /... URLs in index.html resolve under public/ or src/', () => {
    const html = read('index.html');
    const urls = [...html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const rel = url.slice(1);
      expect(exists(path.join('public', rel)) || exists(rel)).toBe(true);
    }
  });

  test('every manifest icon src resolves under public/', () => {
    const manifest = JSON.parse(read(path.join('public', 'manifest.json')));
    const urls = [];
    const collect = (v) => {
      if (typeof v !== 'object' || v === null) {
        return;
      }
      for (const [k, val] of Object.entries(v)) {
        if (k === 'src' && typeof val === 'string') {
          urls.push(val);
        } else {
          collect(val);
        }
      }
    };
    collect(manifest);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(exists(path.join('public', url.replace(/^\//, '')))).toBe(true);
    }
  });

  test('every file shipped via public/ is referenced by the live entry graph', () => {
    const corpus =
      read('index.html') +
      read(path.join('public', 'service-worker.js')) +
      read(path.join('public', 'manifest.json')) +
      read(path.join('public', 'offline.html')) +
      read(path.join('src', 'main.js')) +
      // VRApp's asset-loader manifest is the runtime referrer for public/assets/sounds.
      read(path.join('src', 'vr', 'VRApp.js'));
    const unreferenced = listFiles('public').filter((rel) => {
      const name = path.basename(rel);
      if (name === '.gitkeep') {
        return false;
      }
      return !corpus.includes(name);
    });
    expect(unreferenced).toEqual([]);
  });

  test('legacy dead files stay out of the shipped surface', () => {
    for (const dead of [
      'public/sw.js',
      'public/js/pwa.js',
      'public/vr-browser.html',
      'public/vr-browser.js',
      'public/vr-video.html',
      'public/css-containment-optimizer.js',
      'public/lazy-loading-observer.js',
      'public/view-transitions-manager.js',
      'manifest.json',
      'vercel.json',
      'assets/css',
      'assets/styles',
      'assets/test-precompressed.txt'
    ]) {
      expect(exists(dead)).toBe(false);
    }
  });

  test('the app still ships its live service worker and offline fallback', () => {
    expect(exists(path.join('public', 'service-worker.js'))).toBe(true);
    expect(exists(path.join('public', 'offline.html'))).toBe(true);
    expect(read(path.join('src', 'main.js'))).toContain('service-worker.js');
  });

  test('the offline page registers the live worker, not the deleted sw.js', () => {
    const html = read(path.join('public', 'offline.html'));
    expect(html).toContain("register('service-worker.js')");
    expect(html).not.toContain('/sw.js');
  });

  test('netlify deploys the Vite build, not the raw source tree', () => {
    const toml = read('netlify.toml');
    expect(toml).toContain('publish = "dist"');
    expect(toml).toContain('command = "npm run build"');
    for (const dead of ['/sw.js', '/public/sw.js', '/assets/js/', '/assets/css/']) {
      expect(toml).not.toContain(`for = "${dead}`);
    }
  });

  test('icon generator writes the served surface under public/assets', () => {
    const tool = read(path.join('tools', 'generate-icons.mjs'));
    expect(tool).toContain("'public', 'assets'");
    expect(tool).not.toContain("join(root, 'assets'");
  });

  test('social-card meta points at served images on the real Pages path', () => {
    const html = read('index.html');
    expect(html).toContain('og:image');
    expect(html).toContain('twitter:image');
    expect(html).not.toContain('github.io/qui-browser');
  });

  test('live docs and tools no longer prescribe the deleted vercel.json', () => {
    expect(read(path.join('docs', 'DEPLOYMENT_GUIDE.md'))).not.toContain('git add vercel.json');
    expect(read(path.join('tools', 'verify-documentation.js'))).not.toContain('vercel.json');
  });
});
