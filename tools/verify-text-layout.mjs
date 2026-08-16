#!/usr/bin/env node
/**
 * Verify that text actually FITS its box, using the real wrap logic, the real
 * budget constants, and real font rendering.
 *
 * ## Why this exists
 *
 * Sessions 62–67 fixed a family of defects with one root cause: full-width
 * (CJK) glyphs are ~2× the advance of Latin ones, and every text budget in the
 * app had been written as a *character count*. Japanese overflowed the reader,
 * the captions, the suggestion buttons, the bookmark rows and the IME input —
 * each found only by hand-computing pixel widths after the fact.
 *
 * The reason they all shipped is that canvas UI is invisible to the test suite:
 * Jest runs under `testEnvironment: 'node'` and the canvas stubs have no
 * `measureText`, so no test could ever observe how wide the drawn text really
 * was. This harness closes that gap. It loads the app's own pure layout modules
 * in a real browser and asserts, with a real `ctx.measureText`, that every row
 * the production wrap/truncate code emits fits the production pixel box.
 *
 * ## How it works (and why it looks like this)
 *
 * Two browser constraints shape the design, both verified rather than assumed:
 *
 *   1. **A local HTTP server is required.** ES module `import` is fetched with
 *      CORS, and a `file://` page has a null origin, so module loading is
 *      blocked there. The modules must be served over http://127.0.0.1.
 *   2. **`--dump-dom` alone does not wait for module scripts.** It captures the
 *      DOM before an async module finishes, so results would always be missing.
 *      `--virtual-time-budget` makes it wait.
 *
 * Deliberately dependency-free — no Playwright, no test runner — matching
 * `tools/measure-text-metrics.mjs`, which measures raw font metrics. This one
 * measures the composed result.
 *
 *     node tools/verify-text-layout.mjs [--json]
 *
 * Exit code 0 when every surface fits, 1 when anything overflows.
 *
 * Caveat: this machine resolves `sans-serif`/`monospace` to DejaVu +
 * IPAGothic/WenQuanYi. A Quest headset picks different families with slightly
 * different metrics, which is exactly why the budgets carry `WIDTH_SAFETY`
 * headroom rather than being tuned to any one machine's numbers.
 */

import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const JSON_OUT = process.argv.includes('--json');
const CONDENSE_TOLERANCE_PCT = 5;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
].filter(Boolean);

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8'
};

/**
 * Adversarial inputs. Each surface is checked against all of them, because the
 * defects this harness exists for were all script-specific: the Latin cases
 * passed while the Japanese ones ran off the panel.
 */
const SAMPLES = {
  japanese: 'これは非常に長い日本語のテキストで、折り返しと切り詰めの両方を検証します。'.repeat(3),
  latin: 'This is a deliberately long English string used to exercise wrapping and truncation. '.repeat(3),
  mixed: 'WebXRの仕様はW3Cが策定しており、Quest 3やPico 4で動作します。'.repeat(3),
  surrogate: '𠮷野家'.repeat(30),
  emoji: '😀🎉'.repeat(30)
};

/** The page executed in the browser. Imports the app's REAL pure modules. */
function buildPage(origin) {
  return `<!doctype html><meta charset="utf-8"><body><pre id="out">PENDING</pre>
<script type="module">
const SAMPLES = ${JSON.stringify(SAMPLES)};
const results = [];
try {
  const [tw, caption, reader, bookmark, keyboard] = await Promise.all([
    import('${origin}/src/vr/ui/textWrap.js'),
    import('${origin}/src/vr/accessibility/captionLayout.js'),
    import('${origin}/src/vr/browser/readerLayout.js'),
    import('${origin}/src/vr/browser/bookmarkLayout.js'),
    import('${origin}/src/vr/input/keyboardLayout.js')
  ]);

  const ctx = document.createElement('canvas').getContext('2d');
  const widthPx = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };

  // Every text surface passes fillText's maxWidth, so a small overshoot is
  // CONDENSED by the canvas rather than escaping the box — degraded, not
  // broken. Overshoot beyond this is treated as a defect: the budget model is
  // wrong and the glyphs would be visibly squashed.
  const CONDENSE_TOLERANCE = 0.05;

  /** Record one surface × one sample. rows = what production would draw. */
  const check = (surface, sample, rows, font, boxPx) => {
    let widest = 0, widestText = '';
    for (const r of rows) {
      const w = widthPx(r, font);
      if (w > widest) { widest = w; widestText = r; }
    }
    const over = (widest - boxPx) / boxPx;
    results.push({
      surface, sample, font, boxPx: Math.round(boxPx),
      widestPx: Math.round(widest * 10) / 10,
      overflowPx: Math.round((widest - boxPx) * 10) / 10,
      overflowPct: Math.round(over * 1000) / 10,
      status: widest <= boxPx ? 'fits' : (over <= CONDENSE_TOLERANCE ? 'condensed' : 'OVERFLOW'),
      rows: rows.length,
      sampleRow: widestText.slice(0, 40)
    });
  };

  for (const [name, text] of Object.entries(SAMPLES)) {
    // ── Captions: wrap to the em measure, cap rows, ellipsize the last one.
    for (const scale of [1, 1.5, 3]) {
      const measure = caption.captionMeasureEm(scale);
      let rows = tw.wrapTextToWidth(text, measure);
      if (rows.length > caption.MAX_ROWS_PER_LINE) {
        rows = rows.slice(0, caption.MAX_ROWS_PER_LINE);
        const last = caption.MAX_ROWS_PER_LINE - 1;
        rows[last] = tw.truncateToWidth(rows[last] + '…', measure);
      }
      const font = 'bold ' + caption.captionFontSizeFor(rows.length, scale) + 'px sans-serif';
      check('caption@' + scale, name, rows, font, caption.CAPTION_TEXT_W);
    }

    // ── Reader: full layout pipeline, per line style.
    for (const scale of [1, 1.3]) {
      const lines = reader.layoutReaderLines([{ type: 'p', text }], { scale, title: text.slice(0, 60) });
      const box = reader.CONTENT_PX_W - 2 * reader.CONTENT_PAD;
      for (const style of ['title', 'h', 'p']) {
        const rows = lines.filter(l => l.style === style).map(l => l.text);
        if (!rows.length) continue;
        const px = reader.fontPxFor(style, scale);
        const font = (style === 'p' ? '' : 'bold ') + px + 'px sans-serif';
        check('reader@' + scale + ':' + style, name, rows, font, box);
      }
    }

    // ── Suggestion button label.
    check('suggestion', name,
      [tw.truncateToWidth(text, keyboard.SUGGESTION_MEASURE_EM)],
      'bold ' + keyboard.SUGGESTION_LABEL_FONT_PX + 'px sans-serif',
      keyboard.SUGGESTION_BTN_PX_W - 24);

    // ── Bookmark row: title (bold sans) and url (monospace).
    check('bookmark:title', name,
      [tw.truncateToWidth(text, bookmark.ROW_TITLE_EM)],
      'bold ' + bookmark.ROW_TITLE_FONT + 'px sans-serif', bookmark.ROW_TEXT_W);
    check('bookmark:url', name,
      [tw.truncateToWidth(text, bookmark.ROW_URL_EM)],
      bookmark.ROW_URL_FONT + 'px monospace', bookmark.ROW_TEXT_W);

    // ── IME composition display.
    check('ime:composition', name,
      [tw.truncateToWidth(text, keyboard.COMPOSITION_MEASURE_EM)],
      keyboard.COMPOSITION_FONT_PX + 'px monospace', keyboard.COMPOSITION_TEXT_W);
  }

  document.getElementById('out').textContent = JSON.stringify({ ok: true, results });
} catch (err) {
  document.getElementById('out').textContent =
    JSON.stringify({ ok: false, error: String(err && err.stack || err) });
}
</script></body>`;
}

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return p;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/**
 * Static server, GET-only, confined to the repo root.
 *
 * `getPage` is a callback rather than a string because the page embeds its own
 * origin (for absolute module URLs), which is only known after listen(0)
 * assigns a port.
 */
function startServer(getPage) {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath === '/__verify.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(getPage());
      return;
    }
    // Confine to the repo: resolve, then require the root prefix.
    const filePath = resolve(REPO_ROOT, '.' + urlPath);
    if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port }));
  });
}

/**
 * Run Chromium and capture the dumped DOM.
 *
 * Uses async spawn, not execFileSync: the HTTP server lives in THIS process,
 * and a synchronous child would block the event loop so the server could never
 * answer the browser's requests.
 */
function dumpDom(chrome, url) {
  return new Promise((ok, fail) => {
    const child = spawn(chrome, [
      '--headless', '--disable-gpu', '--no-sandbox',
      // Required: --dump-dom does not otherwise wait for async module scripts.
      '--virtual-time-budget=10000',
      '--dump-dom', url
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', fail);
    child.on('close', () => ok(out));
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('No Chromium found. Set CHROME_PATH.');
    process.exit(2);
  }

  let origin = '';
  const { server, port } = await startServer(() => buildPage(origin));
  origin = `http://127.0.0.1:${port}`;

  let payload;
  try {
    const dom = await dumpDom(chrome, `${origin}/__verify.html`);
    const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
    if (!m) {
      throw new Error('no result element in dumped DOM');
    }
    const raw = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (raw === 'PENDING') {
      throw new Error('page did not finish (module scripts blocked or timed out)');
    }
    payload = JSON.parse(raw);
  } finally {
    server.close();
  }

  if (!payload.ok) {
    console.error('Verification page failed:\n' + payload.error);
    process.exit(2);
  }

  const { results } = payload;
  const bad = results.filter((r) => r.status === 'OVERFLOW');
  const soft = results.filter((r) => r.status === 'condensed');

  if (JSON_OUT) {
    console.log(JSON.stringify({ pass: bad.length === 0, condensed: soft.length, results }, null, 2));
  } else {
    console.log(`Chromium: ${chrome}\n`);
    const w = (s, n) => String(s).padEnd(n);
    console.log(w('surface', 22) + w('sample', 11) + w('widest', 10) + w('box', 8) + 'result');
    console.log('-'.repeat(62));
    for (const r of results) {
      const note = r.status === 'fits'
        ? 'fits'
        : `${r.status} +${r.overflowPx}px (${r.overflowPct}%)`;
      console.log(
        w(r.surface, 22) + w(r.sample, 11) + w(r.widestPx + 'px', 10) + w(r.boxPx + 'px', 8) + note
      );
    }
    console.log('-'.repeat(62));
    if (soft.length) {
      console.log(`${soft.length} within the ${CONDENSE_TOLERANCE_PCT}% condense tolerance ` +
        '(fillText maxWidth squeezes these; not a defect).');
    }
    console.log(bad.length === 0
      ? `PASS — ${results.length} surface/sample combinations, none overflowing.`
      : `FAIL — ${bad.length} of ${results.length} overflow beyond the condense tolerance.`);
  }
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
