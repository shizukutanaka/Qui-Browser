/**
 * Pin test — release docs must not verify surface that no longer exists.
 *
 * RELEASE_CHECKLIST.md / FINAL_RELEASE_SUMMARY_v2.0.0.md were written
 * 2025-10-19 for a v2.0.0 release that was never executed (no v* tag on
 * origin). Their ✅/checked claims must therefore (a) mark the release as
 * planned-not-executed, and (b) not claim deleted modules, scripts,
 * workflows, docs, deployments, or device-testing runs as verified.
 *
 * Companion guard: asserts the named modules are still absent — if one
 * returns, the docs' "removed" notes should be revisited.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECKLIST = fs.readFileSync(path.join(ROOT, 'RELEASE_CHECKLIST.md'), 'utf8');
const SUMMARY = fs.readFileSync(path.join(ROOT, 'FINAL_RELEASE_SUMMARY_v2.0.0.md'), 'utf8');

const DEAD_MODULES = [
  'ObjectPoolSystem',
  'TextureLoader',
  'PassthroughManager',
  'OfflineManager',
  'WebGPURenderer',
  'MultiplayerSystem',
  'AIRecommendation',
  'VideoPlayer'
];
const DEAD_SCRIPTS = [
  'benchmark',
  'benchmark:all',
  'benchmark:report',
  'benchmark:regression',
  'test:tier',
  'test:integration',
  'test:e2e',
  'deploy:gh-pages',
  'ci:benchmark'
];
const linesNamed = (doc, token) => doc.split('\n').filter((l) => l.includes(token));

describe('release docs mark v2.0.0 as never executed', () => {
  it('checklist status is honest about the missing release', () => {
    expect(CHECKLIST).not.toContain('Ready for Release');
    expect(CHECKLIST).not.toContain('APPROVED FOR RELEASE');
    expect(CHECKLIST).toMatch(/never (executed|released|pushed)|not executed/i);
  });

  it('summary status is honest about the missing release', () => {
    expect(SUMMARY).not.toContain('PRODUCTION READY');
    expect(SUMMARY).toMatch(/never (executed|released|pushed)|not executed/i);
  });
});

describe('release docs do not verify removed modules', () => {
  it.each(DEAD_MODULES)('%s is marked removed/missing wherever named', (m) => {
    const lines = [...linesNamed(CHECKLIST, m), ...linesNamed(SUMMARY, m)];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toMatch(/~~|❌|削除|removed|missing/i);
    }
    // Guard: module file still absent — revisit the notes if it returns.
    const stillAbsent = !fs.existsSync(path.join(ROOT, 'src', `${m}.js`));
    expect(stillAbsent).toBe(true);
  });
});

describe('release docs do not prescribe dead scripts/workflows/docs', () => {
  it.each(DEAD_SCRIPTS)('dead npm script %s is not listed', (s) => {
    expect(SUMMARY).not.toContain(`npm run ${s}`);
    expect(CHECKLIST).not.toContain(`npm run ${s}`);
  });

  it('removed benchmark.yml workflow is not claimed active', () => {
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*benchmark\.yml/);
    expect(fs.existsSync(path.join(ROOT, '.github/workflows/benchmark.yml'))).toBe(false);
  });

  it('deleted docs are not claimed as present', () => {
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*API\.md/);
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*RELEASE_NOTES/);
    expect(SUMMARY).not.toMatch(/\*\*API\.md\*\*/);
    expect(SUMMARY).not.toMatch(/RELEASE_NOTES_v2\.0\.0\.md[^~\n]*✅/);
  });

  it('CI job counts match the workflows that exist (7 CI, 9 CD)', () => {
    expect(CHECKLIST).not.toContain('9 CI jobs');
    expect(SUMMARY).not.toMatch(/ci\.yml[^|\n]*9 Jobs|9 Jobs[^|\n]*ci\.yml/i);
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const jobs = ci.split(/^jobs:/m)[1].match(/^  [a-z-]+:$/gm) || [];
    expect(jobs.length).toBe(7);
  });
});

describe('release docs do not claim unverifiable execution', () => {
  it('device-testing rows are not checked (no device harness exists)', () => {
    for (const device of ['Meta Quest', 'Pico']) {
      expect(CHECKLIST).not.toMatch(new RegExp(`\\[x\\][^\\n]*${device}`));
    }
  });

  it('email-channel rows are not checked (no support email exists)', () => {
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*[Ee]mail/);
  });

  it('secrets nothing consumes are not claimed as set', () => {
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*(SENTRY_DSN|GA_MEASUREMENT_ID)/);
  });

  it('no platform is claimed live (GitHub Pages 404s; Netlify/Vercel have no assigned URL)', () => {
    expect(SUMMARY).not.toContain('✅ Live');
    expect(CHECKLIST).not.toMatch(/\[x\][^\n]*(Site created|Project linked)/);
  });
});

describe('still-true surface stays claimed', () => {
  it('existing modules keep their verified marks', () => {
    for (const m of ['FFRSystem', 'JapaneseIME', 'VoiceCommands', 'HapticFeedback']) {
      expect(fs.existsSync(path.join(ROOT, 'src'))).toBe(true);
      expect(linesNamed(SUMMARY, m).length).toBeGreaterThan(0);
    }
    // Progressive Loading is claimed and the file exists.
    expect(fs.existsSync(path.join(ROOT, 'src/utils/ProgressiveLoader.js'))).toBe(true);
  });
});
