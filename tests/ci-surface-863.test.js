/**
 * Round 863 — live-workflow honesty audit (ci.yml + cd.yml).
 *
 * Found gaps (assumption vs implementation):
 *  1. ci.yml gated dist/ at 2MB while the real build is ~3.0MB — the
 *     "Check bundle size" step exited 1 on every run (main and every PR).
 *  2. cd.yml smoke-tests/verify-performance consumed
 *     `needs.deploy-github-pages.outputs.url`, but the job declared no
 *     `outputs:` mapping — the value was always empty, so the homepage
 *     smoke check failed on every main push.
 *  3. ci.yml triggered on `develop`, a branch that does not exist.
 *  4. ci.yml job-header comments skipped JOB 3/JOB 4 (renumbering left
 *     behind after those jobs were deleted).
 *
 * These tests pin the invariants, not the instances.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CI = '.github/workflows/ci.yml';
const CD = '.github/workflows/cd.yml';

describe('live workflows only promise what exists', () => {
  it('ci.yml does not trigger on the nonexistent develop branch', () => {
    const src = read(CI);
    // `branches: [main, develop]` in both push and pull_request — develop
    // has never existed (git ls-remote --heads origin develop → empty).
    expect(src).not.toMatch(/develop/);
  });

  it('bundle-size tripwire is not set below the real dist size', () => {
    const src = read(CI);
    const m = src.match(/MAX_SIZE=\$\(\((\d+) \* 1024 \* 1024\)\)/);
    expect(m).not.toBeNull();
    const limitMb = Number(m[1]);
    // Real `npm run build` output is ~3.0MB; the tripwire must sit above
    // the true size (it exists to catch regressions, not to fail always).
    expect(limitMb).toBeGreaterThanOrEqual(4);
  });

  it('deploy-github-pages publishes url as a job output for dependents', () => {
    const src = read(CD);
    ['smoke-tests', 'verify-performance'].forEach((job) => {
      expect(src).toContain(`${job}:`);
    });
    // The producing job must map the step output, or needs..outputs.url
    // is always empty.
    const pagesJob = src.slice(src.indexOf('deploy-github-pages:'), src.indexOf('deploy-netlify:'));
    expect(pagesJob).toMatch(/outputs:\s*\n\s+url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/);
  });

  it('JOB numbering comments are contiguous in every live workflow', () => {
    [CI, CD].forEach((wf) => {
      const src = read(wf);
      const nums = [...src.matchAll(/# JOB (\d+):/g)].map((m) => Number(m[1]));
      nums.forEach((n, i) => {
        expect(n).toBe(i + 1);
      });
    });
  });
});
