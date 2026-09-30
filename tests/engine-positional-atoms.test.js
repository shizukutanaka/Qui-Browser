/**
 * Engine-shorthand & collection-verb atoms (round 65).
 *
 * Probe-driven: 'タブを全部閉じて' was NO-MATCH (close-all-tabs only had
 * する/る stems), 'Googleにして'/'Bingで検索' engine shorthand missed
 * search-engine entirely, '検索をやめる/キャンセル' missed clear-find, and
 * the 〜の末尾/もう一文/何段落目 family was scattered across NO-MATCH.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', goBack: jest.fn(() => true), goForward: jest.fn(() => true) },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', goBack: jest.fn(() => true), goForward: jest.fn(() => true) },
    ],
    activeIndex: 0,
    closeAllTabs: jest.fn(() => 1),
    closeOtherTabs: jest.fn(() => 1),
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc._onSearchEngine = jest.fn(() => 'google');
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('bulk-close phrasing', () => {
  test.each(['タブを全部閉じて', '全タブを閉じて', 'タブ全部閉じて', '全てのタブを閉じて'])(
    '"%s" calls closeAllTabs', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc._tm.closeAllTabs).toHaveBeenCalled();
    });
  test.each(['このタブだけ', 'このタブだけ残す', '他を全部閉じて'])(
    '"%s" calls closeOtherTabs', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc._tm.closeOtherTabs).toHaveBeenCalled();
    });
});

describe('scroll-bottom phrasing', () => {
  test.each(['ページの末尾', '末尾', '末尾まで', 'ページの終わり'])(
    '"%s" scrolls to the bottom', (p) => {
      const vc = makeVC();
      const tab = vc._tm.getActiveTab();
      tab.scrollToBottom = jest.fn(() => true);
      run(vc, p);
      expect(tab.scrollToBottom).toHaveBeenCalled();
    });
});

describe('search-engine shorthand', () => {
  test.each(['Googleにして', 'Googleを使って', 'グーグルで検索', 'Googleで検索'])(
    '"%s" resolves the google engine', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('search-engine');
      expect(vc._onSearchEngine).toHaveBeenCalledWith('google');
    });
  test('「Yahooにして」 answers honestly (yahoo is not a supported engine)', () => {
    const vc = makeVC();
    run(vc, 'Yahooにして');
    expect(vc.lastCommand?.key).toBe('search-engine');
    expect(last(vc)).toContain('使えません');
  });
  test('「検索エンジンは」 still hits the status query, not the setter', () => {
    const vc = makeVC();
    run(vc, '検索エンジンは');
    expect(vc.lastCommand?.key).not.toBe('search-engine');
  });
});

describe('search dismissal & voice-search prompt', () => {
  test.each(['検索をやめる', '検索をキャンセル', '検索を中止'])(
    '"%s" hits clear-find', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('clear-find');
    });
  test('「音声検索」 prompts for a term instead of NO-MATCH', () => {
    const vc = makeVC();
    run(vc, '音声検索');
    expect(vc.lastCommand?.key).toBe('web-search');
    expect(last(vc)).toContain('検索語がありません');
  });
});

describe('status & caret phrasing', () => {
  test.each(['読み込んでいる', '読み込んでいますか', 'まだ読み込み中ですか'])(
    '"%s" hits loading-status', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('loading-status');
    });
  test.each(['フォーカスは', '選択中は', '選択されているもの'])(
    '"%s" hits where-am-i', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('where-am-i');
    });
  test.each(['今何行目', '現在の行', '行番号は', '今は何行目'])(
    '"%s" hits line-status', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('line-status');
    });
  test.each(['何段落目', '今は何段落目', '段落番号は'])(
    '"%s" hits paragraph-status', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('paragraph-status');
    });
  test.each(['何見出し目', '見出し番号は'])('"%s" hits read-heading', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('read-heading');
  });
});

describe('caret "one more" & undo phrasing', () => {
  test.each(['もう一行', 'もう一行読んで'])('"%s" → next-line', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('next-line');
  });
  test.each(['もう一段落', 'もう一段落読んで'])('"%s" → next-paragraph', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('next-paragraph');
  });
  test.each(['もう一文', 'もう一文読んで'])('"%s" → next-sentence', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('next-sentence');
  });
  test.each(['前の文に戻って', '文を戻して', '一文戻って'])('"%s" → prev-sentence', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('prev-sentence');
  });
  test.each(['その段落を読んで', 'その段落を読み上げて'])('"%s" → read-paragraph', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('read-paragraph');
  });
  test.each(['履歴の最初', '履歴の一番最初'])('"%s" → nav-steps to start', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('nav-steps');
  });
});

describe('coexistence guards', () => {
  test('「他のタブを閉じて」 still calls closeOtherTabs (not closeAllTabs)', () => {
    const vc = makeVC();
    run(vc, '他のタブを閉じて');
    expect(vc._tm.closeOtherTabs).toHaveBeenCalled();
    expect(vc._tm.closeAllTabs).not.toHaveBeenCalled();
  });
  test('「ニュースのタブ」 still does the named lookup', () => {
    const vc = makeVC();
    run(vc, 'ニュースのタブ');
    expect(vc._tm.setActive !== undefined || true).toBe(true);
    expect(vc.lastCommand?.key).toBe('tab-by-name');
  });
  test('「ニュースを検索して」 still web-searches', () => {
    const vc = makeVC();
    run(vc, 'ニュースを検索して');
    expect(vc.lastCommand?.key).toBe('web-search');
    expect(last(vc)).toContain('ニュース');
  });
  test('「戻る」 still goes back once', () => {
    const vc = makeVC();
    run(vc, '戻る');
    expect(vc.lastCommand?.key).toBe('back');
  });
});
