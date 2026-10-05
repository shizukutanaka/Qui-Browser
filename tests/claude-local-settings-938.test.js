/**
 * Invariant: `.claude/settings.local.json` must not live in the repo.
 *
 * Claude Code writes per-developer permission state to
 * `.claude/settings.local.json`. Project-shared settings belong in
 * `.claude/settings.json`; the `*.local.json` file is a personal cache —
 * nothing in this repo (CI, tests, tooling, docs) reads it, and the copy that
 * was committed in `bc3a4366` carried 38 stale Bash-permission entries naming
 * long-deleted files (vercel.json, deploy.yml, release.yml, API.md,
 * assets/sounds/.gitkeep, tests/vr-modules.test.js, ...). A stale allowlist
 * prescribing work on deleted files is dead surface, not project config.
 *
 * The file must be untracked AND absent so a `git rm --cached` half-fix that
 * leaves the file lying in the checkout still fails this gate, and .gitignore
 * must keep it from being re-committed.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SETTINGS = '.claude/settings.local.json';

const tracked = (spec) => execSync(`git ls-files "${spec}"`, { cwd: ROOT, encoding: 'utf8' }).trim();

describe('claude local settings must not be committed', () => {
  test('no *.local.json file under .claude/ is tracked', () => {
    expect(tracked('.claude/*.local.json')).toBe('');
  });

  test('settings.local.json is absent from the working tree', () => {
    expect(fs.existsSync(path.join(ROOT, LOCAL_SETTINGS))).toBe(false);
  });

  test('.gitignore ignores *.local.json under .claude/', () => {
    const ignored = execSync(`git check-ignore "${LOCAL_SETTINGS}"`, {
      cwd: ROOT,
      encoding: 'utf8'
    });
    expect(ignored.trim()).toBe(LOCAL_SETTINGS);
  });
});
