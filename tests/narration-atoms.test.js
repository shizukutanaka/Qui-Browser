/**
 * Round-8 narration controls — screen-reader rate/pause parity plus the
 * outline atom:
 *   - VoiceCommands.setSpeechRate / _speechRate applied by speak()
 *     (NVDA rate control: blind users run TTS fast, and voice is their
 *     only adjustment channel inside the HMD)
 *   - pauseSpeaking/resumeSpeaking → SpeechSynthesis.pause/resume
 *     (keeps the queue — unlike stop-reading's cancel)
 *   - WebPanel.getReaderToc + voice '目次'
 *     (VoiceOver rotor "headings" / JAWS headings dialog)
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockGroup {
  constructor() {
    this.position = { set: jest.fn() };
    this._objects = [];
  }
  add(o) { this._objects.push(o); }
  remove(o) { this._objects = this._objects.filter(x => x !== o); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
}
class MockMesh {
  constructor() {
    this.name = '';
    this.position = { set: jest.fn() };
  }
  worldToLocal(v) { return v; }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));

// ── WebPanel stub for TabManager/voice tests ──────────────────────────────────
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.currentUrl = '';
      this.currentTitle = '';
      this.isPrivate = !!opts.privateMode;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    dispose() { this.disposed = true; }
  }
}));
const { WebPanel: RealWebPanel } = jest.requireActual('../src/vr/browser/WebPanel.js');

global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      fillStyle: '', font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.URL = URL;
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { TabManager } = require('../src/vr/browser/TabManager.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  const utterances = [];
  vc.synthesis = {
    speak: (u) => { spoken.push(u.text); utterances.push(u); },
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn()
  };
  vc._spoken = spoken;
  vc._utterances = utterances;
  return vc;
}

function makeReaderPanel(lines) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerLines = lines;
  p._readerScale = 1;
  p._readerScroll = 0;
  p._drawContent = jest.fn();
  return p;
}

// ── setSpeechRate ─────────────────────────────────────────────────────────────
describe('setSpeechRate', () => {
  test('clamps to the 0.5–3.0 band', () => {
    const vc = new VoiceCommands();
    expect(vc.setSpeechRate(0.1)).toBe(0.5);
    expect(vc.setSpeechRate(9)).toBe(3);
    expect(vc.setSpeechRate(1.5)).toBe(1.5);
  });

  test('non-numeric input resets to 1.0', () => {
    const vc = new VoiceCommands();
    vc.setSpeechRate(2);
    expect(vc.setSpeechRate('ludicrous')).toBe(1.0);
  });
});

// ── speak() applies the rate ──────────────────────────────────────────────────
describe('speak() speech rate', () => {
  test('utterances inherit the stored _speechRate', () => {
    const vc = makeSpeakingVC({});
    vc.setSpeechRate(2);
    vc.speak('テスト');
    expect(vc._utterances[0].rate).toBe(2);
  });

  test('an explicit options.rate overrides the stored rate', () => {
    const vc = makeSpeakingVC({});
    vc.setSpeechRate(2);
    vc.speak('テスト', { rate: 0.75 });
    expect(vc._utterances[0].rate).toBe(0.75);
  });
});

// ── pauseSpeaking / resumeSpeaking ───────────────────────────────────────────
describe('pause/resume narration', () => {
  test('pauses and resumes the synthesis queue', () => {
    const vc = makeSpeakingVC({});
    vc.pauseSpeaking();
    vc.resumeSpeaking();
    expect(vc.synthesis.pause).toHaveBeenCalled();
    expect(vc.synthesis.resume).toHaveBeenCalled();
  });

  test('no-ops without a synthesis engine', () => {
    const vc = new VoiceCommands();
    expect(() => { vc.pauseSpeaking(); vc.resumeSpeaking(); }).not.toThrow();
  });
});

// ── voice commands: rate ─────────────────────────────────────────────────────
describe('speech-rate voice commands', () => {
  test('"速くして" steps the rate up and announces it', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('速くして');
    expect(vc._speechRate).toBe(1.25);
    expect(vc._spoken[vc._spoken.length - 1]).toBe('読み上げ速度 1.25倍');
  });

  test('"遅くして" steps the rate down and announces it', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('遅くして');
    expect(vc._speechRate).toBe(0.75);
    expect(vc._spoken[vc._spoken.length - 1]).toBe('読み上げ速度 0.75倍');
  });

  test('the announce clamps honestly at the 3.0 ceiling', () => {
    const vc = makeSpeakingVC({});
    vc.setSpeechRate(2.9);
    vc.processCommand('speak faster');
    expect(vc._speechRate).toBe(3);
    expect(vc._spoken[vc._spoken.length - 1]).toBe('読み上げ速度 3.00倍');
  });

  test('rate changes stick for later utterances', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('速くして');
    vc.speak('確認');
    expect(vc._utterances[vc._utterances.length - 1].rate).toBe(1.25);
  });
});

// ── voice commands: pause/resume narration ────────────────────────────────────
describe('pause/resume voice commands', () => {
  test('"読み上げを一時停止" pauses without cancelling', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('読み上げを一時停止');
    expect(vc.synthesis.pause).toHaveBeenCalled();
    expect(vc.synthesis.cancel).not.toHaveBeenCalled();
    expect(vc._spoken).toContain('読み上げを一時停止します');
  });

  test('"読み上げを再開" resumes the queue', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('読み上げを再開');
    expect(vc.synthesis.resume).toHaveBeenCalled();
    expect(vc._spoken).toContain('読み上げを再開します');
  });

  test('"pause video" still routes to the video toggle, not narration', () => {
    const onVideoToggle = jest.fn(() => 'paused');
    const vc = makeSpeakingVC({ onVideoToggle });
    vc.processCommand('pause video');
    expect(onVideoToggle).toHaveBeenCalled();
    expect(vc.synthesis.pause).not.toHaveBeenCalled();
  });
});

// ── WebPanel.getReaderToc ─────────────────────────────────────────────────────
describe('getReaderToc', () => {
  test('returns title + heading texts in document order', () => {
    const p = makeReaderPanel([
      { style: 'title', text: '記事タイトル' },
      { style: 'p', text: '本文一' },
      { style: 'h', text: '第一章' },
      { style: 'p', text: '本文二' },
      { style: 'h', text: '第二章' }
    ]);
    expect(p.getReaderToc()).toEqual(['記事タイトル', '第一章', '第二章']);
  });

  test('empty outside reader mode', () => {
    const p = Object.create(RealWebPanel.prototype);
    p._contentState = 'loaded';
    p._readerLines = [];
    expect(p.getReaderToc()).toEqual([]);
  });
});

// ── voice command: toc ───────────────────────────────────────────────────────
describe('toc voice command', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('"目次" reads the heading list', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.getReaderToc = jest.fn(() => ['タイトル', '見出しA', '見出しB']);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('目次');
    expect(vc._spoken[vc._spoken.length - 1]).toBe('3個の見出し。タイトル、見出しA、見出しB');
  });

  test('long outlines are capped with an honest remainder count', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.getReaderToc = jest.fn(() => new Array(13).fill(0).map((_, i) => `H${i}`));
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('目次');
    const s = vc._spoken[vc._spoken.length - 1];
    expect(s).toContain('13個の見出し');
    expect(s).toContain('、他3件');
  });

  test('announces "no outline" when the tab has no headings', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.getReaderToc = jest.fn(() => []);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('目次');
    expect(vc._spoken).toContain('目次がありません');
  });

  test('announces "no outline" with no tab at all', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('table of contents');
    expect(vc._spoken).toContain('目次がありません');
  });
});
