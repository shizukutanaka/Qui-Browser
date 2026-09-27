// -*- coding: utf-8 -*-
// Round 117 (Session 191): suggestion-residue atoms.
//  JA て受益残置IX (よろしくお願い系/おねがい/頼む/もらえないものか(negate誤ルート))
//  JA dict 提案残置 (のもあり/のもいい/のも手だ/ってのもあり/というのもあり/
//    という手もある/といいんじゃない/とよいでしょう/とよろしい/とよいです)
//  JA 義務残置 (しかないな/っきゃないな/よりほかない/ほかないだろう/ほかあるまい
//    → 実行; 現状ほかないだろう/ほかあるまいが negate 誤ルート)
//  JA ように残置 (ようにする/ようにしてください)
//  JA たら提案残置 (たらよいのではないか/たらいかがでしょう(か)/たらどうでしょうか)
//  JA ても許可残置II (もええんちゃう/もええんですか/もいいんじゃないか)
//  JA 疑問→help (べきかどうか迷って/かどうか/か迷ってる/か悩んでる/方がいいのかな/
//    のが正解かな); べきではないかと → negate
//  EN 許可・ゴーサイン (go on and/go right ahead and/by all means/
//    you're welcome to/i give you permission to/permission granted to/
//    feel welcome to/what say you/what do you say we/whaddya say we/what say we)
//  EN 能力質問→help (is it true you can/can it be closed/could it be closed/
//    is it closable/is it possible this can be closed/any idea how to)

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

describe('て受益残置IX', () => {
  KEY('閉じてよろしくお願いします', 'close-tab');
  KEY('閉じてよろしくお願い致します', 'close-tab');
  KEY('閉じておねがいします', 'close-tab');
  KEY('閉じて頼みます', 'close-tab');
  KEY('閉じて頼む', 'close-tab');
  KEY('閉じてもらえないものか', 'close-tab'); // 依頼 — negate 誤ルートから実行へ
  KEY('戻ってよろしくお願いします', 'back');
  KEY('読んでおねがいします', 'read-aloud');
  KEY('戻って頼む', 'back');
  KEY('読んでもらえないものか', 'read-aloud');
});

describe('dict 提案残置', () => {
  KEY('閉じるのもあり', 'close-tab');
  KEY('閉じるのもいい', 'close-tab');
  KEY('閉じるのも手だ', 'close-tab');
  KEY('閉じるってのもあり', 'close-tab');
  KEY('閉じるというのもあり', 'close-tab');
  KEY('閉じるという手もある', 'close-tab');
  KEY('閉じるといいんじゃない', 'close-tab');
  KEY('閉じるといいんじゃないか', 'close-tab');
  KEY('閉じるとよいでしょう', 'close-tab');
  KEY('閉じるとよろしい', 'close-tab');
  KEY('閉じるとよいです', 'close-tab');
  KEY('戻るのもあり', 'back');
  KEY('読むとよいでしょう', 'read-aloud');
  KEY('戻るという手もある', 'back');
});

describe('義務残置（しかない/ほかない→実行）', () => {
  KEY('閉じるしかないな', 'close-tab');
  KEY('閉じるっきゃないな', 'close-tab');
  KEY('閉じるよりほかない', 'close-tab');
  KEY('閉じるよりほかないな', 'close-tab');
  KEY('閉じるほかないだろう', 'close-tab');   // obligation — negate 誤ルートから実行へ
  KEY('閉じるほかあるまい', 'close-tab');    // あるまい = ないだろう — negate 誤ルートから実行へ
  KEY('戻るしかないな', 'back');
  KEY('読むほかないだろう', 'read-aloud');
});

describe('ように・たら提案残置', () => {
  KEY('閉じるようにする', 'close-tab');
  KEY('閉じるようにしてください', 'close-tab');
  KEY('戻るようにする', 'back');
  KEY('読むようにしてください', 'read-aloud');
  KEY('閉じたらよいのではないか', 'close-tab');
  KEY('閉じたらいかがでしょうか', 'close-tab');
  KEY('閉じたらいかがでしょう', 'close-tab');
  KEY('閉じたらどうでしょうか', 'close-tab');
  KEY('戻ったらいかがでしょうか', 'back');
  KEY('読んだらどうでしょうか', 'read-aloud');
});

describe('ても許可残置II', () => {
  KEY('閉じてもええんちゃう', 'close-tab');
  KEY('閉じてもええんですか', 'close-tab');
  KEY('閉じてもいいんじゃないか', 'close-tab');
  KEY('戻ってもええんですか', 'back');
  KEY('読んでもいいんじゃないか', 'read-aloud');
});

describe('疑問→help・べき否定維持', () => {
  KEY('閉じるべきかどうか迷って', 'help');
  KEY('閉じるかどうか', 'help');
  KEY('閉じるかどうか迷ってる', 'help');
  KEY('閉じるか迷ってる', 'help');
  KEY('閉じるかどうか考えてる', 'help');
  KEY('閉じるか悩んでる', 'help');
  KEY('閉じた方がいいのかな', 'help');
  KEY('閉じるのが正解かな', 'help');
  KEY('閉じるべきではないかと', 'negate');  // べきではないか と = shouldn't I — refusal deliberation
  KEY('戻るかどうか迷ってる', 'help');
});

describe('EN permission / go-ahead frames', () => {
  KEY('go on and close it', 'close-tab');
  KEY('go right ahead and close it', 'close-tab');
  KEY('by all means close it', 'close-tab');
  KEY('youre welcome to close it', 'close-tab');
  KEY("you're welcome to close it", 'close-tab');
  KEY('you are welcome to close it', 'close-tab');
  KEY('i give you permission to close it', 'close-tab');
  KEY('permission granted to close it', 'close-tab');
  KEY('feel welcome to close it', 'close-tab');
  KEY('what say you close it', 'close-tab');
  KEY('what do you say we close it', 'close-tab');
  KEY('whaddya say we close it', 'close-tab');
  KEY('what say we close it', 'close-tab');
  KEY('go on and go back', 'back');
  KEY("you're welcome to read it", 'read-aloud');
});

describe('EN capability questions → help', () => {
  KEY('is it true you can close it', 'help');
  KEY('can it be closed', 'help');
  KEY('could it be closed', 'help');
  KEY('is it closable', 'help');
  KEY('is it possible this can be closed', 'help');
  KEY('any idea how to close it', 'help');
  KEY('can it be undone', 'help');
  KEY('could it be reopened', 'help');
});

describe('R117 回帰不変条件', () => {
  KEY('first tab', 'first-tab');
  KEY('it reopened', 'reopen-tab');
  KEY('i want my money back', null);
  KEY('閉じるもんか', 'negate');
  KEY('閉じるべきかな', 'help');
  KEY('閉じるべきではないか', 'negate');
  KEY('is it possible to close it', 'help');
  KEY('あとで閉じて', 'defer');
  KEY('元に戻して', 'reopen-tab');
  KEY('あとどのくらい', 'remaining-time');
  KEY('閉じて', 'close-tab');
  KEY('閉じるまい', 'negate');
  KEY('閉じてくださいまいか', 'close-tab');
});
