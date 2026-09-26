/**
 * Panel/list & locator atoms (round 74).
 *
 * Probe-driven: '最近のタブ'/'使用中のタブ'/'今のタブ' mis-searched as a tab
 * title, '右に移動して' literal-navigated (go-to), recommendation phrases
 * ('人気の記事'/'ランキング'/'トレンド'), saved-list phrases
 * ('リーディングリスト'), tab-collection forms ('タブを一覧'/'タブ数'),
 * clutter complaints ('タブが重い'/'パネルが多い'), and lateral panel moves
 * ('右に寄せて'/'上に上げて') all had no route or a wrong one.
 */

let VoiceCommands;
try {
  VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands;
} catch {
  VoiceCommands = null;
}

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: true }
    ],
    activeIndex: 0,
    setActive: jest.fn(function (i) {
      this.activeIndex = i;
    }),
    getActiveTab: jest.fn(function () {
      return this.tabs[this.activeIndex];
    }),
    closeTab: jest.fn(() => true),
    moveTab: jest.fn(() => true),
    newTab: jest.fn(() => ({ id: 'new' }))
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('tab-by-name misroute fixes', () => {
  test.each(['最近のタブ', '使用中のタブ', 'アクティブなタブ', '今のタブ',
    '今見てるタブ', '今見ているタブ', '今開いてるタブ', '選択中のタブ'])(
    '"%s" describes the active tab instead of searching a title', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('describe-tab');
      expect(last(vc)).toContain('ニュース');
    });
  test('"メモのタブ" still searches by name (coexistence)', () => {
    const vc = makeVC();
    run(vc, 'メモのタブ');
    expect(key(vc)).toBe('tab-by-name');
  });
});

describe('recommendation/discovery phrases → top-sites', () => {
  test.each(['おすすめを読んで', '人気の記事', '注目の記事', '話題のニュース',
    'トップ記事', 'ランキング', '急上昇', 'おすすめのサイト',
    '閲覧ランキング', 'トレンド', '今話題', '人気記事', 'おすすめ記事'])(
    '"%s" opens the frecency list', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('top-sites');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('saved-list phrases → bookmarks-open', () => {
  test.each(['保存した記事', '保存ページ', '読みたいリスト', 'リーディングリスト',
    '後で読むリスト', 'ウォッチリスト', '保存したページ', '保存したもの',
    '保存済み', 'お気に入りの記事', 'ブックマークした記事'])(
    '"%s" opens the bookmarks panel', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('bookmarks-open');
    });
});

describe('tab collection & count forms', () => {
  test.each(['開いたタブ全部', 'タブ全部見せて', 'タブを一覧',
    'タブの一覧を出して', 'タブの一覧を見せて'])(
    '"%s" lists the open tabs', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tabs-list');
    });
  test.each(['タブ数', '開いてる数', '全部で何個', 'どのくらい開いてる',
    '開いてるタブ数', 'タブの個数', 'タブ何個ある', '全部でいくつ'])(
    '"%s" announces the tab count', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tab-status');
    });
  test.each(['タブが重い', 'タブ多すぎ', 'ウィンドウが多い', 'パネルが多い',
    'タブ多い', 'ウィンドウが多すぎ'])(
    '"%s" clutter complaint lists the tabs', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tabs-list');
    });
  test.each(['パネルを減らして', 'ウィンドウを減らして', 'パネルを減らす'])(
    '"%s" closes the active tab (タブを減らして parity)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('close-tab');
      expect(vc._tm.closeTab).toHaveBeenCalled();
    });
});

describe('close-tab surface names', () => {
  test.each(['ウインドウを閉じて', '画面を閉じて', 'この画面を閉じて',
    '見てる画面を閉じて', '見ている画面を閉じて', 'パネルを閉じて'])(
    '"%s" closes the active tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('close-tab');
    });
});

describe('panel spatial moves', () => {
  test.each(['こっちに来て', 'こっちにきて', '手前にして', '手前に来て'])(
    '"%s" brings the panel closer', (p) => {
      const vc = makeVC();
      vc._onPanelDistance = jest.fn(() => 1.8);
      run(vc, p);
      expect(key(vc)).toBe('panel-distance');
      expect(vc._onPanelDistance).toHaveBeenCalledWith(-0.2);
    });
  test.each(['奥にして', '奥に動かして', '奥に寄せて'])(
    '"%s" pushes the panel away', (p) => {
      const vc = makeVC();
      vc._onPanelDistance = jest.fn(() => 2.2);
      run(vc, p);
      expect(key(vc)).toBe('panel-distance');
      expect(vc._onPanelDistance).toHaveBeenCalledWith(0.2);
    });
  test.each(['パネルを動かして', 'パネルを移動', 'パネルの場所',
    '右に寄せて', '左に寄せて', '上に上げて', '下に下げて',
    '少し上げて', '少し下げて', '目の高さ', '高さを合わせて',
    'パネルを右に', 'パネルを左に', 'パネルを上げて', 'パネルを下げて',
    'パネルを横に', '位置を変えて', 'move the panel'])(
    '"%s" explains gaze-drag honestly', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('panel-move');
      expect(last(vc)).toContain('つかんで');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['右に移動して', '右に動かして'])(
    '"%s" moves the tab right (go-to misroute fix)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('move-tab-right');
      expect(vc._tm.moveTab).toHaveBeenCalledWith(0, 1);
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['左に移動して', '左に動かして'])(
    '"%s" moves the tab left', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('move-tab-left');
      expect(vc._tm.moveTab).toHaveBeenCalledWith(0, -1);
    });
});

describe('recenter aliases', () => {
  test.each(['中央にして', '真ん中にして', 'リセンターして', '向き直して',
    '真ん中に戻して', 'センターにして', 'リセンタリング', '中央に合わせて'])(
    '"%s" recenters', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('recenter');
    });
});

describe('coexistence guards', () => {
  test.each([['次のタブ', 'next-tab'], ['タブを右に移動', 'move-tab-right'],
    ['音量を上げて', 'volume-up'], ['上にスクロール', 'scroll-up'],
    ['タブは何個', 'tab-status'], ['おすすめの記事', 'web-search'],
    ['近づけて', 'panel-distance']])('"%s" stays with %s', (p, want) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe(want);
  });
});
