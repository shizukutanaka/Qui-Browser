// Gratitude/certainty-frame & residual-desire atoms: JA humble benefactive deep cuts,
// dict certainty/appreciation tails, たい-mood residue, EN consider/amenable frames,
// honest-absence device literals.
// Written for round 119 — every case below was verified failing on the pre-change tree.
'use strict';

const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const calls = [];
  const said = [];
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example Domain', private: false }],
    getActiveTab() { return { id: 't1', title: 'Example Domain', private: false }; },
    closeTab(...a) { calls.push(['closeTab', ...a]); },
    setActive(...a) { calls.push(['setActive', ...a]); },
    goBack() { calls.push(['goBack']); },
    goForward() { calls.push(['goForward']); },
    reload() { calls.push(['reload']); },
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.onSpeak = (t) => said.push(t);
  return { vc, tm, calls, said };
}

function run(mk, p) {
  mk.vc.lastCommand = null;
  mk.calls.length = 0;
  mk.vc.processCommand(p, 0.9);
  return { key: mk.vc.lastCommand ? mk.vc.lastCommand.key : null, calls: mk.calls };
}

const KEY = (phrase, key) => test(phrase, () => {
  const m = mk();
  expect(run(m, phrase).key).toBe(key);
});

describe('te-benefactive residue XI: お願い内蔵/感謝先行 tails execute', () => {
  KEY('閉じてお願いね', 'close-tab');
  KEY('閉じてお願いできるかな', 'close-tab');
  KEY('閉じてお願いしてもいいかな', 'close-tab');
  KEY('閉じてお願いしてもらえますか', 'close-tab');
  KEY('閉じてお願いしたいのですが', 'close-tab');
  KEY('閉じてお願いしたく存じます', 'close-tab');
  KEY('閉じてお願い申し上げたく', 'close-tab');
  KEY('閉じてもらえたなら', 'close-tab');
  KEY('閉じてくれたら助かる', 'close-tab');
  KEY('閉じてくれないですかね', 'close-tab');
  KEY('閉じてくれないかなあ', 'close-tab');
  KEY('閉じてくれると助かるわ', 'close-tab');
  KEY('閉じてくれたらいいのに', 'close-tab');
  KEY('閉じてくれさえすれば', 'close-tab');
  KEY('閉じてもらいたいんですが', 'close-tab');
  KEY('閉じてもらいたいのですが', 'close-tab');
  KEY('閉じてもらうのは無理ですか', 'close-tab');
  KEY('閉じてあればいい', 'close-tab');
  KEY('閉じた状態にして', 'close-tab');
  KEY('閉じた状態でいて', 'close-tab');
  KEY('閉じていただけると大変ありがたいです', 'close-tab');
  KEY('閉じていただけるとありがたく存じます', 'close-tab');
  KEY('閉じていただければ幸いでございます', 'close-tab');
  KEY('閉じていただけますようお願い申し上げます', 'close-tab');
});

describe('dict gratitude/certainty residue III: execute', () => {
  KEY('閉じるとありがたいです', 'close-tab');
  KEY('閉じると助かります', 'close-tab');
  KEY('閉じればありがたい', 'close-tab');
  KEY('閉じれば幸いです', 'close-tab');
  KEY('閉じれば助かる', 'close-tab');
  KEY('閉じるならありがたい', 'close-tab');
  KEY('閉じることは可能でしょうか', 'close-tab');
  KEY('閉じることが可能ですか', 'close-tab');
  KEY('閉じることが望ましいかと', 'close-tab');
  KEY('閉じるという選択肢もあります', 'close-tab');
  KEY('閉じるという手があります', 'close-tab');
  KEY('閉じる必要あるかな', 'close-tab');
  KEY('閉じる必要ありそう', 'close-tab');
});

describe('たい-mood residue: desire + coda execute', () => {
  KEY('閉じたいんですがね', 'close-tab');
  KEY('閉じたいんですけども', 'close-tab');
  KEY('閉じたいなあ', 'close-tab');
  KEY('閉じたい気がする', 'close-tab');
  KEY('閉じたいと思ってるんです', 'close-tab');
  KEY('閉じたい気分です', 'close-tab');
  KEY('閉じたい時は', 'close-tab');
  KEY('閉じたい場合は', 'close-tab');
  KEY('閉じた方がいい気がする', 'close-tab');
  KEY('閉じたほうがよさそう', 'close-tab');
  KEY('閉じた方がいいと思うんです', 'close-tab');
  KEY('閉じたほうが良いと思う', 'close-tab');
});

describe('EN considerate/capability frames II execute', () => {
  KEY('would you consider closing it', 'close-tab');
  KEY('would you be amenable to closing it', 'close-tab');
  KEY('would you be so good to close it', 'close-tab');
  KEY('might i ask that you close it', 'close-tab');
  KEY('may i ask that you close it', 'close-tab');
  KEY('can i trouble you to close it', 'close-tab');
  KEY('could i trouble you to close it', 'close-tab');
  KEY('may i trouble you to close it', 'close-tab');
  KEY('i was wondering whether you could close it', 'close-tab');
  KEY('i was wondering if you could possibly close it', 'close-tab');
  KEY('is it within your power to close it', 'close-tab');
  KEY('how would you feel about closing it', 'close-tab');
  KEY('what do you think about closing it', 'close-tab');
  KEY('do you think you might close it', 'close-tab');
});

describe('honest-absence & literal fills', () => {
  KEY('開発者モードにして', 'devtools');
  KEY('キャッシュクリアして', 'privacy-clean');
  KEY('全画面表示にして', 'vr-enter');
  KEY('画面を最大化して', 'window-state');
  KEY('拡張機能を管理して', 'device-apps');
  KEY('ピクチャーインピクチャーにして', 'device-apps');
  KEY('アップデートして', 'device-apps');
  KEY('this tab sucks', 'trouble');
});

describe('invariants: prior surfaces unchanged', () => {
  KEY('閉じるまい', 'negate');
  KEY('戻るべきですかね', 'help');
  KEY('閉じてくれるかどうか', 'close-tab');
  KEY('プライベートかどうか', 'privacy-status');
  KEY('why wont you close it', 'trouble');
  KEY('閉じてくださいまいか', 'close-tab');
  KEY('i was hoping youd close it', 'close-tab');
  KEY('do you want me to close it', 'close-tab');
});
