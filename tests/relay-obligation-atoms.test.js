// Relay-imperative & residual-obligation atoms: JA transmission imperatives,
// dialect obligation tails, ましょうか volitional-question, benefactive/permission
// residue, speed/volume request leftovers, EN permission frames.
// Written for round 118 — every case below was verified failing (null, misroute,
// or wrong-surface) on the pre-change tree.
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

describe('relay imperatives: よう伝えて/って言ってる relay commands execute', () => {
  KEY('閉じるよう伝えて', 'close-tab');
  KEY('閉じるように伝えてください', 'close-tab');
  KEY('閉じるようお伝えください', 'close-tab');
  KEY('読むように伝えてください', 'read-aloud');
  KEY('戻るよう伝えて', 'back');
  KEY('閉じてくれるよう言って', 'close-tab');
  KEY('閉じるって言ってるでしょ', 'close-tab');
  KEY('閉じるって何回も言ってる', 'close-tab');
});

describe('dialect obligation tails: なきゃ/なくては variants execute', () => {
  KEY('閉じなきゃダメだっけ', 'close-tab');
  KEY('閉じなきゃだよね', 'close-tab');
  KEY('閉じなきゃなんないわ', 'close-tab');
  KEY('閉じなきゃなんないんだ', 'close-tab');
  KEY('閉じなきゃいかんのか', 'close-tab');
  KEY('閉じなきゃいかん', 'close-tab');
  KEY('閉じなくてはいかんか', 'close-tab');
  KEY('閉じなきゃまずいかな', 'close-tab');
  KEY('閉じなきゃならんかった', 'close-tab');
  KEY('戻らなきゃならんかった', 'back');
  KEY('読まなきゃダメだっけ', 'read-aloud');
});

describe('ましょうか volitional-question (EN shall-we parity): execute', () => {
  KEY('閉じましょうか', 'close-tab');
  KEY('戻りましょうか', 'back');
  KEY('読みましょうかね', 'read-aloud');
  KEY('読んであげましょうか', 'read-aloud');
});

describe('dict suggestion residue II: 方がいいかな/としよう/といいでしょう execute', () => {
  KEY('進んだ方がいいかな', 'navigate');
  KEY('戻った方がいいんじゃないか', 'back');
  KEY('戻った方がいいかな', 'back');
  KEY('閉じる方がいいかな', 'close-tab');
  KEY('読むとしよう', 'read-aloud');
  KEY('読むとしようか', 'read-aloud');
  KEY('閉じるとしよう', 'close-tab');
  KEY('読むといいでしょう', 'read-aloud');
  KEY('読むといいんじゃないの', 'read-aloud');
  KEY('閉じるべきかと存じます', 'close-tab');
  KEY('閉じるべきかと思われます', 'close-tab');
  KEY('閉じることが望ましいのでは', 'close-tab');
  KEY('閉じるのが良いと存じます', 'close-tab');
  KEY('閉じることをお願い申し上げます', 'close-tab');
  KEY('閉じることをお願いいたします', 'close-tab');
  KEY('閉じるだけで結構です', 'close-tab');
  KEY('閉じるだけでいいです', 'close-tab');
  KEY('閉じるしかないと思う', 'close-tab');
});

describe('te-benefactive/permission residue X', () => {
  KEY('音量を上げてくれませんかな', 'volume-up');
  KEY('ピンを外してくれますかい', 'unpin-active');
  KEY('ピン外して', 'unpin-active');
  KEY('タブ閉じちゃってもいいかい', 'close-tab');
  KEY('閉じてもいいんじゃないですか', 'close-tab');
  KEY('閉じてもいいと思うよ', 'close-tab');
  KEY('閉じても差し支えなければ', 'close-tab');
  KEY('閉じてはいかがかと', 'close-tab');
  KEY('閉じといてもらえますか', 'close-tab');
  KEY('閉じといてくださいね', 'close-tab');
  KEY('閉じとこかな', 'close-tab');
  KEY('閉じていただけますでしょうか', 'close-tab');
  KEY('閉じていただければと存じます', 'close-tab');
  KEY('閉じていただけましたら幸甚です', 'close-tab');
  KEY('閉じてくださると大変助かります', 'close-tab');
  KEY('閉じてくだされば幸いに存じます', 'close-tab');
  KEY('閉じてくれるようお願いします', 'close-tab');
  KEY('閉じてくださるようお願いいたします', 'close-tab');
  KEY('閉じて頂くわけにはいきませんか', 'close-tab');
  KEY('閉じて頂いても宜しいでしょうか', 'close-tab');
  KEY('閉じてくれるだけでいい', 'close-tab');
  KEY('読んであげる', 'read-aloud');
  KEY('進んでほしいな', 'navigate');
});

describe('speed/volume request residue', () => {
  KEY('速度を落として', 'speech-slower');
  KEY('速度を落としてほしいです', 'speech-slower');
  KEY('もっとスローで', 'speech-slower');
  KEY('もうちょいゆっくりお願い', 'speech-slower');
  KEY('もう少しだけ大きくしてもらえますかね', 'volume-up');
  KEY('早めに読んで', 'speech-faster');
  KEY('早めに読んでちょ', 'speech-faster');
});

describe('EN permission/blessing frames execute', () => {
  KEY('you have my permission to close it', 'close-tab');
  KEY('i ask that you close it', 'close-tab');
  KEY('i would ask that you close it', 'close-tab');
  KEY('i request that you close it', 'close-tab');
  KEY('i must ask you to close it', 'close-tab');
});

describe('invariants: complaint/refusal/state surfaces unchanged', () => {
  KEY('why wont you close it', 'trouble');
  KEY('why cant you close it', 'trouble');
  KEY('読んでる途中だけど', 'reader-progress');
  KEY('途中から読んでくださいな', 'read-here');
  KEY('プライベートかどうか', 'privacy-status');
  KEY('閉じるまい', 'negate');
  KEY('閉じてくださいまいか', 'close-tab');
  KEY('戻るべきですかね', 'help');
  KEY('ピン留めしてもらえませんかね', 'pin-active');
});
