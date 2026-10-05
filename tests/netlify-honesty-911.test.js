// Invariants for netlify.toml (round 911).
// Class pinned: deploy config must only declare surface that can actually
// fire — header patterns that match no shipped file, redirects to routes
// that don't exist, function dirs that don't exist, and permissions that
// contradict what the app needs.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOML = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

describe('netlify.toml honesty', () => {
  test('cache header patterns match where assets actually ship (dist/assets/)', () => {
    // Vite emits hashed bundles to /assets/*.js|css and static assets live
    // under /assets/{icons,images}/ — root-level /*.js|*.png|*.jpg|*.svg
    // patterns only ever matched service-worker.js (which has its own rule).
    expect(TOML).not.toMatch(/for = "\/\*\.js"/);
    expect(TOML).not.toMatch(/for = "\/\*\.png"/);
    expect(TOML).not.toMatch(/for = "\/\*\.jpg"/);
    expect(TOML).not.toMatch(/for = "\/\*\.svg"/);
    expect(TOML).toMatch(/for = "\/assets\//);
  });

  test('no redirect rules for routes that cannot exist', () => {
    // The app is a single-page build at / — there is no /app/* route tree.
    expect(TOML).not.toMatch(/from = "\/app\//);
    // Netlify redirect patterns match paths, not schemes — an http:// :splat
    // rule can never fire (and Netlify already force-upgrades to HTTPS).
    expect(TOML).not.toMatch(/from = "http:\/\//);
  });

  test('no function directory declarations for dirs that do not exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'netlify'))).toBe(false);
    expect(TOML).not.toMatch(/netlify\/functions/);
    expect(TOML).not.toMatch(/netlify\/edge-functions/);
  });

  test('permissions policy never denies features the app requires', () => {
    // Voice input (Web Speech API / getUserMedia) is a real shipped feature —
    // a microphone=() directive on the app page silently kills it. The old
    // /*.html block overrode the permissive /* rule on exactly the page that
    // needs the mic.
    expect(TOML).not.toMatch(/microphone=\(\)/);
    expect(TOML).not.toMatch(/camera=\(\)/);
    expect(TOML).not.toMatch(/geolocation=\(\)/);
  });

  test('dev server config proxies the real dev entry, not raw source', () => {
    // `python -m http.server` serves the unbuilt tree — bare import
    // specifiers (import 'three') cannot resolve, same defect class as #1144.
    // netlify dev must proxy to vite instead.
    expect(TOML).not.toMatch(/python -m http\.server/);
    expect(TOML).toMatch(/command = "npm run dev"/);
  });

  test('csp script-src only allowlists hosts the app actually loads', () => {
    // index.html's only cdnjs reference is a preconnect — no script is ever
    // fetched from it, so the allowlist entry is dead surface.
    expect(TOML).not.toMatch(/cdnjs\.cloudflare\.com/);
  });

  test('no env vars that nothing in the deploy consumes', () => {
    // VR_BROWSER_VERSION is only read by jest globals and docker-compose —
    // a Netlify build env entry for it is write-only config.
    expect(TOML).not.toMatch(/VR_BROWSER_VERSION/);
  });

  test('keeps the live surface: build, service-worker headers, SPA 404 fallback', () => {
    expect(TOML).toMatch(/publish = "dist"/);
    expect(TOML).toMatch(/for = "\/service-worker\.js"/);
    expect(TOML).toMatch(/Service-Worker-Allowed/);
    expect(TOML).toMatch(/to = "\/index\.html"\s*\n\s*status = 404/);
  });
});
