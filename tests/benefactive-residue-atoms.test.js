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

describe('JA benefactive residue tails (execute)', () => {
  test.each([
    ['閉じてくれるんだけど', 'close-tab'],
    ['閉じてくれるんだよね', 'close-tab'],
    ['閉じてくれたっていい', 'close-tab'],
    ['閉じてもらうんだ', 'close-tab'],
    ['閉じてもらうんだけど', 'close-tab'],
    ['閉じてもらうことになって', 'close-tab'],
    ['閉じてやるから', 'close-tab'],
    ['閉じてあげるから', 'close-tab'],
    ['閉じてくださったなら', 'close-tab'],
    ['閉じてくれさえすればいい', 'close-tab'],
    ['閉じてくれりゃいい', 'close-tab'],
    ['閉じてくれたなら', 'close-tab'],
    ['閉じてくれればいいのに', 'close-tab'],
    ['戻ってくれるんだけど', 'back'],
    ['読んでくれりゃいい', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('JA dict-form suggestion residue (execute)', () => {
  test.each([
    ['閉じるといいですよ', 'close-tab'],
    ['閉じるがよかろう', 'close-tab'],
    ['閉じるんじゃないかな', 'close-tab'],
    ['閉じることもできるし', 'close-tab'],
    ['閉じるということもある', 'close-tab'],
    ['閉じるのも悪くない', 'close-tab'],
    ['閉じるのでいいんじゃない', 'close-tab'],
    ['閉じる以外ない', 'close-tab'],
    ['閉じるのほかない', 'close-tab'],
    ['閉じるのが一番だ', 'close-tab'],
    ['閉じるといいかもね', 'close-tab'],
    ['閉じるのが早い', 'close-tab'],
    ['閉じるに越したことはない', 'close-tab'],
    ['閉じるべきだろうね', 'close-tab'],
    ['閉じるでいいのかな', 'close-tab'],
    ['閉じるのでいいですか', 'close-tab'],
    ['閉じちゃうのも手だ', 'close-tab'],
    ['閉じちゃうしかないか', 'close-tab'],
    ['閉じちゃったほうが早い', 'close-tab'],
    ['戻るのが一番だ', 'back'],
    ['読むのが早い', 'read-aloud'],
  ])('%s → %s', KEY);
});

describe('EN hedged-report frames (execute)', () => {
  test.each([
    ['i was thinking you could close it', 'close-tab'],
    ['i figured you could close it', 'close-tab'],
    ['i reckoned you could close it', 'close-tab'],
    ['imagine you closed it', 'close-tab'],
    ['pretend you closed it', 'close-tab'],
    ['close it kind sir', 'close-tab'],
    ['close it would you be so kind', 'close-tab'],
    ['close it at your earliest', 'close-tab'],
    ['go back i figured you could', 'back'],
  ])('%s → %s', KEY);
});

describe('JA literal/tab-set residue', () => {
  test.each([
    ['あと少し大きく', 'volume-up'],
    ['音量もう少し上げて', 'volume-up'],
    ['もうちょい読んで', 'read-aloud'],
    ['ゆっくり読み直して', 'read-aloud'],
    ['画面を元に戻して', 'reader-scale-reset'],
    ['全てのタブを畳んで', 'close-all-tabs'],
    ['このタブ残して', 'close-other-tabs'],
    ['このタブ以外閉じて', 'close-other-tabs'],
    ['残りは閉じて', 'close-other-tabs'],
    ['残り全部閉じて', 'close-other-tabs'],
  ])('%s → %s', KEY);
});
