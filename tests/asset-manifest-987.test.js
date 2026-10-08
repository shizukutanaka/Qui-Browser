'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// Every '/assets/...' literal the runtime ships a reference to must resolve to
// a committed file under public/. The sources scanned are the three places that
// can emit such references: index.html, public/manifest.json, and src/*.js.
const SOURCES = [path.join(ROOT, 'index.html'), path.join(PUBLIC, 'manifest.json')];
const SRC_DIR = path.join(ROOT, 'src');
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.js')) {
      SOURCES.push(p);
    }
  }
};
walk(SRC_DIR);

const ASSET_URL_RE = /['"`](\/assets\/[a-zA-Z0-9_./-]+)['"`]/g;

const refs = [];
for (const file of SOURCES) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = ASSET_URL_RE.exec(src))) {
    refs.push({ from: path.relative(ROOT, file), url: m[1] });
  }
}

describe('asset manifest honesty', () => {
  test('at least one /assets/ reference is scanned', () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  test('every referenced /assets/ URL resolves to a committed file', () => {
    const missing = refs
      .filter(({ url }) => !fs.existsSync(path.join(PUBLIC, url)))
      .map(({ from, url }) => `${from}: ${url}`);
    expect(missing).toEqual([]);
  });

  test('referenced .mp3 files are real MP3s (ID3 or MPEG sync header)', () => {
    const bad = refs
      .filter(({ url }) => url.endsWith('.mp3'))
      .map(({ url }) => path.join(PUBLIC, url))
      .filter((p) => fs.existsSync(p))
      .filter((p) => {
        const head = fs.readFileSync(p).subarray(0, 3);
        const id3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
        const sync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
        return !(id3 || sync);
      })
      .map((p) => path.relative(ROOT, p));
    expect(bad).toEqual([]);
  });
});
