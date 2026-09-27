// Decision-report & desire-declaration atoms: JA intent/decision/plan tails (と決めた,
// つもりですが, 予定なんです, はずなんです), てみせる/てみましょうか volitionals,
// unneeded-declaration negates, complaint→trouble frames, EN passive-need frames.
// Written for round 120 — every case below was verified failing on the pre-change tree.
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
  mk.calls.length = 0;
  mk.vc.lastCommand = null;
  mk.vc.processCommand(p, 0.9);
  return { key: mk.vc.lastCommand ? mk.vc.lastCommand.key : null, calls: mk.calls };
}

const KEY = (phrase, key) => test(phrase, () => {
  const m = mk();
  expect(run(m, phrase).key).toBe(key);
});

describe('decision-report tails: dict+決めた/つもり/予定/はず execute', () => {
  KEY('閉じると決めた', 'close-tab');
  KEY('閉じることに決めた', 'close-tab');
  KEY('閉じることを決めた', 'close-tab');
  KEY('閉じるつもりですが', 'close-tab');
  KEY('閉じるつもりなんです', 'close-tab');
  KEY('閉じる予定なんです', 'close-tab');
  KEY('閉じる予定です', 'close-tab');
  KEY('閉じるはずなんです', 'close-tab');
  KEY('閉じるはずです', 'close-tab');
  KEY('閉じるようにしました', 'close-tab');
  KEY('閉じると思うんだけど', 'close-tab');
  KEY('閉じると思いますので', 'close-tab');
  KEY('戻ると決めた', 'back');
  KEY('読むつもりですが', 'read-aloud');
  KEY('戻る予定です', 'back');
});

describe('judgment-suggestion residue: べきかと思います/賢明かと execute', () => {
  KEY('閉じるべきかと思います', 'help');
  KEY('閉じるべきではないかしら', 'negate');
  KEY('閉じるのが賢明かと', 'close-tab');
  KEY('閉じたほうがいいのでは', 'close-tab');
  KEY('閉じることもできる', 'close-tab');
  KEY('閉じるのもいいですね', 'close-tab');
  KEY('閉じたらどうかと思う', 'close-tab');
  KEY('閉じたらいいと思います', 'close-tab');
  KEY('閉じたほうがいいと思うのですが', 'close-tab');
});

describe('te-benefactive residue XII + volitional みせる/みましょうか', () => {
  KEY('閉じてもらいたく存じます', 'close-tab');
  KEY('閉じてくれたならば', 'close-tab');
  KEY('閉じておくれる', 'close-tab');
  KEY('閉じてやってもらえる', 'close-tab');
  KEY('閉じてもらいますので', 'close-tab');
  KEY('閉じてくださいませんかね', 'close-tab');
  KEY('閉じてくださいましな', 'close-tab');
  KEY('閉じてくださいませますか', 'close-tab');
  KEY('閉じてもいいですかね', 'close-tab');
  KEY('閉じてみせる', 'close-tab');
  KEY('閉じてみましょうか', 'close-tab');
  KEY('読んでみましょうか', 'read-aloud');
  KEY('戻ってみせる', 'back');
});

describe('unneeded-declaration negates: ほしくない/ずにおいて/ままにして', () => {
  KEY('閉じてほしくないの', 'negate');
  KEY('閉じてほしくないです', 'negate');
  KEY('閉じずにおいて', 'negate');
  KEY('閉じないままにして', 'negate');
  KEY('閉じないままでいて', 'negate');
  KEY('戻らないでほしい', 'negate');
  KEY('閉じるつもりはありません', 'negate');
});

describe('complaint frames → trouble', () => {
  KEY('閉じたと思ったのに', 'trouble');
  KEY('閉じてもまだ閉じない', 'trouble');
  KEY('閉じるどころか', 'trouble');
  KEY('閉じてばっかり', 'trouble');
  KEY('閉じたはずがまだ開いてる', 'trouble');
});

describe('noun-action requests → close-tab', () => {
  KEY('タブの閉鎖を願います', 'close-tab');
  KEY('廃棄してください', 'close-tab');
  KEY('閉じる操作をして', 'close-tab');
  KEY('閉じるアクションを', 'close-tab');
  KEY('閉じる手続きを', 'close-tab');
});

describe('EN considerate/passive-need frames', () => {
  KEY('could you be so kind to close it', 'close-tab');
  KEY('close it at your discretion', 'close-tab');
  KEY('may i suggest you close it', 'close-tab');
  KEY('might i suggest closing it', 'close-tab');
  KEY('i want you closing it', 'close-tab');
  KEY('it needs closing', 'close-tab');
  KEY('it needs to be closed', 'close-tab');
  KEY('this tab needs to go', 'close-tab');
  KEY('this has got to go', 'close-tab');
  KEY('i would like for you to close it', 'close-tab');
  KEY('i was hoping for you to close it', 'close-tab');
  KEY('i would like it if you closed it', 'close-tab');
  KEY('go for it, close it', 'close-tab');
  KEY('i dare you to close it', 'close-tab');
  KEY('close it whenever possible', 'close-tab');
  KEY('close it when you get the chance', 'close-tab');
  KEY("dont be shy, close it", 'close-tab');
});

describe('pace/speed phrase fills', () => {
  KEY('早く閉じて', 'close-tab');
  KEY('ゆっくりめで読んで', 'speech-slower');
  KEY('read it at your own pace', 'read-aloud');
  KEY('keep reading it to me', 'read-aloud');
  KEY('the volume is kind of low', 'volume-up');
  KEY('its a bit loud', 'volume-down');
  KEY('turn the volume way down', 'volume-down');
  KEY('どこまで読んだっけ', 'reader-progress');
  KEY('半分くらい読んだ', 'reader-progress');
});
