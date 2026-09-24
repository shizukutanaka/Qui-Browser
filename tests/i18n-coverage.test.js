/**
 * Every string the app shows must exist in every language it claims to speak.
 *
 * This product's headline feature is a Japanese IME, so an English string
 * leaking into a Japanese session is not cosmetic — it is WCAG 3.1.1/3.1.2, and
 * it has been found by hand three times:
 *
 *   - Session 27: 26 fully-translated `vr.msg.*` / `vr.error.*` keys existed in
 *     the catalog that VRApp never called; every tab, bookmark and subsystem
 *     status message was still a raw English literal.
 *   - Session 74 (8): the reader's own content states, the bookmark panel's
 *     tabs and empty states, and "New Tab" were hardcoded English — the main
 *     content surface of a browser sold on its Japanese input.
 *   - Session 74 (9): 39 more, including the voice-error notification that
 *     CLAUDE.md had itself listed as a critical Phase-1 gap in Session 2 and
 *     which was still English.
 *
 * Each was found by someone happening to read the right line. This finds them
 * by construction: it scans `src/` for every `t('...')` call site and checks
 * that each key resolves in each language, since `t()` returns the key itself
 * when it cannot translate.
 *
 * It cannot catch a string that was never routed through `t()` at all — that is
 * what the hardcoded-literal sweeps are for — but it does catch the much more
 * common case of a key added in one catalog and forgotten in the other.
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const SRC = join(__dirname, '..', 'src');
const LANGUAGES = ['en', 'ja'];

function jsFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      jsFiles(p, acc);
    } else if (p.endsWith('.js')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Every key passed to a literal `t('…')` call anywhere in src/, plus every
 * voice command's `confirmationKey: '…'` (resolved through t() when the
 * command fires, so it must exist in every language too).
 */
function usedKeys() {
  const keys = new Set();
  for (const file of jsFiles(SRC)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:\bt\(|confirmationKey:)\s*'([a-zA-Z0-9_.]+)'/g)) {
      keys.add(m[1]);
    }
  }
  return [...keys];
}

describe('i18n covers every string the app asks for', () => {
  // Required fresh: other suites call jest.resetModules(), which would leave a
  // module-level binding pointing at a stale instance while a later require()
  // returns a new one — the order-dependent trap hit in Session 74 (9).
  const { t, setLanguage, getLanguage } = require('../src/i18n/i18n.js');
  const keys = usedKeys();
  const original = getLanguage();
  afterAll(() => setLanguage(original));

  test('the scan actually found the call sites', () => {
    // A regex matching nothing would make every assertion below vacuous.
    expect(keys.length).toBeGreaterThan(80);
    expect(keys).toContain('vr.settings.voice');
    expect(keys).toContain('vr.voice.confirm.goTo'); // only ever a confirmationKey
  });

  for (const lang of LANGUAGES) {
    test(`every key resolves in ${lang}`, () => {
      setLanguage(lang);
      // t() returns the key unchanged when it cannot translate, so a key that
      // equals its own translation is a missing entry.
      const missing = keys.filter((k) => t(k) === k);
      expect(missing).toEqual([]);
    });
  }

  test('no key is left as an untranslated copy of the English', () => {
    // Identical text in both catalogs is almost always a forgotten
    // translation rather than a word that happens to be the same.
    setLanguage('en');
    const en = Object.fromEntries(keys.map((k) => [k, t(k)]));
    setLanguage('ja');
    const identical = keys.filter((k) => t(k) === en[k]);
    expect(identical).toEqual([]);
  });

  test('Japanese strings are actually Japanese, not romaji placeholders', () => {
    setLanguage('ja');
    const asciiOnly = keys.filter((k) => /^[\x20-\x7e]+$/.test(t(k)));
    expect(asciiOnly).toEqual([]);
  });

  test('no caption, toast or spoken line starts with a hard-coded English literal', () => {
    // The sweep the header defers to, automated. A literal first argument is
    // fine only if it opens with an interpolation (`${t('…')}: ${host}`);
    // letters before any ${ are untranslated text. This caught `Tab:`,
    // `Keyboard:`, `Top site:` and `Opening:` captions still in VRApp.
    const SINK = /(?:captionSystem\??\.show|showVRToast|\.speak)\(\s*/g;
    let sites = 0;
    const offenders = [];
    for (const file of jsFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(SINK)) {
        sites++;
        const rest = text.slice(m.index + m[0].length);
        const q = rest[0];
        if (q !== "'" && q !== '"' && q !== '`') {
          continue;
        }
        let lead = '';
        for (let i = 1; i < rest.length && rest[i] !== q; i++) {
          if (q === '`' && rest[i] === '$' && rest[i + 1] === '{') {
            break;
          }
          lead += rest[i];
        }
        if (/[A-Za-z]/.test(lead)) {
          offenders.push(`${file.slice(SRC.length + 1)}: ${m[0]}${rest.slice(0, 40)}`);
        }
      }
    }
    expect(sites).toBeGreaterThan(40); // the scan really found the sinks
    expect(offenders).toEqual([]);
  });
});
