import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The SW's activate cleanup only rotates the precache when CACHE_VERSION
// changes — a static literal means stale assets forever. The build stamps it
// via `node tools/stamp-sw-version.mjs`; these tests drive that real CLI.
const TOOL = path.join(__dirname, '../tools/stamp-sw-version.mjs');

function runTool(file) {
  return execFileSync(process.execPath, [TOOL, file], { encoding: 'utf8' });
}

describe('stamp-sw-version (CLI)', () => {
  test('rewrites CACHE_VERSION in place with pkg version + timestamp', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-'));
    const file = path.join(dir, 'service-worker.js');
    writeFileSync(
      file,
      "const CACHE_VERSION = 'qui-browser-v0';\nrest();",
      'utf8'
    );
    const out = runTool(file);
    const src = readFileSync(file, 'utf8');
    // version prefix from package.json, suffix is a base36 timestamp
    expect(src).toMatch(/const CACHE_VERSION = 'qui-browser-2\.0\.0-[a-z0-9]+'/);
    expect(src).toContain('rest();');
    expect(out).toContain('CACHE_VERSION stamped');
  });

  test('two stamps produce distinct version strings', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-'));
    const file = path.join(dir, 'service-worker.js');
    writeFileSync(file, "const CACHE_VERSION = 'qui-browser-v0';", 'utf8');
    runTool(file);
    const first = readFileSync(file, 'utf8');
    await new Promise((r) => setTimeout(r, 5));
    writeFileSync(file, "const CACHE_VERSION = 'qui-browser-v0';", 'utf8');
    runTool(file);
    const second = readFileSync(file, 'utf8');
    expect(second).not.toBe(first);
  });

  test('fails loudly when CACHE_VERSION is absent', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-'));
    const file = path.join(dir, 'service-worker.js');
    writeFileSync(file, 'const OTHER = 1;', 'utf8');
    expect(() => runTool(file)).toThrow();
  });

  test('the real public/service-worker.js carries a stampable literal', () => {
    const src = readFileSync(
      path.join(__dirname, '../public/service-worker.js'),
      'utf8'
    );
    expect(src).toMatch(/const CACHE_VERSION = 'qui-browser-[^']+'/);
  });

  // Every build rotates CACHE_VERSION, so activate wipes the runtime cache on
  // every deploy — without precached bundles a first offline visit after an
  // update serves unstyled shell markup. The stamp fills BUILD_ASSETS with
  // the hashed js/css files sitting next to it in dist/.
  test('fills the BUILD_ASSETS marker with js/css files beside the SW', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-'));
    mkdirSync(path.join(dir, 'js'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'js', 'index-abc123.js'), 'x', 'utf8');
    writeFileSync(path.join(dir, 'js', 'vendor-three-def456.js'), 'x', 'utf8');
    writeFileSync(path.join(dir, 'assets', 'index-ghi789.css'), 'x', 'utf8');
    writeFileSync(path.join(dir, 'assets', 'skip-me.png'), 'x', 'utf8');
    const file = path.join(dir, 'service-worker.js');
    writeFileSync(
      file,
      "const CACHE_VERSION = 'qui-browser-v0';\n" +
        'const BUILD_ASSETS = [\n  /* __BUILD_ASSETS__ */\n];',
      'utf8'
    );
    runTool(file);
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('`${BASE}js/index-abc123.js`');
    expect(src).toContain('`${BASE}js/vendor-three-def456.js`');
    expect(src).toContain('`${BASE}assets/index-ghi789.css`');
    expect(src).not.toContain('skip-me.png');
    expect(src).not.toContain('__BUILD_ASSETS__');
  });

  test('leaves sources without the marker untouched', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sw-'));
    const file = path.join(dir, 'service-worker.js');
    const body = "const CACHE_VERSION = 'qui-browser-v0';\nrest();";
    writeFileSync(file, body, 'utf8');
    runTool(file);
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('rest();');
    expect(src).not.toContain('BUILD_ASSETS');
  });

  test('the real service worker carries the injectable marker', () => {
    const src = readFileSync(
      path.join(__dirname, '../public/service-worker.js'),
      'utf8'
    );
    expect(src).toContain('/* __BUILD_ASSETS__ */');
    expect(src).toMatch(/\.\.\.BUILD_ASSETS/);
  });
});
