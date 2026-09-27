'use strict';

const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const calls = [];
  const said = [];
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Ex' }],
    getActiveTab() { return this.tabs[0]; },
    closeTab(...a) { calls.push(['closeTab', ...a]); },
    closeAllTabs() { calls.push(['closeAllTabs']); return 1; },
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = (s) => said.push(s);
  return { vc, tm, calls, said };
}
function run(m, phrase) {
  m.vc.lastCommand = null;
  m.vc.processCommand(phrase, 0.9);
  return { key: m.vc.lastCommand ? m.vc.lastCommand.key : null, calls: m.calls, said: m.said };
}
const KEY = (phrase, k) => expect(run(mk(), phrase).key).toBe(k);

describe('JA benefactive tail residue XV (execute)', () => {
  test.each([
    ['閉じてくれますの', 'close-tab'],
    ['閉じてくださいな', 'close-tab'],
    ['閉じてくださるかな', 'close-tab'],
    ['閉じてほしいんだよね', 'close-tab'],
    ['閉じてほしいのよ', 'close-tab'],
    ['閉じてもらいたいんだ', 'close-tab'],
    ['閉じてもらえると助かる', 'close-tab'],
    ['閉じてもらいたいところ', 'close-tab'],
    ['閉じてほしいところです', 'close-tab'],
    ['閉じてもらえるとありがたい', 'close-tab'],
    ['閉じてくれてもいいんです', 'close-tab'],
    ['閉じてくれてもかまいません', 'close-tab'],
    ['閉じてもらっちゃおう', 'close-tab'],
    ['閉じてもらうつもり', 'close-tab'],
    ['閉じてもらう予定', 'close-tab'],
    ['閉じておきたいところ', 'close-tab'],
    ['閉じておくことにする', 'close-tab'],
    ['閉じておきましょうかね', 'close-tab'],
    ['戻ってくれますの', 'back'],
    ['読んでほしいのよ', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA dict suggestion/planning residue VII (execute)', () => {
  test.each([
    ['閉じるのもいいんじゃない', 'close-tab'],
    ['閉じることにしておく', 'close-tab'],
    ['閉じることにしておこう', 'close-tab'],
    ['閉じるのが無難だ', 'close-tab'],
    ['閉じるのが定石だ', 'close-tab'],
    ['閉じるのが賢明だろう', 'close-tab'],
    ['閉じるほうが無難', 'close-tab'],
    ['閉じるのが常套手段だ', 'close-tab'],
    ['閉じるという選択もある', 'close-tab'],
    ['閉じるという手がありますね', 'close-tab'],
    ['閉じるのも検討事項だ', 'close-tab'],
    ['閉じることも視野に入れて', 'close-tab'],
    ['閉じるのがセオリーだ', 'close-tab'],
    ['閉じるのが筋だと思う', 'close-tab'],
    ['閉じるのが本筋だ', 'close-tab'],
    ['閉じるようにしてくださいね', 'close-tab'],
    ['閉じるようにお願いね', 'close-tab'],
    ['閉じるとしておく', 'close-tab'],
    ['閉じることとする', 'close-tab'],
    ['閉じるでよろしいか', 'close-tab'],
    ['閉じる方向でいこう', 'close-tab'],
    ['閉じる系で', 'close-tab'],
    ['閉じる感じでいこう', 'close-tab'],
    ['閉じる案で', 'close-tab'],
    ['閉じるプランで', 'close-tab'],
    ['閉じる作戦で', 'close-tab'],
    ['戻る方向でいこう', 'back'],
    ['読む案で', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA ちゃ/とく residue (execute)', () => {
  test.each([
    ['閉じちゃうのもありか', 'close-tab'],
    ['閉じちゃう方向で', 'close-tab'],
    ['閉じちゃうべきかも', 'close-tab'],
    ['閉じちゃうのが正解', 'close-tab'],
    ['閉じちゃえば済む話', 'close-tab'],
    ['閉じちゃえばいい話', 'close-tab'],
    ['閉じちゃって結構です', 'close-tab'],
    ['閉じちゃってよろしい', 'close-tab'],
    ['読んじゃう方向で', 'read-aloud'],
    ['戻っちゃえばいい話', 'back'],
    ['閉じとくのがいい', 'close-tab'],
    ['閉じときなさいよ', 'close-tab'],
    ['閉じとけばいい', 'close-tab'],
    ['閉じといてほしいんだ', 'close-tab'],
    ['閉じといてもらいたい', 'close-tab'],
    ['閉じといてもらえると', 'close-tab'],
    ['閉じとこうかなと思って', 'close-tab'],
    ['閉じとくつもり', 'close-tab'],
  ])('%s → %s', KEY);
});

describe('EN hedged-report residue (execute)', () => {
  test.each([
    ['i was hoping you could close it', 'close-tab'],
    ['i was kinda hoping you could close it', 'close-tab'],
    ['i figured maybe you could close it', 'close-tab'],
    ['i thought maybe you could close it', 'close-tab'],
    ['i was thinking maybe close it', 'close-tab'],
    ['close it i was thinking', 'close-tab'],
    ['close it i was hoping', 'close-tab'],
    ['close it i was wondering', 'close-tab'],
    ['close it i thought', 'close-tab'],
    ['close it i guess', 'close-tab'],
    ['i had hoped you could close it', 'close-tab'],
    ['i would have thought you could close it', 'close-tab'],
    ['i expected you to close it', 'close-tab'],
    ['i assumed you would close it', 'close-tab'],
    ['supposedly you can close it', 'close-tab'],
    ['apparently you can close it', 'close-tab'],
    ['presumably you can close it', 'close-tab'],
    ['obviously you can close it', 'close-tab'],
    ['go back i was hoping', 'back'],
  ])('%s → %s', KEY);
});

describe('EN courtesy/honor frames (execute)', () => {
  test.each([
    ['do the honors and close it', 'close-tab'],
    ['do the honours and close it', 'close-tab'],
    ['have the courtesy to close it', 'close-tab'],
    ['have the decency to close it', 'close-tab'],
    ['extend me the courtesy of closing it', 'close-tab'],
    ['extend the courtesy of closing it', 'close-tab'],
    ['grant me the favor of closing it', 'close-tab'],
    ['afford me the favor of closing it', 'close-tab'],
    ['oblige me by closing it', 'close-tab'],
    ['humor me and close it', 'close-tab'],
  ])('%s → %s', KEY);
});

describe('EN gerund/passive residue (execute)', () => {
  test.each([
    ['closing it would be great', 'close-tab'],
    ['closing it would help', 'close-tab'],
    ['closing it is the idea', 'close-tab'],
    ['having it closed would help', 'close-tab'],
    ['getting it closed would be nice', 'close-tab'],
    ['it closing would help', 'close-tab'],
    ['the tab closing would be ideal', 'close-tab'],
    ['i need it closed', 'close-tab'],
    ['i need this closed', 'close-tab'],
    ['i want that closed', 'close-tab'],
  ])('%s → %s', KEY);
});

describe('JA literal residue (progress/describe)', () => {
  test.each([
    ['まだ読んでる途中', 'reader-progress'],
    ['読み途中', 'reader-progress'],
    ['途中まで読んだ', 'reader-progress'],
    ['ここ読んでる', 'reader-progress'],
    ['今読んでるとこ', 'reader-progress'],
    ['読んでる途中', 'reader-progress'],
    ['読みかけ', 'resume-reading'],
    ['このページ見せて', 'describe-tab'],
    ['このページ見て', 'describe-tab'],
    ['ページの内容教えて', 'describe-tab'],
    ['閉じる寸前', 'describe-tab'],
    ['閉じるところです', 'describe-tab'],
  ])('%s → %s', KEY);
});
