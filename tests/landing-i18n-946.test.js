/**
 * Landing-page i18n completeness (round 946, WCAG 3.1.1 / 3.1.2).
 *
 * Two invariants over index.html + src/i18n/i18n.js:
 *  1. The static <html lang="..."> declaration must match the language the
 *     markup is actually written in. Everything hard-coded in index.html —
 *     title, hero, feature cards — is English, and applyTranslations() sets
 *     document.documentElement.lang from the catalog at boot anyway, so a
 *     static `lang="ja"` misreports English content as Japanese before JS
 *     runs (and whenever it never does).
 *  2. The <title> element must be wired through data-i18n like every other
 *     user-facing landing string, and the key it points at must exist in
 *     both catalogs — otherwise Japanese users keep an English tab title.
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const i18nSrc = readFileSync(join(ROOT, 'src', 'i18n', 'i18n.js'), 'utf8');

function catalogKeys() {
  const enStart = i18nSrc.indexOf('en: {');
  const jaStart = i18nSrc.indexOf('ja: {');
  const enEnd = i18nSrc.indexOf('},', enStart);
  const jaEnd = i18nSrc.indexOf('\n  },', jaStart);
  const grab = (block) => new Set([...block.matchAll(/'([A-Za-z0-9_.-]+)':/g)].map((m) => m[1]));
  return {
    en: grab(i18nSrc.slice(enStart, enEnd)),
    ja: grab(i18nSrc.slice(jaStart, jaEnd > 0 ? jaEnd : undefined))
  };
}

describe('landing i18n completeness', () => {
  test('static <html lang> matches the hard-coded English markup', () => {
    const m = html.match(/<html lang="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('en');
  });

  test('<title> is routed through data-i18n', () => {
    const m = html.match(/<title[^>]*data-i18n="([^"]+)"[^>]*>/);
    expect(m).not.toBeNull();
    const { en, ja } = catalogKeys();
    expect(en.has(m[1])).toBe(true);
    expect(ja.has(m[1])).toBe(true);
  });

  test('every data-i18n(-attr) key resolves in both catalogs', () => {
    const { en, ja } = catalogKeys();
    const used = new Set();
    for (const mm of html.matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)) {
      for (const part of mm[1].split(';')) {
        used.add(part.split(':').pop().trim());
      }
    }
    const missing = [...used].filter((k) => !en.has(k) || !ja.has(k));
    expect(missing).toEqual([]);
  });
});
