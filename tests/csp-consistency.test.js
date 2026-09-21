/**
 * The meta CSP in index.html applies on EVERY deploy target (Pages serves no
 * headers, and meta policies AND with header policies elsewhere). Anything the
 * code can legitimately load must survive it — otherwise an opt-in feature is
 * documented in .env.example but dead on arrival.
 *
 * GA4 is opt-in via VITE_GA_MEASUREMENT_ID: initAnalytics() injects
 * <script src="https://www.googletagmanager.com/gtag/js"> — a host source that
 * script-src 'self' alone would block even where a platform's header CSP
 * allows it.
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const metaCsp = html.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/);
const directives = new Map(
  metaCsp[1].split(';').map((d) => {
    const parts = d.trim().split(/\s+/);
    return [parts[0], parts.slice(1)];
  })
);

test('index.html carries a meta CSP', () => {
  expect(metaCsp).not.toBeNull();
});

test('script-src permits the opt-in GA4 loader host', () => {
  expect(directives.get('script-src')).toContain('https://www.googletagmanager.com');
});

test('connect-src permits sentry ingest and GA collection (https:)', () => {
  // sentry.io ingest + google-analytics.com are https endpoints; 'https:'
  // covers both. An enumeration here would rot the moment either host moves.
  expect(directives.get('connect-src')).toContain('https:');
});

test('worker-src permits the same-origin service worker', () => {
  expect(directives.get('worker-src')).toContain("'self'");
});
