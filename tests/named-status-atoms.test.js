/**
 * Round 38 atoms — named pin, explicit unpin, indexed reload, left/right
 * aliases, speech reset, confidence / wake-word / reader-scale status.
 * Every test asserts a behavior-specific effect (togglePin call, reload call,
 * or the exact announcement) — nothing that another command coincidentally
 * says.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return { currentTitle: title, currentUrl: url, pinned: false, reload: jest.fn(), ...extra };
}

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabManager = opts.tabManager === undefined ? {
    tabs: [tab('ニュース', 'https://news.jp'), tab('天気', 'https://weather.jp'), tab('SNS', 'https://sns.jp')],
    activeIndex: 0,
    setActive: jest.fn(),
    nextTab: jest.fn(),
    prevTab: jest.fn(),
    closeTab: jest.fn(),
    togglePin: jest.fn((i) => (i === 0 ? 'pinned' : 'unpinned')),
    previousActiveIndex: () => 0
  } : opts.tabManager;
  vc.connectBrowser({ tabManager, ...opts });
  return { vc, spoken, tabManager };
}

describe('pin-tab-by-name', () => {
  test('"ニュースのタブをピン" pins tab 1 by title', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('ニュースのタブをピン');
    expect(tabManager.togglePin).toHaveBeenCalledWith(0);
    expect(spoken).toContain('タブ1をピン留めしました');
  });
  test('"pin the weather tab" pins tab 2 by title', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('pin the weather tab');
    expect(tabManager.togglePin).toHaveBeenCalledWith(1);
    expect(spoken).toContain('タブ2のピンを外しました');
  });
  test('"pin tab named sns" pins tab 3', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('pin tab named sns');
    expect(tabManager.togglePin).toHaveBeenCalledWith(2);
  });
  test('no match announces honestly', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('存在しないのタブをピン');
    expect(tabManager.togglePin).not.toHaveBeenCalled();
    expect(spoken).toContain('「存在しない」のタブがありません');
  });
  test('"このタブをピン" falls through to pin-tab (not by-name)', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('このタブをピン');
    expect(spoken[0]).not.toMatch(/のタブがありません/);
  });
});

describe('unpin-active', () => {
  test('"ピンを外して" unpins a pinned active tab', () => {
    const { vc, spoken, tabManager } = makeVC();
    tabManager.tabs[0].pinned = true;
    vc.processCommand('ピンを外して');
    expect(tabManager.togglePin).toHaveBeenCalledWith(0);
    expect(spoken).toContain('ピン留めを外しました');
  });
  test('honest when the active tab is not pinned', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('ピンを外して');
    expect(tabManager.togglePin).not.toHaveBeenCalled();
    expect(spoken).toContain('ピン留めされていません');
  });
});

describe('reload-tab-n', () => {
  test('"タブ2をリロード" reloads tab 2, not select', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('タブ2をリロード');
    expect(tabManager.tabs[1].reload).toHaveBeenCalled();
    expect(tabManager.setActive).not.toHaveBeenCalled();
    expect(spoken).toContain('タブ2を再読み込みしました');
  });
  test('"reload tab 3" reloads tab 3', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('reload tab 3');
    expect(tabManager.tabs[2].reload).toHaveBeenCalled();
    expect(tabManager.setActive).not.toHaveBeenCalled();
  });
  test('out of range announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('タブ9をリロード');
    expect(spoken).toContain('タブ9はありません');
  });
});

describe('left/right tab aliases', () => {
  test('"右のタブ" cycles next (not tab-by-name)', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('右のタブ');
    expect(tabManager.nextTab).toHaveBeenCalled();
  });
  test('"左のタブ" cycles prev', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('左のタブ');
    expect(tabManager.prevTab).toHaveBeenCalled();
  });
});

describe('speech-reset', () => {
  test('"速度をリセット" restores rate and pitch to 1.0', () => {
    const { vc, spoken } = makeVC();
    vc._speechRate = 2.5;
    vc._speechPitch = 0.5;
    vc.processCommand('速度をリセット');
    expect(vc._speechRate).toBe(1.0);
    expect(vc._speechPitch).toBe(1.0);
    expect(spoken).toContain('読み上げをリセットしました');
  });
  test('"reset speech" resets rate', () => {
    const { vc } = makeVC();
    vc._speechRate = 3.0;
    vc.processCommand('reset speech');
    expect(vc._speechRate).toBe(1.0);
  });
});

describe('status twins', () => {
  test('"認識の信頼度は" reports the last confidence', () => {
    const { vc, spoken } = makeVC();
    vc.confidence = 0.82;
    vc.processCommand('認識の信頼度は');
    expect(spoken).toContain('認識の信頼度は82%です');
  });
  test('"ウェイクワードは" reports the wake word', () => {
    const { vc, spoken } = makeVC();
    vc.settings.requireWakeWord = true;
    vc.settings.wakeWord = 'キューブラウザ';
    vc.processCommand('ウェイクワードは');
    expect(spoken).toContain('ウェイクワードは「キューブラウザ」です');
  });
  test('wake-word off announces off', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('wake word status');
    expect(spoken).toContain('ウェイクワードはオフです');
  });
  test('"記事の文字サイズは" reports the hook value', () => {
    const { vc, spoken } = makeVC({ onReaderScaleStatus: () => 1.5 });
    vc.processCommand('記事の文字サイズは');
    expect(spoken).toContain('記事の文字サイズは1.5倍です');
  });
  test('reader-scale fallback without hook', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('text size');
    expect(spoken).toContain('文字サイズを確認できません');
  });
});
