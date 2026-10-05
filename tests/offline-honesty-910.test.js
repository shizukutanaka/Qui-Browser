// Invariants for public/offline.html + public/ housekeeping (round 910).
// Class pinned: static fallback pages must not describe surface that does not
// exist — dead asset paths, phantom capability lists, fabricated sync claims —
// and git-keep placeholders must not outlive the directory that needed them.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OFFLINE = fs.readFileSync(path.join(ROOT, 'public', 'offline.html'), 'utf8');

const listFiles = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });

describe('offline.html honesty', () => {
  test('every href/src in the page resolves to a real file under public/', () => {
    const refs = [...OFFLINE.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) {
        continue;
      }
      const rel = ref.replace(/^\//, '');
      expect(fs.existsSync(path.join(ROOT, 'public', rel))).toBe(true);
    }
  });

  test('the offline feature list only claims surfaces that exist', () => {
    // There is no extension system, no email composer, no local-file surface,
    // and no saved-articles store — the previous list was 100% phantom.
    expect(OFFLINE).not.toMatch(/installed extensions?/i);
    expect(OFFLINE).not.toMatch(/compose emails?/i);
    expect(OFFLINE).not.toMatch(/local files?/i);
    expect(OFFLINE).not.toMatch(/saved articles?/i);
  });

  test('no fabricated server-sync claims — all persistence is localStorage', () => {
    expect(OFFLINE).not.toMatch(/sync automatically/i);
  });

  test('keeps the real offline surface: reload action + online detection', () => {
    expect(OFFLINE).toMatch(/window\.location\.reload/);
    expect(OFFLINE).toMatch(/navigator\.onLine/);
    expect(OFFLINE).toMatch(/addEventListener\('(on|off)line'/);
  });
});

describe('public/ git-keep placeholders', () => {
  test('no .gitkeep in a directory that already holds real files', () => {
    for (const dir of [
      'public',
      'public/assets',
      'public/assets/icons',
      'public/assets/images',
      'public/assets/sounds'
    ]) {
      const full = path.join(ROOT, dir);
      if (!fs.existsSync(full)) {
        continue;
      }
      const entries = fs.readdirSync(full).filter((n) => n !== '.DS_Store');
      if (entries.includes('.gitkeep')) {
        expect(entries).toEqual(['.gitkeep']);
      }
    }
  });

  test('a bare .gitkeep dir must back a fetch path live code still uses', () => {
    // public/assets/sounds/ is the declared drop location for the optional
    // /assets/sounds/*.mp3 files VRApp fetches (procedural fallback covers
    // their absence) — the placeholder documents a live path and stays.
    const vrApp = fs.readFileSync(path.join(ROOT, 'src', 'vr', 'VRApp.js'), 'utf8');
    expect(vrApp).toMatch(/\/assets\/sounds\//);
    expect(fs.existsSync(path.join(ROOT, 'public', 'assets', 'sounds'))).toBe(true);
  });
});
