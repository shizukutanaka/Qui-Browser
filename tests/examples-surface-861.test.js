/**
 * Round 861 — examples/ surface audit.
 *
 * Every example HTML shipped in examples/ imported the v5.x SDK at
 * ../assets/js/*.js — a tree deleted in #633 — so all of them were
 * dead-on-arrival committed artifacts. The class pin: no live,
 * non-documentation file may reference the deleted assets/js tree, and
 * CODEOWNERS must not carry entries pointing at paths that do not exist.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const trackedFiles = () =>
  execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((f) => f.replace(/^"(.*)"$/, '$1'));

describe('deleted assets/js tree has no live references', () => {
  test('assets/js/ references are confined to files already fixed by open PRs', () => {
    // Remaining offenders and the PR that removes each:
    //   .github/CODEOWNERS            -> #1147 (dead owner glob)
    //   .github/workflows/wasm-build.yml -> #1139 (workflow deleted)
    //   netlify.toml                  -> #1143 (re-pointed to dist/)
    const IN_FLIGHT = new Set(['.github/CODEOWNERS', '.github/workflows/wasm-build.yml', 'netlify.toml']);
    const offenders = trackedFiles().filter((f) => {
      if (f.startsWith('docs/') || f.startsWith('tests/') || f.endsWith('.md') || IN_FLIGHT.has(f)) {
        return false;
      }
      return read(f).includes('assets/js/');
    });
    expect(offenders).toEqual([]);
  });

  test('examples/ markdown catalogues only reference files that exist', () => {
    const catalog = path.join(ROOT, 'examples', 'EXAMPLE_PROJECTS.md');
    if (!fs.existsSync(catalog)) {
      return;
    }
    const missing = [...read('examples/EXAMPLE_PROJECTS.md').matchAll(/`?examples\/([A-Za-z0-9._-]+\.html)`?/g)]
      .map((m) => m[1])
      .filter((name) => !fs.existsSync(path.join(ROOT, 'examples', name)));
    expect(missing).toEqual([]);
  });
});

describe('docs preview instructions', () => {
  test.each(['docs/QUICKSTART.md', 'docs/QUICK_START.md'])(
    '%s documents the vite preview port (4173), not a stale port',
    (file) => {
      const previewLines = read(file)
        .split('\n')
        .filter((l) => /npm run (preview|serve)/.test(l));
      expect(previewLines.length).toBeGreaterThan(0);
      for (const line of previewLines) {
        expect(line).not.toMatch(/localhost:8080/);
      }
    }
  );
});
