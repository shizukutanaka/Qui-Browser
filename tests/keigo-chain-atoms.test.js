// 敬語連鎖・方言・EN前置詞チェーンのフォールバック層テスト（pass XLVI）
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;
function mk() {
  const vc = new VC({ enabled: true });
  const calls = [];
  const tm = {
    tabs: [{ currentTitle: 'T', currentUrl: 'https://x', pinned: false }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    setActive(i) { calls.push(['setActive', i]); this.activeIndex = i; },
    closeTab(i) { calls.push(['closeTab', i]); return true; },
    closeAllTabs() { calls.push(['closeAllTabs']); return this.tabs.length; },
    nextTab() { calls.push(['nextTab']); },
    prevTab() { calls.push(['prevTab']); },
    togglePin(i) { calls.push(['togglePin', i]); },
    moveTabToStart(i) { calls.push(['moveTabToStart', i]); return true; },
    moveTabToEnd(i) { calls.push(['moveTabToEnd', i]); return true; }
  };
  const said = [];
  vc.speak = (t) => said.push(t);
  vc.connectBrowser({ tabManager: tm, onGoTo: () => calls.push(['goTo']) });
  return { vc, tm, calls, said };
}
function run(p) {
  const { vc, calls, said } = mk();
  vc.processCommand(p);
  return { key: vc.lastCommand ? vc.lastCommand.key : null, calls, said };
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase).key).toBe(k));

describe('敬語前置詞 + 受益尾連鎖', () => {
  KEY('恐れ入りますが閉じていただけますか', 'close-tab');
  KEY('恐縮ですが読んでいただければ幸いです', 'read-aloud');
  KEY('申し訳ありませんが戻ってください', 'back');
  KEY('恐縮ですが読んで', 'read-aloud');
  KEY('ついでにまず閉じて', 'close-tab');
  KEY('ついでに閉じて', 'close-tab');
  KEY('ついでに読んで', 'read-aloud');
  KEY('まず閉じて', 'close-tab');
  KEY('まず戻って', 'back');
  KEY('まず読んで', 'read-aloud');
  KEY('読んでいただきたい', 'read-aloud');
  KEY('閉じていただきたい', 'close-tab');
  KEY('読んでほしいんです', 'read-aloud');
  KEY('読んでくださいませ', 'read-aloud');
  KEY('閉じてくださいませんか', 'close-tab');
  KEY('読んでくだされ', 'read-aloud');
  KEY('戻ってくだされ', 'back');
  KEY('閉じてくれると嬉しい', 'close-tab');
  KEY('閉じてくれると助かります', 'close-tab');
  KEY('戻ってくれるとありがたい', 'back');
});
describe('方言・書記語層', () => {
  KEY('読みよる', 'speaking-status');
  KEY('閉じよる', 'describe-tab');
  KEY('読むだけ', 'read-aloud');
  KEY('閉じるだけ', 'close-tab');
  KEY('読むべし', 'read-aloud');
  KEY('閉じるべし', 'close-tab');
  KEY('戻るべし', 'back');
  KEY('開けっぱなし', 'describe-tab');
  KEY('鳴りっぱなし', 'tab-audio');
  KEY('動きっぱなし', 'working-status');
  KEY('ご覧ください', 'describe-tab');
  KEY('ご覧くださいませ', 'describe-tab');
});
describe('EN 前置詞チェーン', () => {
  KEY('i was wondering if you could close it', 'close-tab');
  KEY('do you think you could close it', 'close-tab');
  KEY('any chance you could go back', 'back');
  KEY('would you be so kind and close it', 'close-tab');
  KEY('if you wouldnt mind closing this', 'close-tab');
  KEY('how about we go back', 'back');
  KEY('why dont we go back', 'back');
  KEY('shall we go back', 'back');
  KEY('lets go back', 'back');
  KEY('you have to stop', 'stop-reading');
  KEY('you gotta go back', 'back');
  KEY('you got to go back', 'back');
  KEY('you need to close it', 'close-tab');
  KEY('you should close it', 'close-tab');
  KEY('and then close it', 'close-tab');
  KEY('then go back', 'back');
  KEY('and close it', 'close-tab');
  KEY('be so kind as to close it', 'close-tab');
  KEY('kindly close it', 'close-tab');
});
describe('EN 相槌・無線相槌', () => {
  KEY('roger that', 'ack');
  KEY('copy that', 'ack');
  KEY('aye aye', 'ack');
  KEY('ten four', 'ack');
  KEY('wilco', 'ack');
  KEY('yessir', 'ack');
  KEY('okie dokie', 'ack');
  KEY('rightio', 'ack');
  KEY('noted', 'ack');
  KEY('gotcha', 'ack');
  KEY('sounds good', 'ack');
  KEY('fair enough', 'ack');
  KEY('on it', 'ack');
  KEY('i appreciate it', 'ack');
});
describe('EN 強否定', () => {
  KEY('nopers', 'negate');
  KEY('nope nope', 'negate');
  KEY('absolutely not', 'negate');
  KEY('not interested', 'negate');
  KEY('negative', 'negate');
  KEY('hell no', 'negate');
  KEY('no siree', 'negate');
  KEY('not a chance', 'negate');
});
describe('ヘルプ・不満・表示句', () => {
  KEY('what can i say', 'help');
  KEY('what are my options', 'help');
  KEY('show commands', 'help');
  KEY('all commands', 'help');
  KEY('commands', 'help');
  KEY('quick question', 'help');
  KEY('quick favor', 'help');
  KEY('do me a favor', 'help');
  KEY('be a doll', 'help');
  KEY('work your magic', 'help');
  KEY('just do it', 'help');
  KEY('できること教えて', 'help');
  KEY('何が言える', 'help');
  KEY('なにができる', 'help');
  KEY('コマンド教えて', 'help');
  KEY('おかしい', 'trouble');
  KEY('なんか変', 'trouble');
  KEY('へんだ', 'trouble');
  KEY('おかしくない', 'trouble');
});
describe('ナビ・スクロール口語', () => {
  KEY('head back', 'back');
  KEY('walk it back', 'back');
  KEY('head on back', 'back');
  KEY('go on back', 'back');
  KEY('head forward', 'navigate');
  KEY('go on forward', 'navigate');
  KEY('run it back', 'repeat-command');
  KEY('one more go', 'repeat-command');
  KEY('scroll on down', 'scroll-down');
  KEY('scroll on up', 'scroll-up');
  KEY('keep on scrolling', 'scroll-down');
  KEY('keep scrolling up', 'scroll-up');
  KEY('bring it up', 'describe-tab');
  KEY('pull it up', 'describe-tab');
  KEY('queue it up', 'describe-tab');
  KEY('line it up', 'describe-tab');
});
describe('共存・誤ルート防止', () => {
  KEY('読んで', 'read-aloud');
  KEY('閉じて', 'close-tab');
  KEY('戻って', 'back');
  KEY('help', 'help');
  KEY('read this page', 'read-aloud');
  KEY('戻るな', 'negate');
  KEY('go to google', 'go-to');
  KEY('can you go back', 'back');
  KEY('please close the tab', 'close-tab');
});
