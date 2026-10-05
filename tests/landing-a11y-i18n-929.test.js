const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'i18n.js'), 'utf8');

// Every element tag (open tag) in index.html that carries a given attribute.
function tagsWith(attr) {
  const out = [];
  const re = new RegExp('<[^>]+\\s' + attr + '="[^"]*"[^>]*>', 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[0]);
  }
  return out;
}

// The data-i18n-attr="attr:key;attr2:key2" pairs of a tag, or [] when absent.
function wiredPairs(tag) {
  const m = tag.match(/data-i18n-attr="([^"]*)"/);
  if (!m) {
    return [];
  }
  return m[1]
    .split(';')
    .map((pair) => pair.split(':').map((s) => (s ? s.trim() : s)))
    .filter((pair) => pair[0] && pair[1]);
}

// Locate `'<key>'` inside the en block and the ja block of CATALOG.
function keyInLang(key, lang) {
  const langIdx = i18nSrc.indexOf(`\n  ${lang}: {`);
  if (langIdx === -1) {
    return false;
  }
  const rest = i18nSrc.slice(langIdx);
  const nextLang = rest.slice(1).search(/\n\s{2}[a-z]{2}: \{/);
  const block = nextLang === -1 ? rest : rest.slice(0, nextLang + 1);
  return block.includes(`'${key}':`);
}

describe('landing-shell assistive labels are routed through i18n (round 929)', () => {
  test('every aria-label carries a data-i18n-attr entry for aria-label', () => {
    const missing = tagsWith('aria-label').filter((tag) => !wiredPairs(tag).some(([attr]) => attr === 'aria-label'));
    expect(missing).toEqual([]);
  });

  test('every title attribute carries a data-i18n-attr entry for title', () => {
    const missing = tagsWith('title').filter((tag) => !wiredPairs(tag).some(([attr]) => attr === 'title'));
    expect(missing).toEqual([]);
  });

  test('the loading text element is translated via data-i18n', () => {
    const tag = html.match(/<div[^>]*class="loading-text"[^>]*>/);
    expect(tag).toBeTruthy();
    expect(tag[0]).toMatch(/data-i18n="[^"]+"/);
  });

  test('every data-i18n key resolves in both en and ja catalogs', () => {
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    const missing = keys.filter((key) => !(keyInLang(key, 'en') && keyInLang(key, 'ja')));
    expect(missing).toEqual([]);
  });

  test('every data-i18n-attr key resolves in both en and ja catalogs', () => {
    const keys = [];
    for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
      for (const [_attr, key] of wiredPairs(m[0])) {
        keys.push(key);
      }
    }
    const missing = [...new Set(keys)].filter((key) => !(keyInLang(key, 'en') && keyInLang(key, 'ja')));
    expect(missing).toEqual([]);
  });
});
