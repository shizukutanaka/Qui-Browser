/**
 * Offline fallback page invariants (public/offline.html + offline.js).
 *
 * The offline page is the only user-facing surface that must render with
 * zero app code — and it is the app's own accessibility-first product, so
 * the WCAG pins below are load-bearing, not cosmetic.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/offline.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/offline.js'), 'utf8');

describe('offline.html', () => {
  test('infinite pulse respects prefers-reduced-motion (WCAG 2.3.3)', () => {
    expect(html).toMatch(/animation:\s*pulse\s+2s\s+infinite/);
    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(html).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?animation:\s*none/);
  });

  test('connection status is announced to screen readers (WCAG 4.1.3)', () => {
    expect(html).toMatch(/class="connection-status"[^>]*role="status"/);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
  });

  test('features disclosure exposes expanded state (WCAG 4.1.2)', () => {
    expect(html).toMatch(/id="btn-features"[^>]*aria-expanded="false"[^>]*aria-controls="offline-features"/);
    expect(js).toMatch(/setAttribute\('aria-expanded',\s*String\(open\)\)/);
  });

  test('no inline scripts — CSP script-src has no unsafe-inline', () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/\son(click|load|error)=/);
  });

  test('feature list names only capabilities that exist', () => {
    // It previously advertised extensions, email composition and local-file
    // access — none of which exist in this product.
    expect(html).not.toMatch(/extensions|emails|local files/i);
  });
});

describe('offline.js', () => {
  test('honours the app language choice for Japanese users', () => {
    expect(js).toContain('qui-browser:lang');
    expect(js).toMatch(/document\.documentElement\.lang\s*=\s*'ja'/);
    expect(js).toContain('再接続を試みています');
  });

  test('auto-reload fires only on a real offline→online transition', () => {
    expect(js).toMatch(/addEventListener\('online'[\s\S]*?location\.reload/);
    // onLine=true while the site is still down would loop forever — the poll
    // must update the status text, never reload.
    expect(js).not.toMatch(/checkOnlineStatus[\s\S]{0,200}reload/);
  });
});
