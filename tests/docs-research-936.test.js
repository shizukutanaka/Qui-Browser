import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ANALYSIS_DOCS = ['docs/CATEGORY_RESEARCH.md', 'docs/IMPROVEMENT_ANALYSIS.md', 'docs/RESEARCH.md'];

const srcBody = () => {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
};

describe('stale research docs snapshot honesty (round 936)', () => {
  test('every stale-analysis doc carries a snapshot marker near its top', () => {
    for (const f of ANALYSIS_DOCS) {
      const head = read(f).split('\n').slice(0, 12).join('\n');
      // CATEGORY_RESEARCH and IMPROVEMENT_ANALYSIS were marked at #1157;
      // RESEARCH.md prescribes the same deleted surface and must not read
      // as current guidance.
      expect(/snapshot|スナップショット/i.test(head)).toBe(true);
    }
  });

  test("RESEARCH.md's disclaimer names the surfaces it prescribes that are gone", () => {
    const src = read('docs/RESEARCH.md');
    const head = src.split('\n').slice(0, 15).join('\n');
    for (const sym of ['KTX2Loader', 'WebGPURenderer', 'multiplayer']) {
      expect(head.includes(sym)).toBe(true);
    }
  });

  test('the disclaimer is honest — the named surfaces are genuinely absent from src/', () => {
    const body = srcBody();
    expect(/KTX2Loader/.test(body)).toBe(false);
    expect(/WebGPURenderer/.test(body)).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/vr/multiplayer'))).toBe(false);
  });

  test('RESEARCH.md still contains the phantom prescriptions the disclaimer covers', () => {
    const src = read('docs/RESEARCH.md');
    expect(/KTX2Loader/.test(src)).toBe(true);
    expect(/WebGPURenderer/.test(src)).toBe(true);
    expect(/multiplayer/i.test(src)).toBe(true);
  });
});
