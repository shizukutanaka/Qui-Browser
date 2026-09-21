/**
 * Stamp the service worker's CACHE_VERSION with the package version plus a
 * build timestamp, so every shipped build rotates the precache name.
 *
 * Why this exists: the SW's activate handler keeps caches whose name matches
 * CACHE_VERSION and deletes the rest. With a static literal the name never
 * changes between deploys, so the activate cleanup is a no-op and browsers
 * keep serving the previous release's precache until the SW file happens to
 * differ for an unrelated reason. Stamping the version makes every build a
 * SW update (browsers compare the file byte-wise) and a fresh cache name.
 *
 * Run automatically by `npm run build`; also usable standalone:
 *   node tools/stamp-sw-version.mjs [path-to-service-worker.js]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

/**
 * Rewrite the CACHE_VERSION assignment in a service worker source.
 * @param {string} source SW file contents
 * @param {string} stamp  new version string (e.g. '2.0.0-lx4f2k')
 * @returns {string} updated source
 */
export function stampSource(source, stamp) {
  const next = source.replace(
    /const CACHE_VERSION = '[^']*'/,
    `const CACHE_VERSION = 'qui-browser-${stamp}'`
  );
  if (next === source) {
    throw new Error('CACHE_VERSION assignment not found in service worker source');
  }
  return next;
}

/**
 * Stamp the built dist/service-worker.js in place.
 * @param {string} [swPath]
 * @param {string} [stamp]
 */
export function stampServiceWorker(
  swPath = path.join(ROOT, 'dist/service-worker.js'),
  stamp = `${readPkgVersion()}-${Date.now().toString(36)}`
) {
  const source = readFileSync(swPath, 'utf8');
  writeFileSync(swPath, stampSource(source, stamp));
  return stamp;
}

function readPkgVersion() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

if (process.argv[1] && process.argv[1].endsWith('stamp-sw-version.mjs')) {
  const target = process.argv[2];
  const stamp = stampServiceWorker(target);
  console.log(`service-worker CACHE_VERSION stamped: qui-browser-${stamp}`);
}
