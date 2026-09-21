/**
 * Workflow-repair patch integrity (docs/patches/*.patch).
 *
 * These patches are the deliverable for fixing .github/workflows/** — the
 * files can't be pushed from a Devin session, so the owner applies them via
 * `git am`. Two failure classes this pins:
 *
 *  1. A patch that doesn't apply cleanly to the workflows in THIS tree
 *     (verified once by hand when each patch shipped, but workflows or
 *     patches could drift later — silently breaking the owner's `git am`).
 *  2. Patches that conflict with EACH OTHER when applied in sequence
 *     (the original series had exactly this: 0001 deleted hunks that 0003
 *     rewrote, and re-deleted files 0004 removed — `git am` died at step 3).
 *
 * The test applies the whole series in order to a scratch copy of
 * .github/workflows and asserts both that every patch applies and that the
 * final state carries the fixes (no dead script refs, no dead files).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load } from 'js-yaml';

const ROOT = path.join(__dirname, '..');
const PATCH_DIR = path.join(ROOT, 'docs/patches');

function applyAll() {
  const dir = mkdtempSync(path.join(tmpdir(), 'wf-'));
  cpSync(path.join(ROOT, '.github'), path.join(dir, '.github'), { recursive: true });
  const patches = readdirSync(PATCH_DIR)
    .filter((f) => f.endsWith('.patch'))
    .sort();
  for (const p of patches) {
    // git apply works outside a repo; --check would only test one patch
    // against the pristine tree, so we actually apply sequentially.
    execFileSync('git', ['apply', path.join(PATCH_DIR, p)], {
      cwd: dir,
      encoding: 'utf8'
    });
  }
  return dir;
}

describe('docs/patches series', () => {
  test('every patch applies cleanly in order', () => {
    const dir = applyAll();
    rmSync(dir, { recursive: true, force: true });
  });

  test('every post-series workflow is valid YAML with real jobs', () => {
    // git apply only checks text — a patch that produces malformed YAML
    // applies cleanly here but fails on GitHub. Parse every output file.
    const dir = applyAll();
    const wf = path.join(dir, '.github/workflows');
    for (const f of readdirSync(wf).filter((n) => n.endsWith('.yml'))) {
      const doc = load(readFileSync(path.join(wf, f), 'utf8'), { filename: f });
      expect(typeof doc).toBe('object');
      expect(doc).toHaveProperty('jobs');
      // YAML 1.1 parses `on:` as boolean true — assert the trigger block
      // exists under either key form.
      expect(doc.on ?? doc['on'] ?? doc[true]).toBeTruthy();
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test('post-series workflows carry the fixes', () => {
    const dir = applyAll();
    const wf = path.join(dir, '.github/workflows');
    const read = (f) => readFileSync(path.join(wf, f), 'utf8');

    // Dead workflows deleted outright.
    for (const dead of ['benchmark.yml', 'v5.8.0-planning.yml', 'wasm-build.yml']) {
      expect(existsSync(path.join(wf, dead))).toBe(false);
    }

    // ci.yml: node16 matrix leg gone, jacoco step gone, runtime verify wired.
    const ci = read('ci.yml');
    expect(ci).not.toContain('jacoco');
    expect(ci).not.toContain('16');
    expect(ci).toContain('ci:verify');

    // deploy.yml: real build + dist upload instead of dead assets/js checks.
    const deploy = read('deploy.yml');
    expect(deploy).toContain('npm run build');
    expect(deploy).toContain('BASE_PATH: /Qui-Browser/');
    expect(deploy).toContain("'./dist'");
    expect(deploy).not.toContain('assets/js/vr-*.js');

    // cd.yml Pages job builds with the subpath base.
    expect(read('cd.yml')).toContain('BASE_PATH: /Qui-Browser/');

    // release.yml no longer gates publishing on a deleted script.
    expect(read('release.yml')).not.toContain('benchmark:all');

    // test.yml retargeted from deleted bundle to live source.
    const test = read('test.yml');
    expect(test).toContain('Security Scan');
    expect(test).not.toContain('Validate VR Modules');

    // PR triggers carry no branches filter — main/develop-scoped filters
    // left every feature-branch-stacked PR running zero checks.
    for (const body of [ci, test]) {
      expect(body).not.toMatch(/pull_request:\s*\n\s*branches:/);
    }

    rmSync(dir, { recursive: true, force: true });
  });
});
