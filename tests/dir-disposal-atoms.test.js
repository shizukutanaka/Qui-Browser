import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function run(phrase) {
  const vc = new VoiceCommands({ enabled: true });
  const calls = [];
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'X', url: 'https://x' },
      { id: 't2', title: 'Y', url: 'https://y' },
      { id: 't3', title: 'Z', url: 'https://z' },
    ],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { calls.push('closeAllTabs'); return 1; },
    closeTab() { calls.push('closeTab'); },
    pinTab() { calls.push('pinTab'); },
    closeOtherTabs() { calls.push('closeOtherTabs'); },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  vc.processCommand(phrase, 0.9);
  return { key: vc.lastCommand ? vc.lastCommand.key : null };
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase).key).toBe(k));

describe('EN directional disposal (with/out/through)', () => {
  KEY('down with this tab', 'close-tab');
  KEY('away with the tab', 'close-tab');
  KEY('out with the tab', 'close-tab');
  KEY('out with it', 'close-tab');
  KEY('out with this', 'close-tab');
  KEY('through with this', 'close-tab');
  KEY('finished with this', 'close-tab');
  KEY('finished with the tab', 'close-tab');
  KEY('over and done with it', 'close-tab');
});

describe('EN wrap/pack/end-to 処分', () => {
  // 'wrap it up'/'wrap this up' は 'finish everything' で stop-everything の確立ピン
  KEY('wrap the tab up', 'close-tab');
  KEY('pack it up', 'close-tab');
  KEY('pack it away', 'close-tab');
  KEY('do it in', 'close-tab');
  KEY('do the tab in', 'close-tab');
  KEY('tear it down', 'close-tab');
  KEY('rip it down', 'close-tab');
  KEY('pull it down', 'close-tab');
  KEY('put an end to it', 'close-tab');
  KEY('put an end to this', 'close-tab');
  KEY('put it to rest', 'close-tab');
  KEY('lay it to rest', 'close-tab');
  KEY('retire it', 'close-tab');
  KEY('retire the tab', 'close-tab');
  KEY('put it out of its misery', 'close-tab');
});

describe('EN スラング前置 (Reddit register)', () => {
  KEY('bro close it', 'close-tab');
  KEY('bro close the tab', 'close-tab');
  KEY('sis close it', 'close-tab');
  KEY('fam close it', 'close-tab');
  KEY('fams close it', 'close-tab');
  KEY('dawg close it', 'close-tab');
  KEY('cuz close it', 'close-tab');
  KEY('tbh close it', 'close-tab');
  KEY('tbh just close it', 'close-tab');
  KEY('ngl close it', 'close-tab');
  KEY('ngl just close this', 'close-tab');
  KEY('lowkey close it', 'close-tab');
  KEY('highkey close it', 'close-tab');
  KEY('deadass close it', 'close-tab');
  KEY('fr close it', 'close-tab');
  KEY('fr fr close it', 'close-tab');
  KEY('ong close it', 'close-tab');
});

describe('JA 方言・依頼残置 III', () => {
  KEY('閉じてしもた', 'close-tab');
  KEY('閉じてしもうた', 'close-tab');
  KEY('閉じてしもうたわ', 'close-tab');
  KEY('閉じしもて', 'close-tab');
  KEY('閉じとこなあ', 'close-tab');
  KEY('閉じとこうな', 'close-tab');
  KEY('閉じるとか', 'close-tab');
  KEY('閉じるとかや', 'close-tab');
  KEY('閉じるってのはどう', 'close-tab');
  KEY('閉じたらええのに', 'close-tab');
  KEY('閉じた方がええ', 'close-tab');
  KEY('閉じましょうぜ', 'close-tab');
  KEY('閉じますかね', 'close-tab');
  KEY('閉じるかなあ', 'close-tab');
  KEY('閉じなよー', 'close-tab');
  KEY('閉じなよっと', 'close-tab');
  KEY('閉じやぁ', 'close-tab');
});

describe('JA dict 名詞尾 XXXII (評価・方策)', () => {
  KEY('閉じるのが最適解です', 'close-tab');
  KEY('閉じるのが好判断です', 'close-tab');
  KEY('閉じるのが良案です', 'close-tab');
  KEY('閉じるのが名案です', 'close-tab');
  KEY('閉じるのが上策です', 'close-tab');
  KEY('閉じるのが妙案です', 'close-tab');
  KEY('閉じるのが早道です', 'close-tab');
  KEY('閉じるのが近道です', 'close-tab');
  KEY('閉じるのが得策です', 'close-tab');
  KEY('閉じるのが策です', 'close-tab');
});

describe('確立ピン・意図スキップ維持', () => {
  KEY('shut it all down', 'vr-exit');
  KEY('shut this down', 'vr-exit');
  KEY('put it to sleep', 'sleep-mode');
  KEY('wrap it up', 'stop-everything');
  KEY('wrap this up', 'stop-everything');
  KEY('pack it in', 'stop-everything');
  KEY('閉じるのが正解です', 'help');
  KEY('閉じんといて', 'negate');
  KEY('sick of this tab', null);
  KEY('had enough of it', null);
  KEY('閉じるなんて', null);
  KEY('閉じるのが下策ではない', null);
});
