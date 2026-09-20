/**
 * PWA manifest integrity: every icon the manifest advertises must exist
 * under public/ (the only directory Vite copies verbatim into dist/).
 * Measured 2026-09-20: all 7 icon srcs pointed at /assets/icons/*.png —
 * which lives at the REPO ROOT, not public/ — so the shipped bundle
 * shipped a manifest whose every icon 404'd (Quest install icon blank).
 * Relative 'icons/…' srcs (matching start_url './') also keep the
 * manifest correct under a non-root BASE_PATH.
 */
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'manifest.json'), 'utf8'));

describe('public/manifest.json icon integrity', () => {
  const icons = manifest.icons.map((i) => i.src);

  test('manifest declares icons', () => {
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });

  test.each(icons.map((src, i) => [src, i]))('%s resolves inside public/', (src) => {
    // Relative URL resolves against the manifest URL → public/icons/…
    expect(src.startsWith('/')).toBe(false); // absolute paths bypass BASE_PATH
    const p = path.join(__dirname, '..', 'public', src);
    expect(fs.existsSync(p)).toBe(true);
  });
});
