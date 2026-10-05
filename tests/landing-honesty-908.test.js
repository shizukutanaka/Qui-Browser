import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const I18N = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'i18n.js'), 'utf8');

describe('landing-page honesty', () => {
  test('feature grid does not advertise unimplemented features (Multiplayer / AI Recommendations)', () => {
    // No multiplayer/WebRTC/AI code exists anywhere in src — same class as the
    // removed main.js banner "Experimental: WebGPU, Multiplayer, AI" (#1152).
    expect(HTML).not.toMatch(/Multiplayer|AI Recommendations/);
    expect(I18N).not.toMatch(/'feat\.(mp|ai)\./);
  });

  test('no copy claims the dead KTX2 pipeline — texture loader removed at #1121', () => {
    expect(HTML).not.toMatch(/KTX2/i);
    expect(I18N).not.toMatch(/KTX2/i);
  });

  test('gesture count matches HandTracking.detectGesture (6, not 12)', () => {
    expect(I18N).not.toMatch(/12 (gesture|種)/);
    expect(I18N).not.toMatch(/１２/);
  });

  test('meta description and hero subtitle name no phantom features', () => {
    expect(HTML).not.toMatch(/WebGPU|Multiplayer/);
    expect(I18N).not.toMatch(/Tier 3|experimental/);
  });

  test('every feat.* catalog key is rendered by a feature card', () => {
    const keys = new Set([...I18N.matchAll(/'(feat\.[a-z]+\.(?:title|desc))':/g)].map((m) => m[1]));
    const rendered = new Set([...HTML.matchAll(/data-i18n="(feat\.[a-z]+\.(?:title|desc))"/g)].map((m) => m[1]));
    for (const k of keys) {
      expect(rendered.has(k)).toBe(true);
    }
  });
});
