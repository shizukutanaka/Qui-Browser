/**
 * Class-pinning invariants for the service worker's cache surface.
 *
 * The worker must only declare strategies for asset classes that can actually
 * be fetched, listeners for events that can actually fire, and stores that
 * have a reader. Anything else is dead surface lying to the next reader
 * (the KTX2/GLB/WASM/font patterns and the 'textures'/'models' cache buckets
 * described pipelines removed at #1121 and endpoints that never existed).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'service-worker.js'), 'utf8');

describe('service worker — no dead cache-strategy surface', () => {
  test('no cache-first strategy remains (no same-origin asset class matches)', () => {
    expect(SW).not.toMatch(/cacheFirst|cache-first/i);
  });

  test('no patterns for asset classes that cannot exist in this app', () => {
    // .ktx2 pipeline removed at #1121; no .wasm/.glb/.gltf/.woff/fonts assets
    // exist anywhere in public/ or are produced by the Vite build.
    expect(SW).not.toMatch(/ktx2|\.wasm|\.glb|\.gltf|woff|fonts\//i);
  });

  test('no API/WebSocket network-first patterns (no such endpoints exist)', () => {
    expect(SW).not.toMatch(/\/api\/|\/socket/);
  });

  test('per-class cache buckets are gone (textures/models were never real)', () => {
    expect(SW).not.toMatch(/CACHE_LIMITS\b/);
    expect(SW).not.toMatch(/['"]textures['"]|['"]models['"]/);
  });
});

describe('service worker — no unreachable listeners or dead stores', () => {
  test('no message listener (nothing in the app posts to the worker)', () => {
    expect(SW).not.toMatch(/addEventListener\(['"]message['"]/);
    expect(SW).not.toMatch(/SKIP_WAITING|GET_STATS|CLEAR_CACHE|PRELOAD_ASSETS/);
  });

  test('no sync listener stub (no sync registration exists)', () => {
    expect(SW).not.toMatch(/addEventListener\(['"]sync['"]/);
    expect(SW).not.toMatch(/sync-offline-actions/);
  });

  test('no write-only stats store (GET_STATS was its only reader)', () => {
    expect(SW).not.toMatch(/cacheStats/);
  });

  test('no fabricated performance claim in the header docstring', () => {
    expect(SW).not.toMatch(/70%/);
  });
});

describe('service worker — live surface preserved', () => {
  test('install/activate/fetch listeners still registered', () => {
    expect(SW).toMatch(/addEventListener\(['"]install['"]/);
    expect(SW).toMatch(/addEventListener\(['"]activate['"]/);
    expect(SW).toMatch(/addEventListener\(['"]fetch['"]/);
  });

  test('network-first still covers .json (manifest.json is fetched)', () => {
    expect(SW).toMatch(/\\\.json\$/);
  });

  test('runtime cache still bounded', () => {
    expect(SW).toMatch(/enforceCacheLimit/);
    expect(SW).toMatch(/RUNTIME_CACHE/);
  });
});
