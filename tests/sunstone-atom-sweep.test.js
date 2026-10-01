/**
 * pass CCLXXVIII — fourth cross-command breadth sweep: bookmark family,
 * history, new-tab, bulk-close, duplicate, print/download/settings.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVc() {
  const tabs = [
    { id: 1, url: 'https://a.example', title: 'Tab A', loading: false },
    { id: 2, url: 'https://b.example', title: 'Tab B', loading: false },
  ];
  const tabManager = {
    tabs,
    activeTabId: 2,
    getActiveTab() { return tabs[1]; },
    getTab(id) { return tabs.find((t) => t.id === id); },
  };
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);
  return vc;
}

function key(phrase) {
  const vc = makeVc();
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const cases = [
  // bookmark-page
  ['ブクマして', 'bookmark-page'],
  ['このページをブクマ', 'bookmark-page'],
  ['ブックマーク登録', 'bookmark-page'],
  ['ブクマ登録して', 'bookmark-page'],
  ['favorite this page', 'bookmark-page'],
  ['後で読むために保存', 'bookmark-page'],
  ['お気に入り追加', 'bookmark-page'],
  ['お気に入りにして', 'bookmark-page'],
  ['add to my bookmarks', 'bookmark-page'],
  ['ブックマークに追加して', 'bookmark-page'],
  // unbookmark-page
  ['ブックマーク解除して', 'unbookmark-page'],
  ['お気に入り解除', 'unbookmark-page'],
  ['ブクマを外して', 'unbookmark-page'],
  ['unbookmark this', 'unbookmark-page'],
  ['ブックマークから消して', 'unbookmark-page'],
  // bookmark-status
  ['is this page bookmarked', 'bookmark-status'],
  ['このページブクマしてる', 'bookmark-status'],
  ['お気に入り登録済み', 'bookmark-status'],
  ['what did i bookmark', 'bookmark-status'],
  // bookmarks-open / bookmarks-list
  ['ブックマーク見せて', 'bookmarks-open'],
  ['ブクマ開いて', 'bookmarks-open'],
  ['list my bookmarks', 'bookmarks-open'],
  ['ブックマーク読み上げて', 'bookmarks-list'],
  ['ブックマーク何がある', 'bookmarks-list'],
  // history / history-latest / clear-history
  ['履歴見せて', 'history'],
  ['閲覧履歴を開いて', 'history'],
  ['閲覧履歴', 'history-list'],
  ['browsing history please', 'history'],
  ['さっきのページ何だっけ', 'history-latest'],
  ['what did i visit', 'history-latest'],
  ['履歴消して', 'clear-history'],
  // new-tab
  ['新しいタブ開いて', 'new-tab'],
  ['open a fresh tab', 'new-tab'],
  ['fresh tab please', 'new-tab'],
  ['タブ開いてちょ', 'new-tab'],
  ['もう一枚タブ', 'new-tab'],
  ['another tab please', 'new-tab'],
  // close-other-tabs / close-all-tabs
  ['他のタブ全部閉じて', 'close-other-tabs'],
  ['close all the other ones', 'close-other-tabs'],
  ['これ以外閉じて', 'close-other-tabs'],
  ['残りを閉じて', 'close-other-tabs'],
  ['全部のタブ閉じて', 'close-all-tabs'],
  ['タブ全部消して', 'close-all-tabs'],
  ['close em all', 'close-all-tabs'],
  // duplicate-tab
  ['このタブ複製して', 'duplicate-tab'],
  ['dup this tab', 'duplicate-tab'],
  ['このタブもう一枚', 'duplicate-tab'],
  ['clone this tab', 'duplicate-tab'],
  // print / download / settings
  ['これ印刷して', 'print'],
  ['print this page', 'print'],
  ['このページをダウンロード', 'download'],
  ['download this page', 'download'],
  ['設定開いて', 'settings-toggle'],
  // pins kept
  ['unfavorite it', 'close-tab'],
  ['さっき見てたページ', 'back'],
  ['もうちょっと小さく', 'panel-distance'],
  ['zoom in', 'reader-size-up'],
  ['縮小してズーム', 'reader-size-down'],
  ['fullscreen please', 'vr-enter'],
];

describe('pass CCLXXVIII sunstone atom sweep', () => {
  test.each(cases)('%s -> %s', (phrase, want) => {
    expect(key(phrase)).toBe(want);
  });
});
