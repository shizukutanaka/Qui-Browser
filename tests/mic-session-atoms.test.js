/**
 * Round 48 atoms — peek-tab-N (indexed non-destructive announce), undo→reopen,
 * clear-session, storage-status, trouble guidance, question-vs-mute misroutes,
 * and a fifth alias pass. External basis: Chrome undo/close-window, NVDA
 * 'say focused element' honesty, Voice Access mic-off, Firefox storage report.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabs = opts.tabs || [
    {
      currentTitle: 'ニュース', currentUrl: 'https://news.jp',
      reload: jest.fn()
    },
    { currentTitle: '天気', currentUrl: 'https://weather.jp' }
  ];
  const state = { activeIndex: 0 };
  const tabManager = {
    tabs,
    get activeIndex() { return state.activeIndex; },
    setActive: jest.fn((i) => { state.activeIndex = i; }),
    getActiveTab: () => tabs[state.activeIndex],
    closeTab: jest.fn(),
    reopenClosedTab: jest.fn(() => 'https://closed.jp')
  };
  const goTo = jest.fn();
  const vcSpy = jest.spyOn(vc, 'stop').mockImplementation(() => {});
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo, vcSpy };
}

describe('peek-tab-n: indexed non-destructive announce', () => {
  test.each(['タブ1を読んで', 'タブ2は何', 'タブ1を教えて', 'read tab 2'])(
    '"%s" announces tab N without switching', (phrase) => {
      const { vc, spoken, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.setActive).not.toHaveBeenCalled();
      expect(spoken[0]).toMatch(/^タブ[12]: /);
    });
  test('"タブ1を読んで" says the title', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('タブ1を読んで');
    expect(spoken[0]).toBe('タブ1: ニュース');
  });
  test('out of range announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('タブ9を読んで');
    expect(spoken[0]).toBe('タブ9はありません');
  });
  test('bare "タブ1" still selects', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('タブ1');
    expect(tabManager.setActive).toHaveBeenCalledWith(0);
  });
});

describe('mute misroutes: mic-off goes to stop, other-tabs does not mute', () => {
  test.each(['マイクをミュート', 'マイクオフ', 'mute the mic'])(
    '"%s" stops listening rather than muting audio', (phrase) => {
      const onMute = jest.fn();
      const { vc, vcSpy } = makeVC({ onMute });
      vc.processCommand(phrase);
      expect(vcSpy).toHaveBeenCalled();
      expect(onMute).not.toHaveBeenCalled();
    });
  test('"mute other tabs" does not mute the active tab', () => {
    const onMute = jest.fn();
    const { vc } = makeVC({ onMute });
    vc.processCommand('mute other tabs');
    expect(onMute).not.toHaveBeenCalled();
  });
  test('bare "ミュート" still toggles audio', () => {
    const onMute = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onMute });
    vc.processCommand('ミュート');
    expect(onMute).toHaveBeenCalled();
    expect(spoken[0]).toContain('ミュート');
  });
});

describe('undo / reopen aliases', () => {
  test.each(['元に戻して', '取り消して', '閉じたタブをもう一度', '閉じたタブを開いて',
    'undo', 'undo close', 'undo last'])(
    '"%s" reopens the last closed tab', (phrase) => {
      const { vc, tabManager, goTo } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.reopenClosedTab).toHaveBeenCalled();
      expect(goTo).not.toHaveBeenCalled();
    });
  test('"前回のタブを開いて" restores the session, not a literal nav', () => {
    const onRestoreSession = jest.fn(() => 2);
    const { vc, spoken, goTo } = makeVC({ onRestoreSession });
    vc.processCommand('前回のタブを開いて');
    expect(onRestoreSession).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
    expect(spoken[0]).toBe('2個のタブを復元しました');
  });
});

describe('clear-session', () => {
  test.each(['セッションを消して', 'セッションを消去', 'clear session'])(
    '"%s" clears the saved session', (phrase) => {
      const onSessionClear = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onSessionClear });
      vc.processCommand(phrase);
      expect(onSessionClear).toHaveBeenCalled();
      expect(spoken[0]).toBe('保存したセッションを消去しました');
    });
  test('nothing to clear announces honestly', () => {
    const onSessionClear = jest.fn(() => false);
    const { vc, spoken } = makeVC({ onSessionClear });
    vc.processCommand('セッションを消して');
    expect(spoken[0]).toBe('保存されたセッションはありません');
  });
});

describe('storage-status', () => {
  test('"ストレージ" reports usage via storage.estimate', async () => {
    navigator.storage = { estimate: () => Promise.resolve({ usage: 12 * 1024 * 1024, quota: 256 * 1024 * 1024 }) };
    const { vc, spoken } = makeVC();
    vc.processCommand('ストレージ');
    await flush();
    expect(spoken[0]).toBe('ストレージは約12MB使用中です（上限256MB）');
    delete navigator.storage;
  });
  test('no storage API announces honestly', async () => {
    const { vc, spoken } = makeVC();
    delete navigator.storage;
    vc.processCommand('storage');
    await flush();
    expect(spoken[0]).toBe('ストレージ情報を取得できません');
  });
});

describe('trouble: spoken guidance when the user reports a dead screen', () => {
  test.each(['反応しない', '真っ暗', '画面が見えない', 'not responding',
    'screen is dark', 'nothing works'])(
    '"%s" answers with recovery guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('リセンター');
      expect(spoken[0]).toContain('ヘルプ');
    });
});

describe('battery charging + vr-exit + close-window aliases', () => {
  test('"充電中ですか" reports the charging flag', async () => {
    navigator.getBattery = () => Promise.resolve({ level: 0.5, charging: true });
    const { vc, spoken } = makeVC();
    vc.processCommand('充電中ですか');
    await flush();
    await flush();
    expect(spoken[0]).toContain('充電中');
    delete navigator.getBattery;
  });
  test.each(['ブラウザを終了', 'アプリを終了', 'quit', 'exit the app'])(
    '"%s" exits the session', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('終了');
      expect(vc.lastCommand.key).toBe('vr-exit');
    });
  test.each(['このウィンドウを閉じて', 'close window'])(
    '"%s" closes the active tab', (phrase) => {
      const { vc, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.closeTab).toHaveBeenCalled();
    });
});

describe('alias pass V', () => {
  test('"お気に入りに追加" bookmarks the page', () => {
    const onBookmarkPage = jest.fn();
    const { vc } = makeVC({ onBookmarkPage });
    vc.processCommand('お気に入りに追加');
    expect(onBookmarkPage).toHaveBeenCalled();
  });
  test('"ブックマークから消して" unbookmarks', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ブックマークから消して');
    expect(spoken[0]).not.toContain('認識できません');
  });
  test.each(['早く読んで', 'read faster'])('"%s" raises the speech rate', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(spoken[0]).toContain('読み上げ速度');
  });
  test.each(['ゆっくり読んで', 'read slower'])('"%s" lowers the speech rate', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(spoken[0]).toContain('読み上げ速度');
  });
  test('"声は何" reports the voice', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('声は何');
    expect(spoken[0]).toContain('声');
  });
  test('"もう一回聞いて" replays the last utterance', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ヘルプ');
    const first = spoken.pop();
    vc.processCommand('もう一回聞いて');
    expect(spoken.pop()).toBe(first);
  });
  test.each(['Wi-Fiは', '接続状態', 'wifi'])('"%s" reports connectivity', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(spoken[0]).toMatch(/オンライン|オフライン/);
  });
  test('"フォントを大きく" grows reader text', () => {
    const { vc, spoken } = makeVC({ onSettingToggle: (k, d) => `key:${k}` });
    vc.processCommand('フォントを大きく');
    expect(spoken[0]).not.toContain('認識できません');
  });
  test('"スクロール位置" reports reading progress', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('スクロール位置');
    expect(spoken[0]).not.toContain('認識できません');
  });
  test('"再起動して" reloads the page', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('再起動して');
    expect(tabManager.getActiveTab().reload).toHaveBeenCalled();
  });
});
