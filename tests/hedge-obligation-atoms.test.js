/**
 * Hedge/obligation atoms — JA past-te tails (てきた/ていった/ておいた),
 * state reports (たまま/たばかり/がち), double-negation & obligation
 * (なくはない/わけにはいかない/ざるを得ない), hesitant かねる, hedge openers
 * (すみません/悪いんだけど/お手数ですが/ぜひ/どうぞ/とにかく/とっとと/急いで),
 * EN courtesy frames (anyway/btw/see if you can/might i trouble you) +
 * immediacy tails (right now/asap/at your leisure/if you dont mind)
 * (pass LV).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeTabs(titles) {
  const calls = { closeTab: [], setActive: [], closeTabs: [] };
  const tm = {
    tabs: titles.map((t) => ({ title: t })),
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab(i) { calls.closeTab.push(i); },
    setActive(i) { this.activeIndex = i; calls.setActive.push(i); },
    closeTabs(idxs) { calls.closeTabs.push(idxs); },
  };
  return { tm, calls };
}

function boot(titles) {
  const vc = new VoiceCommands({ enabled: true });
  const { tm, calls } = makeTabs(titles);
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return { vc, tm, calls };
}

function run(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand;
}

describe('JA past-te & kept-state tails', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じてきた', 'close-tab'], ['読んでいった', 'read-aloud'],
    ['戻ってきた', 'back'], ['閉じていった', 'close-tab'],
    ['閉じておいた', 'close-tab'], ['閉じておいたよ', 'close-tab'],
    ['読んでおいた', 'read-aloud'], ['閉じてきます', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA state reports — まま/ばかり/がち + distress', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じたまま', 'describe-tab'], ['閉じたばかり', 'describe-tab'],
    ['消えたばかり', 'describe-tab'],
    ['落ちがち', 'trouble'], ['固まりがち', 'trouble'],
    ['詰まった', 'trouble'], ['バグった', 'trouble'], ['バグってる', 'trouble'],
    ['こりゃだめ', 'trouble'], ['ダメだ', 'trouble'], ['お手上げ', 'trouble'],
    ['参った', 'trouble'], ['くそ', 'trouble'], ['最悪', 'trouble'],
    ['あーもう', 'trouble'], ['うるさすぎ', 'volume-down'],
    ['困ってる', 'help'], ['困りました', 'help'],
    ['閉じかねる', 'help'], ['できかねる', 'help'], ['対応しかねます', 'help'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA double-negation & obligation forms execute', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じなくはない', 'close-tab'], ['閉じないわけにはいかない', 'close-tab'],
    ['閉じざるを得ない', 'close-tab'], ['閉じざるをえない', 'close-tab'],
    ['戻らざるを得ない', 'back'], ['読まないわけにはいかない', 'read-aloud'],
    ['読まなくはない', 'read-aloud'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA hedge/courtesy openers', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['すみませんが閉じて', 'close-tab'], ['すみません閉じて', 'close-tab'],
    ['悪いんだけど閉じて', 'close-tab'], ['悪いけど戻って', 'back'],
    ['お手数ですが閉じて', 'close-tab'], ['差し支えなければ閉じて', 'close-tab'],
    ['お手すきの際に読んで', 'read-aloud'], ['できたら閉じて', 'close-tab'],
    ['もし可能なら閉じて', 'close-tab'], ['もし閉じて', 'close-tab'],
    ['よければ閉じて', 'close-tab'], ['ぜひ閉じて', 'close-tab'],
    ['どうぞ閉じて', 'close-tab'], ['とにかく閉じて', 'close-tab'],
    ['ともかく閉じて', 'close-tab'], ['とっとと閉じて', 'close-tab'],
    ['さっさと閉じて', 'close-tab'], ['直ちに閉じて', 'close-tab'],
    ['早急に閉じて', 'close-tab'], ['急いで閉じて', 'close-tab'],
    ['いそいで閉じて', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA reactions → ack', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['ふぅ', 'ack'], ['ほっ', 'ack'], ['ぴったり', 'ack'], ['完璧', 'ack'],
    ['楽しい', 'ack'], ['面白い', 'ack'], ['おもしろい', 'ack'],
    ['すてき', 'ack'], ['素敵', 'ack'], ['かわいい', 'ack'],
    ['きれい', 'ack'], ['暇だ', 'ack'], ['退屈', 'ack'], ['つまらない', 'ack'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN courtesy frames + immediacy tails', () => {
  const { vc, calls } = boot(['A', 'B', 'C']);
  const cases = [
    ['anyway close it', 'close-tab'], ['anyways close it', 'close-tab'],
    ['by the way close it', 'close-tab'], ['btw close it', 'close-tab'],
    ['see if you can close it', 'close-tab'], ['try closing it', 'close-tab'],
    ['have a go at closing it', 'close-tab'], ['see about closing it', 'close-tab'],
    ['get to closing it', 'close-tab'], ['up and close it', 'close-tab'],
    ['might i trouble you to close it', 'close-tab'],
    ['be a lamb and close it', 'close-tab'],
    ['have the goodness to close it', 'close-tab'],
    ['yes please close it', 'close-tab'],
    ['close it right now', 'close-tab'], ['close it asap', 'close-tab'],
    ['close it pronto', 'close-tab'], ['close it stat', 'close-tab'],
    ['close it at your leisure', 'close-tab'],
    ['close it when you have a moment', 'close-tab'],
    ['close it whenever you get around to it', 'close-tab'],
    ['close it if you dont mind', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
  it('"close it right now" actually closes the active tab', () => {
    calls.closeTab.length = 0;
    run(vc, 'close it right now');
    expect(calls.closeTab.length).toBeGreaterThan(0);
  });
});

describe('EN idioms & reactions', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['easy does it', 'ack'], ['slow and steady', 'ack'],
    ['hurry up', 'ack'], ['chop chop', 'ack'], ['snap to it', 'ack'],
    ['lovely', 'ack'], ['impressive', 'ack'], ['yikes', 'ack'],
    ['oof', 'ack'], ['dang', 'ack'], ['shoot', 'ack'], ['gah', 'ack'],
    ['whatever you say', 'ack'], ['if you say so', 'ack'],
    ['just saying', 'ack'], ['fyi', 'ack'],
    ['softer please', 'volume-down'], ['quieter please', 'volume-down'],
    ['faster faster', 'speech-faster'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('coexistence — established routes preserved', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['mind if i close it', 'help'],
    ['閉じて', 'close-tab'], ['読んでみて', 'read-aloud'],
    ['とりあえず閉じて', 'close-tab'], ['まず閉じて', 'close-tab'],
    ['do it later', 'defer'], ['save it for later', 'bookmark-page'],
    ['いいです', 'negate'], ['そのままにして', 'negate'],
    ['この次のタブ', 'tab-relative'], ['one tab over', 'tab-relative'],
    ['すぐに閉じて', 'close-tab'], ['今すぐ閉じて', 'close-tab'],
    ['助けて', 'help'], ['困った', 'help'], ['疲れた', 'trouble'],
    ['dont stop', 'negate'], ['whoops', 'negate'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});
