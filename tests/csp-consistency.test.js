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

test('worker-src permits blob: workers (KTX2 transcoder needs them)', () => {
  // KTX2Loader builds its basis transcoder workers from a Blob URL —
  // worker-src 'self' alone leaves KTX2 texture decode dead on every target.
  expect(directives.get('worker-src')).toContain('blob:');
});

test('media-src permits user-supplied video URLs', () => {
  // ImmersiveVideo sets video.src to whatever URL the user types — without
  // media-src the request falls back to default-src 'self' and external
  // https:// video is dead on Pages (no headers there to widen it).
  const ms = directives.get('media-src');
  expect(ms).toContain('https:');
  expect(ms).toContain('blob:');
});

test('connect-src permits a loopback reader proxy', () => {
  // The documented reader-proxy path is adb reverse → http://127.0.0.1:8080.
  // connect-src 'self' https: blocks every http: fetch — even loopback — so
  // without these entries the proxy feature cannot reach anything.
  const cs = directives.get('connect-src');
  expect(cs).toContain('http://127.0.0.1:*');
  expect(cs).toContain('http://localhost:*');
});

test('script-src contains no unsafe-inline (offline.js is external)', () => {
  expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
});

// Header CSPs AND with the meta one — a directive that diverges silently kills
// the feature on that deploy target only. Keep every policy literally identical.
const toMap = (s) => new Map(
  s.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const p = d.split(/\s+/);
    return [p[0], p.slice(1).sort().join(' ')];
  })
);

function headerCsps() {
  const csps = [];
  const conf = fs.readFileSync(
    path.join(__dirname, '..', 'docker', 'nginx.conf'), 'utf8');
  for (const m of conf.matchAll(/add_header Content-Security-Policy "([^"]+)"/g)) {
    csps.push(['nginx.conf', m[1]]);
  }
  const vercel = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  for (const route of vercel.headers ?? []) {
    for (const h of route.headers ?? []) {
      if (h.key === 'Content-Security-Policy') {
        csps.push(['vercel.json', h.value]);
      }
    }
  }
  const netlify = fs.readFileSync(
    path.join(__dirname, '..', 'netlify.toml'), 'utf8');
  for (const m of netlify.matchAll(/Content-Security-Policy = "([^"]+)"/g)) {
    csps.push(['netlify.toml', m[1]]);
  }
  return csps;
}

test('every header CSP across deploy targets is identical to the meta CSP', () => {
  const csps = headerCsps();
  // nginx (server + location / + location ~*.html$), vercel, netlify.
  expect(csps.length).toBeGreaterThanOrEqual(5);
  for (const [_source, csp] of csps) {
    expect(toMap(csp)).toEqual(toMap(metaCsp[1]));
  }
});

// Same divergence class as CSP: a Permissions-Policy that denies
// xr-spatial-tracking kills WebXR on that deploy target only, and the meta
// tag cannot carry Permissions-Policy at all — headers are the whole story.
const WEBXR_PP = 'accelerometer=*, camera=*, gyroscope=*, magnetometer=*, microphone=*, xr-spatial-tracking=*';

test('every deploy target permits the WebXR Permissions-Policy on HTML', () => {
  const nginx = fs.readFileSync(
    path.join(__dirname, '..', 'docker', 'nginx.conf'), 'utf8');
  // Both HTML-serving locations must carry it: location / (SPA fallback) and
  // location ~* .html$ (direct hits) — a location with its own add_header
  // inherits none of the server-level headers.
  expect(nginx.split(WEBXR_PP).length - 1).toBe(2);

  const vercel = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const ppValues = (vercel.headers ?? []).flatMap((r) => r.headers ?? [])
    .filter((h) => h.key === 'Permissions-Policy').map((h) => h.value);
  expect(ppValues).toContain(WEBXR_PP);

  const netlify = fs.readFileSync(
    path.join(__dirname, '..', 'netlify.toml'), 'utf8');
  expect(netlify).toContain(WEBXR_PP);
});
