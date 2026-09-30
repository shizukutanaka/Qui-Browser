/**
 * pass CCLXXX — sixth cross-command sweep: heading/caret nav, copy/share/
 * translate/paste, private tabs, bulk left/right/duplicate closes,
 * session + speech-rate + sensitivity/comfort fills.
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
  // headings
  ['見出しを進めて', 'next-heading'],
  ['次の見出しに進んで', 'next-heading'],
  ['次見出し', 'next-heading'],
  ['heading forward', 'next-heading'],
  ['見出しを戻して', 'prev-heading'],
  ['back a heading', 'prev-heading'],
  ['見出しリスト', 'toc'],
  ['見出しを一覧して', 'toc'],
  ['どんな見出しがある', 'toc'],
  ['見出し何個', 'heading-count'],
  // caret nav — navigate/back misroute fixes
  ['段落を進めて', 'next-paragraph'],
  ['paragraph forward', 'next-paragraph'],
  ['文を進めて', 'next-sentence'],
  ['文字を進めて', 'next-char'],
  ['word forward', 'next-word'],
  ['word back', 'prev-word'],
  // copy / share / translate / paste / shot / devtools
  ['urlコピーして', 'copy-url'],
  ['このページのアドレスコピー', 'copy-url'],
  ['copy this link', 'copy-url'],
  ['選択をコピー', 'copy-selection'],
  ['whats on my clipboard', 'read-clipboard'],
  ['send this page', 'share-page'],
  ['貼り付けて移動', 'paste-go'],
  ['スクリーンショットして', 'screenshot'],
  ['cap the screen', 'screenshot'],
  ['インスペクタ開いて', 'devtools'],
  ['コンソール開いて', 'devtools'],
  // private tabs
  ['プライベートタブ開いて', 'private-new-tab'],
  ['private tab please', 'private-new-tab'],
  ['incognito tab please', 'private-new-tab'],
  ['シークレットウィンドウ', 'private-new-tab'],
  ['プライベートタブ全部閉じて', 'close-private-tabs'],
  ['close the private tabs', 'close-private-tabs'],
  // bulk closes — tab-by-name misroute fixes
  ['右側のタブ全部閉じて', 'close-tabs-right'],
  ['close the tabs to the right', 'close-tabs-right'],
  ['これより右のタブ閉じて', 'close-tabs-right'],
  ['これ以降のタブ閉じて', 'close-tabs-right'],
  ['左側のタブ全部閉じて', 'close-tabs-left'],
  ['重複タブ閉じて', 'close-duplicate-tabs'],
  ['同じタブは閉じて', 'close-duplicate-tabs'],
  ['ピン留めしてないの閉じて', 'close-unpinned-tabs'],
  ['普通のタブだけ閉じて', 'close-normal-tabs'],
  // session
  ['セッション復元して', 'restore-session'],
  ['save my session', 'save-session'],
  ['セッション消して', 'clear-session'],
  // speech rate — numeric + ASR word numbers
  ['読み上げ速度を2倍に', 'speech-rate-set'],
  ['読む速度を1.5倍', 'speech-rate-set'],
  ['speech rate two hundred', 'speech-rate-set'],
  // sensitivity / comfort
  ['感度上げて', 'sensitivity-up'],
  ['動きに弱いので快適設定に', 'comfort-preset'],
  ['快適モードにして', 'comfort-preset'],
  // pins kept
  ['戻って', 'back'],
  ['go back', 'back'],
  ['見出しを全部読んで', 'toc'],
  ['プライベートモードにして', 'private-mode'],
];

describe('pass CCLXXX hematite atom sweep', () => {
  test.each(cases)('%s -> %s', (phrase, want) => {
    expect(key(phrase)).toBe(want);
  });
});
