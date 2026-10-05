/**
 * Round 915 — placeholder/dead-config honesty pins.
 *
 * - CODE_OF_CONDUCT.md must name a real enforcement contact, not the
 *   template's `[INSERT CONTACT METHOD]` placeholder.
 * - .dockerignore must not carry duplicate patterns, commented-out entries,
 *   or entries for tools the repo cannot produce (nyc, yarn, sourcemaps,
 *   a `build/` output dir — vite emits `dist/`).
 * - docker-compose.yml must not ship commented-out service/port/volume
 *   surface that can never run (the prometheus block, the 8443 hint).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COC = fs.readFileSync(path.join(ROOT, 'CODE_OF_CONDUCT.md'), 'utf8');
const DOCKERIGNORE = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
const COMPOSE = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');

describe('CODE_OF_CONDUCT.md', () => {
  test('names a real enforcement contact — no template placeholder', () => {
    expect(COC).not.toMatch(/\[INSERT[^\]]*\]/);
    expect(COC).not.toMatch(/your-?username|example\.(com|org|net)/i);
    expect(COC).toMatch(/shizukutanaka/);
  });
});

describe('.dockerignore', () => {
  const lines = DOCKERIGNORE.split('\n').map((l) => l.trim());
  const patterns = lines.filter((l) => l && !l.startsWith('#'));

  test('no duplicate ignore patterns', () => {
    const dupes = patterns.filter((p, i) => patterns.indexOf(p) !== i);
    expect(dupes).toEqual([]);
  });

  test('no commented-out entries — config is either active or deleted', () => {
    // Section headers are capitalized ("# Node"); entries commented out
    // lower-case ("# docs", "# examples") hide dead config.
    expect(DOCKERIGNORE).not.toMatch(/^#\s+[a-z]/m);
  });

  test.each(['.nyc_output', 'yarn.lock', 'yarn-error.log', 'build', '*.map'])(
    'drops %s — nothing in this repo produces it',
    (pattern) => {
      expect(patterns).not.toContain(pattern);
    }
  );

  test.each(['dist', 'coverage', 'node_modules', 'Dockerfile', 'docker-compose.yml'])(
    'keeps %s — produced or consumed by the real pipeline',
    (pattern) => {
      expect(patterns).toContain(pattern);
    }
  );

  test('no pattern is shadowed by an ancestor pattern on an earlier line', () => {
    // `.github/workflows` is unreachable while `.github` precedes it.
    const idx = patterns.indexOf('.github/workflows');
    if (idx !== -1) {
      expect(patterns.indexOf('.github')).toBeGreaterThan(idx);
    }
  });
});

describe('docker-compose.yml', () => {
  test('no prometheus surface remains — the service was never provisioned', () => {
    expect(COMPOSE).not.toMatch(/prometheus/i);
  });

  test('no commented-out service/port/volume lines', () => {
    const commented = COMPOSE.split('\n').filter((l) =>
      /^\s*#\s*(-|prometheus|"[0-9]|image:|container_name|ports:|volumes:|command:|networks:|restart:|driver:)/.test(l)
    );
    expect(commented).toEqual([]);
  });
});
