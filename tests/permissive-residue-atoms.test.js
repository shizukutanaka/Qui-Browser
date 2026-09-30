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
    reopenClosedTab() { calls.push(['reopen']); },
    nextTab() { calls.push(['next']); },
    prevTab() { calls.push(['prev']); },
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

describe('JA permissive も-tails (execute)', () => {
  test.each([
    ['閉じてもいいんですけど', 'close-tab'],
    ['閉じても結構ですよ', 'close-tab'],
    ['閉じても差し支えないです', 'close-tab'],
    ['閉じても問題ないです', 'close-tab'],
    ['閉じてもいいんではないか', 'close-tab'],
    ['閉じてもいいと思うんだけどね', 'close-tab'],
    ['閉じていいんじゃないの', 'close-tab'],
    ['閉じちゃっていいかもしれない', 'close-tab'],
    ['閉じちゃっていいんじゃない', 'close-tab'],
    ['閉じちゃったほうがいいんじゃない', 'close-tab'],
    ['閉じたっていいですよ', 'close-tab'],
    ['戻ってもいいんですけど', 'back'],
    ['読んでも結構ですよ', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA volitional-report tails (execute)', () => {
  test.each([
    ['閉じようと思うのですが', 'close-tab'],
    ['閉じようと思ってる', 'close-tab'],
    ['閉じようと思ってます', 'close-tab'],
    ['閉じようと思うんだけど', 'close-tab'],
    ['閉じようと考えてる', 'close-tab'],
    ['戻ろうと思ってる', 'back'],
    ['読もうと思ってる', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA たい-report residue (execute)', () => {
  test.each([
    ['閉じたいと思っています', 'close-tab'],
    ['閉じたいと思ってる', 'close-tab'],
    ['閉じたい感じがする', 'close-tab'],
    ['閉じたい場面です', 'close-tab'],
    ['戻りたいと思っています', 'back'],
    ['読みたいと思っています', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA てみる residue (execute)', () => {
  test.each([
    ['閉じてみようかな', 'close-tab'],
    ['閉じてみようではないか', 'close-tab'],
    ['閉じてみたらどうかな', 'close-tab'],
    ['閉じてみてほしい', 'close-tab'],
    ['閉じてちょっと', 'close-tab'],
    ['閉じてるべき', 'close-tab'],
    ['戻ってみようかな', 'back'],
    ['読んでみてほしい', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA とく residue (execute)', () => {
  test.each([
    ['閉じとくべき', 'close-tab'],
    ['閉じとこうぜ', 'close-tab'],
    ['閉じとくか', 'close-tab'],
    ['閉じとこうか', 'close-tab'],
    ['読んどこうか', 'read-aloud'],
    ['戻っとこうぜ', 'back'],
  ])('%s → %s', KEY);
});

describe('EN permissive/hedge prefixes (execute)', () => {
  test.each([
    ['i guess you could close it', 'close-tab'],
    ['i suppose you could close it', 'close-tab'],
    ['i could use you to close it', 'close-tab'],
    ['i guess you can go back', 'back'],
    ['i suppose you could read it', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('EN gratitude tails (execute)', () => {
  test.each([
    ['close it please and thanks', 'close-tab'],
    ['close it thanks a bunch', 'close-tab'],
    ['close it much obliged', 'close-tab'],
    ['go back thanks a bunch', 'back'],
  ])('%s → %s', KEY);
});
