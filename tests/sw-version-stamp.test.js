import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
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
});
