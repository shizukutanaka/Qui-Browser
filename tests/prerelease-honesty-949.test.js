const fs = require('fs');
const path = require('path');
const { countJobs } = require('../tools/pre-release-validation.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'tools/pre-release-validation.js'), 'utf8');

// The validator's own report must tell the truth: the job counts it prints,
// the quantity claims in its pass lines, and the summary channels it prints
// all have to reflect what it actually measured.
describe('pre-release validator honesty', () => {
  test('countJobs counts only keys inside the jobs: mapping — not on:/env: children, not 4-space nested keys', () => {
    const yaml = [
      'name: ci',
      'on:',
      '  push:',
      '  pull_request:',
      'env:',
      '  NODE_VERSION: 18',
      'jobs:',
      '  lint:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: npm run lint',
      '  docker-build-push:',
      '    runs-on: ubuntu-latest'
    ].join('\n');
    expect(countJobs(yaml)).toBe(2);
  });

  test('countJobs reports the real job counts of both workflows', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const cd = fs.readFileSync(path.join(ROOT, '.github/workflows/cd.yml'), 'utf8');
    // ci.yml: lint, test-unit, build, lighthouse, docker, security, summary.
    expect(countJobs(ci)).toBe(7);
    // cd.yml: build, deploy-github-pages, deploy-netlify, deploy-vercel,
    // docker-build-push, create-release, verify-performance, smoke-tests,
    // deployment-summary — all hyphenated names counted, none missed.
    expect(countJobs(cd)).toBe(9);
  });

  test('the scripts pass-line claims the number actually checked, not a hard-coded quantity', () => {
    expect(SRC).not.toContain('30+ scripts');
    expect(SRC).toContain('requiredScripts.length');
  });

  test('the summary prints no channel that is never populated', () => {
    // results.skipped was initialised and printed but no check ever pushed to
    // it — the "Skipped: 0" line was decorative dead surface.
    expect(SRC.toLowerCase()).not.toContain('skipped');
  });
});
