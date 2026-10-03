/**
 * Remaining VR caption/prompt strings — i18n coverage (WCAG 3.1.1).
 *
 * These keys replace the last hard-coded English (and one hard-coded
 * Japanese) strings still emitted by VRApp's caption paths:
 *  - `Loading:` / `Tab:` / `Top site:` / `Opening:` / `Keyboard:` prefixes
 *  - `音量:` shown to English users
 *  - keyboard prompts 'Enter URL' / 'Enter video URL'
 *  - snap-turn direction words in snapTurnLabel()
 */
const { t, setLanguage } = require('../src/i18n/i18n.js');
const { snapTurnLabel } = require('../src/vr/comfort/ComfortSystem.js');

const CASES = [
  ['vr.msg.tabLabel', 'Tab', 'タブ'],
  ['vr.msg.keyboardOpen', 'Keyboard: open', 'キーボード: 開く'],
  ['vr.msg.keyboardClosed', 'Keyboard: closed', 'キーボード: 閉じる'],
  ['vr.msg.volumeLabel', 'Volume', '音量'],
  ['vr.msg.topSite', 'Top site', 'トップサイト'],
  ['vr.msg.openingLabel', 'Opening', '開いています'],
  ['vr.prompt.url', 'Enter URL', 'URL を入力'],
  ['vr.prompt.videoUrl', 'Enter video URL', '動画の URL を入力']
];

describe('remaining caption strings have en + ja catalog entries', () => {
  afterEach(() => setLanguage('en'));

  test.each(CASES)('%s: en=%s ja=%s', (key, en, ja) => {
    setLanguage('en');
    expect(t(key)).toBe(en);
    setLanguage('ja');
    expect(t(key)).toBe(ja);
  });
});

describe('snapTurnLabel honours the active language', () => {
  afterEach(() => setLanguage('en'));

  test('English direction words (unchanged default)', () => {
    setLanguage('en');
    expect(snapTurnLabel(1, 30)).toBe('↻ Right 30°');
    expect(snapTurnLabel(-1, 30)).toBe('↺ Left 30°');
  });

  test('Japanese direction words', () => {
    setLanguage('ja');
    expect(snapTurnLabel(1, 30)).toBe('↻ 右 30°');
    expect(snapTurnLabel(-1, 30)).toBe('↺ 左 30°');
  });

  test('arrows stay language-independent glyphs', () => {
    setLanguage('ja');
    expect(snapTurnLabel(1, 30)[0]).not.toBe(snapTurnLabel(-1, 30)[0]);
  });
});
