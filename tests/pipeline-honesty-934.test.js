/**
 * Round 934 — pipeline-surface honesty invariants.
 *
 * The two live workflow files must not declare surface that is dead,
 * unfireable, or lying about what it does:
 *   - every top-level env var in ci.yml/cd.yml is referenced somewhere
 *   - the bundle-size failure message reports the same limit the check uses
 *   - the release changelog extraction can actually match CHANGELOG.md headers
 *   - docker metadata tag patterns only cover events the job can produce
 *
 * Written failing-first (all red on main before the fix).
 */

import { readFileSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const cd = readFileSync(join(ROOT, '.github/workflows/cd.yml'), 'utf8');
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

describe('ci.yml — declared surface is real', () => {
  test('every top-level env var is referenced by a step', () => {
    const envBlock = ci.match(/^env:\n((?:  \w+:.*\n)+)/m)[1];
    const vars = [...envBlock.matchAll(/  (\w+):/g)].map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(0);
    for (const v of vars) {
      // A live var appears at least once more after its declaration.
      const uses = ci.split(v).length - 1;
      expect(uses).toBeGreaterThan(1); // env.${v} must be referenced, not just declared
    }
  });

  test('bundle-size failure message reports the actual limit', () => {
    const maxMb = ci.match(/MAX_SIZE=\$\(\((\d+) \* 1024 \* 1024\)\)/)[1];
    const msg = ci.match(/echo "❌ Bundle size exceeds (\d+)MB limit"/)[1];
    expect(msg).toBe(maxMb);
  });
});

describe('cd.yml — declared surface is real', () => {
  test('changelog extraction produces real notes for tag v3.3.0', () => {
    // Pull the actual Extract-changelog run script out of cd.yml, substitute
    // the tag name GitHub would provide, and execute it — on a broken pipeline
    // the script can only ever produce the "No changelog found" fallback.
    const block = cd.match(/id: changelog\n\s+run: \|\n((?:          .*\n)+)/);
    expect(block).not.toBeNull();
    const script = block[1].replace(/^          /gm, '').replaceAll('${{ github.ref_name }}', 'v3.3.0');
    const dir = mkdtempSync(join(tmpdir(), 'cdlog-'));
    copyFileSync(join(ROOT, 'CHANGELOG.md'), join(dir, 'CHANGELOG.md'));
    writeFileSync(join(dir, 'extract.sh'), `cd "${dir}"\n${script}`);
    execSync(`bash "${join(dir, 'extract.sh')}"`);
    const notes = readFileSync(join(dir, 'release-notes.md'), 'utf8');
    expect(notes.startsWith('No changelog found')).toBe(false);
    expect(notes).not.toMatch(/^## \[/m); // section content only, no headers
    expect(notes.length).toBeGreaterThan(100);
  });

  test('changelog headers use the v-less [X.Y.Z] format the extraction expects', () => {
    const versionHeaders = changelog.match(/^## \[\d+\.\d+\.\d+\]/gm) || [];
    expect(versionHeaders.length).toBeGreaterThan(0);
  });

  test('docker metadata tag patterns only cover events the job can produce', () => {
    // docker-build-push only runs for tag pushes (refs/tags/v), so
    // ref/event=branch and ref/event=pr patterns can never fire.
    const metaBlock = cd.match(/tags: \|\n((?:            type=.*\n)+)/);
    expect(metaBlock).not.toBeNull();
    const deadPatterns = metaBlock[1].match(/type=ref,event=(branch|pr)/g) || [];
    expect(deadPatterns).toEqual([]);
  });
});
