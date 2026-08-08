#!/usr/bin/env node
/**
 * Measure real text metrics in a real browser, to validate the em-width model.
 *
 * Sessions 62–66 fixed a family of defects caused by treating full-width (CJK)
 * and half-width (Latin) characters as equally wide. The fix models advance
 * width in em — 1.0 for full-width, ~0.5 for Latin (Unicode UAX #11) — but
 * those are *approximations*. This script checks them against ground truth:
 * Canvas 2D `measureText` in headless Chromium with real fonts.
 *
 * Deliberately dependency-free. It drives the Chromium that is already present
 * (Playwright's browser bundle) via `--dump-dom`, so it adds no devDependency
 * and no test-runner integration. Run it by hand when the width model or the
 * panel geometry changes:
 *
 *     node tools/measure-text-metrics.mjs
 *
 * Caveat worth stating: this measures THIS machine's fonts (DejaVu Sans +
 * IPAGothic/WenQuanYi fallback on Linux). A Quest headset resolves
 * `sans-serif` to a different family with slightly different metrics, so treat
 * the numbers as a sanity check on the model, not as device-exact values. That
 * variance is exactly why the budgets carry a safety margin rather than being
 * tuned to these figures.
 *
 * Findings at the time of writing (see CLAUDE.md Session 67):
 *   Latin average advance : 0.458 (regular) .. 0.496 (bold) em   [model: 0.50]
 *   monospace advance     : 0.602 em                              [model: 0.60]
 *   full-width advance    : 1.012 em (本 = 1.000, あ = 1.023)     [model: 1.00]
 * i.e. the model slightly UNDER-estimates full-width text, which is why
 * geometry-derived budgets reserve WIDTH_SAFETY headroom.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
].filter(Boolean);

// Font/size pairs taken from the real draw calls, so the numbers correspond to
// surfaces that actually exist rather than to abstract samples.
const SURFACES = [
  ['reader body',        '20px sans-serif',       20],
  ['reader heading',     'bold 25px sans-serif',  25],
  ['caption (1 row)',    'bold 44px sans-serif',  44],
  ['bookmark row title', 'bold 26px sans-serif',  26],
  ['suggestion label',   'bold 34px sans-serif',  34],
  ['url bar',            '18px monospace',        18],
  ['IME composition',    '40px monospace',        40]
];

const PAGE = `<!doctype html><meta charset="utf-8"><body><pre id="out"></pre><script>
const c = document.createElement('canvas'), x = c.getContext('2d');
const LAT = 'the quick brown fox jumps over the lazy dog and keeps running along';
const JP  = 'これは日本語の本文です。全角の送り幅を測定します';
const rows = [];
const SURFACES = ${JSON.stringify(SURFACES)};
for (const [label, font, size] of SURFACES) {
  x.font = font;
  const lat = x.measureText(LAT).width / Array.from(LAT).length / size;
  const jp  = x.measureText(JP ).width / Array.from(JP ).length / size;
  rows.push(label.padEnd(20) + ' latin_em=' + lat.toFixed(3) + '  fullwidth_em=' + jp.toFixed(3));
}
x.font = '100px sans-serif';
const g = (s) => (x.measureText(s).width / 100).toFixed(3);
rows.push('');
rows.push('single glyph (em): 本=' + g('本') + ' あ=' + g('あ') + ' Ａ=' + g('Ａ') +
          ' A=' + g('A') + ' m=' + g('m') + ' i=' + g('i'));
document.getElementById('out').textContent = rows.join('\\n');
</script></body>`;

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return p;
    } catch { /* try the next candidate */ }
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error('No Chromium found. Set CHROME_PATH, or run where Playwright\'s bundle exists.');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'qui-metrics-'));
const file = join(dir, 'measure.html');
writeFileSync(file, PAGE);

const dom = execFileSync(chrome, [
  '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom', `file://${file}`
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const body = dom.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
if (!body) {
  console.error('Could not read measurements from the page.');
  process.exit(1);
}
console.log(`Chromium: ${chrome}\n`);
console.log(body[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
console.log('\nModel for comparison: full-width 1.00 em, Latin 0.50 em, monospace 0.60 em.');
