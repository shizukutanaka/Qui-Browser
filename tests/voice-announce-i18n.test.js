/**
 * Voice-announce i18n — WCAG 3.1.2 Language of Parts.
 *
 * The announce strings produced OUTSIDE VoiceCommands.js must route through
 * t() so an EN session hears English, not Japanese literals:
 *   - VRApp clipboard/share handlers (extracted to src/vr/input/voiceAnnounce.js)
 *   - WebPanel.describeLocation ("where am I")
 *   - WebPanel.spellWord (grapheme-list separator)
 *
 * VoiceCommands.js itself is JA-native by design and out of scope.
 */

// ── THREE stub (module import only — methods run on Object.create'd panels) ──
jest.mock('three', () => ({
  Group: class {
    constructor() {
      this.position = { set() {} };
      this._objects = [];
    }
    add(o) {
      this._objects.push(o);
    }
    remove(o) {
      this._objects = this._objects.filter((x) => x !== o);
    }
    traverse(fn) {
      this._objects.forEach(fn);
      fn(this);
    }
  },
  Mesh: class {
    constructor() {
      this.visible = true;
      this.position = { set() {} };
      this.geometry = { dispose() {} };
      this.material = { map: null, dispose() {} };
    }
    worldToLocal(v) {
      return v;
    }
  },
  PlaneGeometry: class {
    dispose() {}
  },
  MeshBasicMaterial: class {
    dispose() {}
  },
  CanvasTexture: class {
    constructor() {
      this.needsUpdate = false;
      this.colorSpace = '';
    }
    dispose() {}
  },
  SRGBColorSpace: 'srgb',
  MathUtils: { degToRad: (d) => (d * Math.PI) / 180 }
}));

global.document = { documentElement: { lang: 'en' } };

const { setLanguage } = require('../src/i18n/i18n.js');
const { pasteAndGo, readClipboard, sharePage } = require('../src/vr/input/voiceAnnounce.js');
const { WebPanel } = require('../src/vr/browser/WebPanel.js');

afterEach(() => setLanguage('en'));

// ── fakes ────────────────────────────────────────────────────────────────────
function tabManagerWith(tab) {
  return { getActiveTab: () => tab };
}

function setClipboard(impl) {
  global.navigator = { ...(global.navigator || {}), clipboard: impl };
}

// ── pasteAndGo ───────────────────────────────────────────────────────────────
describe('pasteAndGo announce', () => {
  test('EN: opened a pasted URL', async () => {
    const tab = { navigate: jest.fn() };
    setClipboard({ readText: async () => 'https://x.jp/' });
    await expect(pasteAndGo(tabManagerWith(tab))).resolves.toBe('Opened the pasted URL');
    expect(tab.navigate).toHaveBeenCalledWith('https://x.jp/');
  });

  test('EN: clipboard holds no URL', async () => {
    setClipboard({ readText: async () => 'just text' });
    await expect(pasteAndGo(tabManagerWith(null))).resolves.toBe('No URL is copied');
  });

  test('EN: clipboard access denied', async () => {
    setClipboard({ readText: async () => Promise.reject(new Error('denied')) });
    await expect(pasteAndGo(tabManagerWith(null))).resolves.toBe('Could not access the clipboard');
  });

  test('JA: opened a pasted URL', async () => {
    setLanguage('ja');
    const tab = { navigate: jest.fn() };
    setClipboard({ readText: async () => 'https://x.jp/' });
    await expect(pasteAndGo(tabManagerWith(tab))).resolves.toBe('貼り付けて開きました');
  });

  test('JA: clipboard holds no URL', async () => {
    setLanguage('ja');
    setClipboard({ readText: async () => 'just text' });
    await expect(pasteAndGo(tabManagerWith(null))).resolves.toBe('URLがコピーされていません');
  });

  test('JA: clipboard access denied', async () => {
    setLanguage('ja');
    setClipboard({ readText: async () => Promise.reject(new Error('denied')) });
    await expect(pasteAndGo(tabManagerWith(null))).resolves.toBe('クリップボードにアクセスできません');
  });
});

// ── readClipboard ────────────────────────────────────────────────────────────
describe('readClipboard announce', () => {
  test('returns the clipboard text verbatim (user content is not localized)', async () => {
    setClipboard({ readText: async () => 'user text' });
    await expect(readClipboard()).resolves.toBe('user text');
  });

  test('EN: empty clipboard', async () => {
    setClipboard({ readText: async () => '   ' });
    await expect(readClipboard()).resolves.toBe('Nothing is copied');
  });

  test('JA: empty clipboard', async () => {
    setLanguage('ja');
    setClipboard({ readText: async () => '   ' });
    await expect(readClipboard()).resolves.toBe('コピーされていません');
  });

  test('JA: clipboard access denied', async () => {
    setLanguage('ja');
    setClipboard({ readText: async () => Promise.reject(new Error('denied')) });
    await expect(readClipboard()).resolves.toBe('クリップボードにアクセスできません');
  });
});

// ── sharePage ────────────────────────────────────────────────────────────────
describe('sharePage announce', () => {
  const tab = { currentUrl: 'https://x.jp/', currentTitle: 'X' };

  test('EN: no URL to share', async () => {
    await expect(sharePage(tabManagerWith(null))).resolves.toBe('No URL to share');
  });

  test('EN: shared via Web Share', async () => {
    global.navigator = { share: async () => {} };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('Shared');
  });

  test('EN: share cancelled', async () => {
    global.navigator = { share: async () => Promise.reject(new Error('abort')) };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('Share cancelled');
  });

  test('EN: share unsupported — falls back to clipboard', async () => {
    global.navigator = { clipboard: { writeText: async () => {} } };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('Sharing unsupported; copied the URL');
  });

  test('EN: share unsupported and clipboard write fails', async () => {
    global.navigator = { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('Could not share');
  });

  test('JA: no URL to share', async () => {
    setLanguage('ja');
    await expect(sharePage(tabManagerWith(null))).resolves.toBe('共有するURLがありません');
  });

  test('JA: shared via Web Share', async () => {
    setLanguage('ja');
    global.navigator = { share: async () => {} };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('共有しました');
  });

  test('JA: share cancelled', async () => {
    setLanguage('ja');
    global.navigator = { share: async () => Promise.reject(new Error('abort')) };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('共有がキャンセルされました');
  });

  test('JA: share unsupported — falls back to clipboard', async () => {
    setLanguage('ja');
    global.navigator = { clipboard: { writeText: async () => {} } };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('共有は未対応のためURLをコピーしました');
  });

  test('JA: share unsupported and clipboard write fails', async () => {
    setLanguage('ja');
    global.navigator = { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } };
    await expect(sharePage(tabManagerWith(tab))).resolves.toBe('共有できません');
  });
});

// ── WebPanel.describeLocation ────────────────────────────────────────────────
function panelWith(fields) {
  const p = Object.create(WebPanel.prototype);
  Object.assign(p, fields);
  return p;
}

describe('describeLocation announce', () => {
  test('EN: nothing open', () => {
    const p = panelWith({ currentTitle: '', currentUrl: '' });
    expect(p.describeLocation()).toBe('Nothing is open');
  });

  test('JA: nothing open', () => {
    setLanguage('ja');
    const p = panelWith({ currentTitle: '', currentUrl: '' });
    expect(p.describeLocation()).toBe('何も開いていません');
  });

  test('EN: reader position reports "at line N–M/T"', () => {
    const p = panelWith({
      currentTitle: 'Example',
      currentUrl: 'https://a.example/',
      _contentState: 'reader',
      _readerLines: new Array(100).fill({ style: 'p', text: 'x' }),
      _readerScale: 1,
      _readerScroll: 30
    });
    expect(p.describeLocation()).toMatch(/^Example — at line \d+–\d+\/100$/);
  });

  test('JA: reader position reports 現在 N–M/T 行目', () => {
    setLanguage('ja');
    const p = panelWith({
      currentTitle: '記事タイトル',
      currentUrl: 'https://a.example/',
      _contentState: 'reader',
      _readerLines: new Array(100).fill({ style: 'p', text: 'x' }),
      _readerScale: 1,
      _readerScroll: 30
    });
    expect(p.describeLocation()).toMatch(/^記事タイトル。現在 \d+–\d+\/100 行目$/);
  });

  test('EN: whole article in view', () => {
    const p = panelWith({
      currentTitle: 'Example',
      currentUrl: 'https://a.example/',
      _contentState: 'reader',
      _readerLines: new Array(5).fill({ style: 'p', text: 'x' }),
      _readerScale: 1,
      _readerScroll: 0
    });
    expect(p.describeLocation()).toBe('Example — showing the full article');
  });

  test('JA: whole article in view', () => {
    setLanguage('ja');
    const p = panelWith({
      currentTitle: '記事タイトル',
      currentUrl: 'https://a.example/',
      _contentState: 'reader',
      _readerLines: new Array(5).fill({ style: 'p', text: 'x' }),
      _readerScale: 1,
      _readerScroll: 0
    });
    expect(p.describeLocation()).toBe('記事タイトル。全文表示中');
  });
});

// ── WebPanel.spellWord ───────────────────────────────────────────────────────
describe('spellWord announce separator', () => {
  const fields = {
    _contentState: 'reader',
    _readerLines: [{ style: 'p', text: 'hello world' }],
    _readerScale: 1,
    _readerScroll: 0,
    _wordCaret: null
  };

  test('EN: graphemes are comma-separated', () => {
    const p = panelWith({ ...fields });
    expect(p.spellWord()).toEqual({ spelled: 'h, e, l, l, o', word: 'hello' });
  });

  test('JA: graphemes are 、-separated', () => {
    setLanguage('ja');
    const p = panelWith({ ...fields });
    expect(p.spellWord()).toEqual({ spelled: 'h、e、l、l、o', word: 'hello' });
  });
});
