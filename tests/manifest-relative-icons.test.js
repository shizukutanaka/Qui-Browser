/**
 * Manifest icon paths must be relative, and the install identity honest.
 *
 * The primary public deploy is a subpath (GitHub Pages serves the app at
 * /Qui-Browser/). Manifest member URLs resolve against the manifest's own
 * URL, so an icon src of "/assets/icons/icon-192.png" resolves to the
 * origin root and 404s under a subpath — the installed app then has no
 * icon (or fails installability checks) on exactly the channel meant for
 * distribution. Vite rewrites the icon links in index.html with the build
 * base, but public/manifest.json is copied verbatim, so the manifest has
 * to be correct as written. Relative srcs ("assets/icons/...") resolve
 * correctly at the root and under any subpath.
 *
 * The name/description are what the install prompt and the app library
 * show. They must describe the product that exists — a WebXR reader —
 * under its actual name, not a generic "web browser".
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));

describe('manifest installability under subpath deploys', () => {
  test('every icon src is relative (no leading slash) and resolves under public/', () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      expect(fs.existsSync(path.join(ROOT, 'public', icon.src))).toBe(true);
    }
  });

  test('install identity names the actual product', () => {
    expect(manifest.name).toBe('Qui Browser VR');
    expect(manifest.description).toContain('WebXR');
    expect(manifest.description).toContain('reader');
  });

  test('Quest-supported display mode is kept (standalone, never fullscreen)', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });
});
