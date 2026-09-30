/**
 * Round 43 atoms — sensitivity-status, contrast/dwell-time status twins,
 * save-session, plus alias coverage (wake word EN, 今の段落を読んで,
 * 全て閉じて, forward, read-the-tabs, help readout, 今の言語).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, loading: false,
    headingHere: jest.fn(() => ({ index: 1, total: 7, text: 'h' })),
    ...extra
  };
}

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabs = opts.tabs || [opts.panel || tab('ニュース', 'https://news.jp')];
  const state = { activeIndex: opts.activeIndex ?? 0 };
  const tabManager = opts.tabManager === undefined ? {
    tabs,
    get activeIndex() { return state.activeIndex; },
    setActive: jest.fn((i) => { state.activeIndex = i; }),
    getActiveTab: () => tabs[state.activeIndex],
    closeAllTabs: jest.fn(() => 1),
    serializeSession: jest.fn(() => ({ tabs: tabs.map((t) => t.currentUrl), active: 0 }))
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('sensitivity-status', () => {
  test('"感度は" reports the voice-layer threshold', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('感度は');
    expect(spoken[0]).toContain('認識感度は0.7です');
  });
  test('"sensitivity" reports in English too', () => {
    const { vc, spoken } = makeVC();
    vc.settings.sensitivity = 0.4;
    vc.processCommand('sensitivity');
    expect(spoken[0]).toContain('認識感度は0.4です');
  });
});

describe('contrast-status', () => {
  test('"コントラストは" reports the panel flag via hook', () => {
    const { vc, spoken } = makeVC({ onContrastStatus: () => true });
    vc.processCommand('コントラストは');
    expect(spoken[0]).toContain('ハイコントラストはオンです');
  });
  test('missing hook answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('コントラストは');
    expect(spoken[0]).toContain('確認できません');
  });
  test('"contrast status" reports in English too', () => {
    const { vc, spoken } = makeVC({ onContrastStatus: () => false });
    vc.processCommand('contrast status');
    expect(spoken[0]).toContain('オフです');
  });
});

describe('dwell-time-status', () => {
  test('"注視時間は" reports the stepper value', () => {
    const { vc, spoken } = makeVC({ onDwellTimeStatus: () => 1500 });
    vc.processCommand('注視時間は');
    expect(spoken[0]).toContain('注視時間は1500ミリ秒です');
  });
  test('"dwell time" reports in English too', () => {
    const { vc, spoken } = makeVC({ onDwellTimeStatus: () => 800 });
    vc.processCommand('dwell time');
    expect(spoken[0]).toContain('800ミリ秒');
  });
});

describe('save-session', () => {
  test('"セッションを保存" persists and announces the count', () => {
    const { vc, spoken } = makeVC({
      onSessionSave: () => 3,
      tabs: [tab('a', 'https://a'), tab('b', 'https://b'), tab('c', 'https://c')]
    });
    vc.processCommand('セッションを保存');
    expect(spoken[0]).toContain('3個のタブを保存しました');
  });
  test('"save session" with nothing to save answers honestly', () => {
    const { vc, spoken } = makeVC({ onSessionSave: () => 0 });
    vc.processCommand('save session');
    expect(spoken[0]).toContain('保存できません');
  });
});

describe('alias coverage', () => {
  test('"wake word" reaches wake-word-status', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('wake word');
    expect(spoken[0]).toContain('ウェイクワード');
  });
  test('"今の段落を読んで" reaches read-paragraph', () => {
    const onReadParagraph = jest.fn(() => ['本文の段落']);
    const { vc } = makeVC({ onReadParagraph });
    vc.processCommand('今の段落を読んで');
    expect(onReadParagraph).toHaveBeenCalled();
  });
  test('"次の見出しを読んで" reaches next-heading', () => {
    const nextHeading = jest.fn(() => ({ index: 2, total: 7 }));
    const { vc, spoken } = makeVC({
      panel: tab('a', 'https://a', { nextHeading })
    });
    vc.processCommand('次の見出しを読んで');
    expect(nextHeading).toHaveBeenCalledWith(1);
    expect(spoken[0]).toContain('2番目の見出し');
  });
  test('"全て閉じて" reaches close-all-tabs', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('全て閉じて');
    expect(tabManager.closeAllTabs).toHaveBeenCalled();
    expect(spoken[0]).toContain('閉じました');
  });
  test('"forward" reaches navigate forward', () => {
    const goForward = jest.fn(() => true);
    const { vc, spoken } = makeVC({
      panel: tab('a', 'https://a', { goForward })
    });
    vc.processCommand('forward');
    expect(goForward).toHaveBeenCalled();
    expect(spoken[0]).toContain('進みます');
  });
  test('"タブ一覧を読み上げて" reaches tabs-list', () => {
    const { vc, spoken } = makeVC({
      tabs: [tab('a', 'https://a'), tab('b', 'https://b')]
    });
    vc.processCommand('タブ一覧を読み上げて');
    expect(spoken[0]).toContain('a');
  });
  test('"read the tabs" reaches tabs-list', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('read the tabs');
    expect(spoken[0]).toContain('ニュース');
  });
  test('"コマンド一覧を読み上げて" reaches help', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('コマンド一覧を読み上げて');
    expect(spoken[0]).toContain('使用可能なコマンド');
  });
  test('"今の言語" reaches language-status', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('今の言語');
    expect(spoken[0]).toContain('言語はja-JPです');
  });
  test('"次に進んで" reaches navigate forward', () => {
    const goForward = jest.fn(() => true);
    const { vc } = makeVC({ panel: tab('a', 'https://a', { goForward }) });
    vc.processCommand('次に進んで');
    expect(goForward).toHaveBeenCalled();
  });
});
