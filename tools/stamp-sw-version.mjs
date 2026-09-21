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
 * Because every build is a SW update, the activate cleanup wipes the runtime
 * cache on every deploy — so it also fills the BUILD_ASSETS marker with the
 * content-hashed JS/CSS bundles from the dist it sits in, keeping the shell
 * fully styled/functional offline even on a first visit after an update.
 *
 * Run automatically by `npm run build`; also usable standalone:
 *   node tools/stamp-sw-version.mjs [path-to-service-worker.js]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

const BUILD_ASSETS_MARKER = '/* __BUILD_ASSETS__ */';

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
 * Fill the BUILD_ASSETS marker with the JS/CSS bundles found next to the
 * service worker file (i.e. inside the dist it ships in). Entries become
 * `${BASE}<rel>` template literals so they resolve under any deploy subpath.
 * No marker → no injection (lets the tool run against arbitrary SW files).
 * @param {string} source SW file contents
 * @param {string} distDir directory the SW ships in
 * @returns {string} updated source
 */
export function injectBuildAssets(source, distDir) {
  if (!source.includes(BUILD_ASSETS_MARKER)) {
    return source;
  }
  const entries = ['js', 'assets']
    .flatMap((dir) => {
      const abs = path.join(distDir, dir);
      if (!existsSync(abs)) {
        return [];
      }
      return readdirSync(abs)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => `  \`\${BASE}${dir}/${f}\`,`);
    })
    .sort();
  return source.replace(BUILD_ASSETS_MARKER, entries.join('\n'));
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
  const stamped = stampSource(source, stamp);
  writeFileSync(swPath, injectBuildAssets(stamped, path.dirname(swPath)));
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
