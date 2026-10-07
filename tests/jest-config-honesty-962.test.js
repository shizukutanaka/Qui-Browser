/**
 * Invariant: jest.config.js must not declare dead surface.
 *
 * - Every identifier in `globals` is a write-only global unless a real .js
 *   file references it as a bare identifier (verified: no file reads
 *   VR_BROWSER_VERSION or bare NODE_ENV).
 * - Every directory alternative in `testMatch`/`testPathIgnorePatterns`
 *   must name something real — a `__tests__` glob when no __tests__ dir
 *   exists, or a `/build/` ignore when no build output exists, is a lie.
 * - Comments must not prescribe history on deleted modules
 *   (TextureManager was deleted in #1121).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = require(path.join(ROOT, 'jest.config.js'));
const SRC = fs.readFileSync(path.join(ROOT, 'jest.config.js'), 'utf8');

function repoJsFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue;
        }
        walk(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        files.push(full);
      }
    }
  };
  for (const dir of ['src', 'tests', 'tools', 'proxy']) {
    walk(path.join(ROOT, dir));
  }
  return files;
}

const JS_BODIES = repoJsFiles()
  .filter((f) => f !== __filename)
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

describe('jest.config.js honesty (#962)', () => {
  test('every declared global is referenced by a real js file', () => {
    const declared = Object.keys(CONFIG.globals || {});
    const unread = declared.filter((name) => !new RegExp(`\\b${name}\\b`).test(JS_BODIES));
    expect(unread).toEqual([]);
  });

  test('every testMatch directory alternative exists on disk', () => {
    const missing = (CONFIG.testMatch || [])
      .map((pattern) => pattern.match(/\*\*\/([^/*]+)\/\*\*\/\*\.js/))
      .filter(Boolean)
      .map((m) => m[1])
      .filter((dir) => !fs.existsSync(path.join(ROOT, dir)));
    expect(missing).toEqual([]);
  });

  test('testPathIgnorePatterns names no nonexistent build output', () => {
    const dead = (CONFIG.testPathIgnorePatterns || []).filter(
      (pattern) => pattern === '/build/' && !fs.existsSync(path.join(ROOT, 'build'))
    );
    expect(dead).toEqual([]);
  });

  test('comments name no deleted modules (TextureManager removed in #1121)', () => {
    expect(SRC).not.toContain('TextureManager');
  });
});
