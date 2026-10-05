const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Round 862 — docs/API.md documented a v5.x-era "Unified*System" API surface
// (UnifiedPerformanceSystem / UnifiedSecuritySystem / UnifiedErrorHandler /
// UnifiedVRExtensionSystem / moduleLoader) that exists nowhere in the
// codebase. These tests pin the class: the phantom file stays deleted and
// live surface no longer prescribes or links to it.

const ROOT = path.resolve(__dirname, '..');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const trackedFiles = () =>
  execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((f) => f.replace(/^"(.*)"$/, '$1'));

// References allowed to keep naming the removed surface, each with the reason:
// - frozen historical/release records (never rewritten)
// - docs/archive/** snapshots (frozen)
// - CLAUDE.md / docs/MODEL_GUIDE.md / docs/INSTRUCTIONS_*.md — dated AI-session
//   journals kept as history
// - docs/DEVELOPER_ONBOARDING.md — owned by open PR #1142 which rewrites the
//   unified-systems section (defer)
// - .github/workflows/{deploy,release}.yml — owned by open PR #1146, which
//   deletes both files entirely
// - .claude/settings.local.json — committed Claude-Code permission list; the
//   name only appears inside a frozen historical commit-message string
const LEGACY_ALLOW = new Set([
  'CLAUDE.md',
  'FINAL_RELEASE_SUMMARY_v2.0.0.md',
  'PROJECT_STATUS.md',
  'RELEASE_CHECKLIST.md',
  'docs/MODEL_GUIDE.md',
  'docs/INSTRUCTIONS_OPUS.md',
  'docs/INSTRUCTIONS_SONNET.md',
  'docs/DEVELOPER_ONBOARDING.md',
  '.github/workflows/deploy.yml',
  '.github/workflows/release.yml',
  '.claude/settings.local.json'
]);

const isAllowed = (f) => f.startsWith('docs/archive/') || LEGACY_ALLOW.has(f);

describe('phantom API documentation', () => {
  test('docs/API.md is deleted', () => {
    expect(fs.existsSync(path.join(ROOT, 'docs/API.md'))).toBe(false);
  });

  test('Unified*System API names have no live references', () => {
    const needle =
      /UnifiedPerformanceSystem|UnifiedSecuritySystem|UnifiedErrorHandler|UnifiedVRExtensionSystem|moduleLoader/;
    const offenders = trackedFiles().filter(
      (f) => !isAllowed(f) && f !== 'tests/docs-surface-862.test.js' && needle.test(read(f))
    );
    expect(offenders).toEqual([]);
  });

  test('no live file links to docs/API.md', () => {
    const offenders = trackedFiles().filter(
      (f) => !isAllowed(f) && f !== 'tests/docs-surface-862.test.js' && /API\.md/.test(read(f))
    );
    expect(offenders).toEqual([]);
  });

  test('required-doc lists do not name docs/API.md', () => {
    expect(read('tools/pre-release-validation.js')).not.toContain("'docs/API.md'");
    expect(read('tools/verify-documentation.js')).not.toContain("'docs/API.md'");
  });
});
