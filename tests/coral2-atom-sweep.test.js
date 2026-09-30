/**
 * pass CCLXXXI — seventh cross-command sweep: download/print/copy-title/
 * notify/spell/reload-all/close-other, reader-mode/dark-mode/keyboard/
 * security/language/scroll-horizontal/jump-back fills + status queries.
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
  // download / print / copy-title
  ['ページをダウンロード', 'download'],
  ['ページ保存して', 'download'],
  ['保存してダウンロード', 'download'],
  ['このファイルをダウンロード', 'download'],
  ['pdfにして', 'print'],
  ['プリンターに送って', 'print'],
  ['タイトルコピー', 'copy-title'],
  ['コピータイトル', 'copy-title'],
  ['名前をコピー', 'copy-title'],
  ['ページのタイトルをコピー', 'copy-title'],
  // translate / read-url / tab-meta / tab-audio
  ['日本語に翻訳して', 'translate-page'],
  ['アドレス教えて', 'read-url'],
  ['アドレスバー見せて', 'read-url'],
  ['show me the address', 'read-url'],
  ['このタブの情報', 'tab-meta'],
  ['タブの詳細', 'tab-meta'],
  ['音が出てるのはどれ', 'tab-audio'],
  // notifications
  ['通知消して', 'dismiss-notify'],
  ['通知読んで', 'read-notify'],
  ['通知を教えて', 'read-notify'],
  // reading helpers
  ['一行読んで', 'read-line'],
  ['スペル教えて', 'spell-word'],
  ['spell that word', 'spell-word'],
  ['この単語をスペルして', 'spell-word'],
  ['この見出し読んで', 'read-heading'],
  ['記事を要約して', 'article-summary'],
  ['この記事の要約', 'article-summary'],
  ['文字数教えて', 'char-count'],
  // tab bulk ops
  ['全部リロード', 'reload-all'],
  ['全タブ更新', 'reload-all'],
  ['すべて更新して', 'reload-all'],
  ['他のは閉じていいよ', 'close-other-tabs'],
  ['残りは全部閉じて', 'close-other-tabs'],
  // reading / vr / settings
  ['読み上げストップ', 'stop-reading'],
  ['読むの止めてくれ', 'stop-reading'],
  ['ヘッドセット切って', 'vr-exit'],
  ['vr終わる', 'vr-exit'],
  ['ウェイクワード変えて', 'wake-word-status'],
  ['感度今どのくらい', 'sensitivity-status'],
  ['感度どのくらい', 'sensitivity-status'],
  ['コントラスト今', 'contrast-status'],
  // display modes
  ['リーダーにして', 'reader-mode'],
  ['リーダーモードで', 'reader-mode'],
  ['読書モードにして', 'reader-mode'],
  ['暗いテーマにして', 'dark-mode'],
  ['リセットズーム', 'reader-scale-reset'],
  ['もっと拡大', 'reader-size-up'],
  ['画面を拡大', 'reader-size-up'],
  ['もっと縮小', 'reader-size-down'],
  // voice / security / keyboard
  ['声変えて', 'select-voice'],
  ['音声一覧', 'voice-list'],
  ['このサイト安全', 'security-status'],
  ['安全かどうか教えて', 'security-status'],
  ['is this site safe', 'security-status'],
  ['httpsか確認', 'security-status'],
  ['キーボード出して', 'keyboard'],
  ['キーボード見せて', 'keyboard'],
  ['キーボードを開いて', 'keyboard'],
  // language / horizontal scroll / jump-back
  ['switch language', 'language-switch'],
  ['言語変えて', 'language-switch'],
  ['英語モードにして', 'language-switch'],
  ['右にスクロールして', 'scroll-horizontal'],
  ['左にスクロールして', 'scroll-horizontal'],
  ['scroll sideways', 'scroll-horizontal'],
  ['前の位置に戻って', 'jump-back'],
  ['読んでたとこに戻って', 'jump-back'],
  // honest-null pins (no surface exists)
  ['この段落何文字', null],
  ['縦書きにして', null],
  ['読めるようにして', null],
];

describe('pass CCLXXXI atom sweep', () => {
  test.each(cases)('%s -> %s', (phrase, expected) => {
    expect(key(phrase)).toBe(expected);
  });
});
