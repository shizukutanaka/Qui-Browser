const VC = require('/Users/devin/repos/Qui-Browser/src/vr/input/VoiceCommands').VoiceCommands;

function boot() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [{ title: 'A' }, { title: 'B' }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab() {}, setActive(i) { this.activeIndex = i; },
    closeTabs() {}, goBack() {}, goForward() {}, reload() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return vc;
}

function hit(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand && vc.lastCommand.key;
}

describe('JA residual request tails (execute)', () => {
  const vc = boot();
  const cases = [
    ['閉じてよろしい', 'close-tab'],
    ['閉じてよー', 'close-tab'],
    ['閉じて頂戴できますか', 'close-tab'],
    ['閉じといたほうが', 'close-tab'],
    ['閉じといたほうがいい', 'close-tab'],
    ['閉じたほうが', 'close-tab'],
    ['閉じる予定', 'close-tab'],
    ['閉じるつもり', 'close-tab'],
    ['閉じるつもりです', 'close-tab'],
    ['読むつもり', 'read-aloud'],
    ['戻るつもり', 'back'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA negated request → negate', () => {
  const vc = boot();
  const cases = [
    ['閉じんといて', 'negate'],
    ['閉じんとく', 'negate'],
    ['閉じなくてよい', 'negate'],
    ['閉じなくてもよい', 'negate'],
    ['閉じないでほしい', 'negate'],
    ['閉じちゃダメ?', 'negate'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA in-progress / looks-like reports → describe-tab', () => {
  const vc = boot();
  const cases = [
    ['閉じかけてる', 'describe-tab'],
    ['閉じてる最中', 'describe-tab'],
    ['閉じそう', 'describe-tab'],
    ['閉じちゃいそう', 'describe-tab'],
    ['閉じれそう', 'describe-tab'],
    ['閉じられそう', 'describe-tab'],
    ['閉じちゃうところだった', 'describe-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('EN vocatives, spellings, tails → execute', () => {
  const vc = boot();
  const cases = [
    ['close it for me will ya', 'close-tab'],
    ['close it wontcha', 'close-tab'],
    ['be a good bot and close it', 'close-tab'],
    ['you might wanna close it', 'close-tab'],
    ['u can close it', 'close-tab'],
    ['u should close it', 'close-tab'],
    ['ya better close it', 'close-tab'],
    ['better close it', 'close-tab'],
    ['close it pls', 'close-tab'],
    ['close it plz', 'close-tab'],
    ['plz close it', 'close-tab'],
    ['pwease close it', 'close-tab'],
    ['close it ttyl', 'close-tab'],
    ['close it if u could', 'close-tab'],
    ['close it if u can', 'close-tab'],
    ['close it whenever you want', 'close-tab'],
    ['close it today', 'close-tab'],
    ['close it rn', 'close-tab'],
    ['close it rn pls', 'close-tab'],
    ['close it thx', 'close-tab'],
    ['close it kthx', 'close-tab'],
    ['close that one', 'close-tab'],
    ['close it bud', 'close-tab'],
    ['close it fam', 'close-tab'],
    ['close it boss', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('EN status / factual fills', () => {
  const vc = boot();
  const cases = [
    ['still loading', 'loading-status'],
    ['is it done loading', 'loading-status'],
    ['how long left', 'remaining-time'],
    ['how many more pages', 'reader-progress'],
    ['how many more words', 'reader-progress'],
    ['what percent', 'reader-progress'],
    ['which page am i on', 'reader-progress'],
    ['do you have the time', 'time'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('OS apps are honest device-apps (not literal navigation)', () => {
  const vc = boot();
  const cases = [
    ['empty the recycle bin', 'device-apps'],
    ['open file explorer', 'device-apps'],
    ['open calculator', 'device-apps'],
    ['open notepad', 'device-apps'],
    ['open terminal', 'device-apps'],
    ['open command prompt', 'device-apps'],
    ['open control panel', 'device-apps'],
    ['open system preferences', 'device-apps'],
    ['open the app store', 'device-apps'],
    ['open play store', 'device-apps'],
    ['open photoshop', 'device-apps'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('acknowledgements II', () => {
  const vc = boot();
  const cases = [
    ['roger wilco', 'ack'],
    ['over and out', 'ack'],
    ['affirmative', 'ack'],
    ['aye sir', 'ack'],
    ['yes sir', 'ack'],
    ['yes maam', 'ack'],
    ['ok boss', 'ack'],
    ['sure boss', 'ack'],
    ['got it boss', 'ack'],
    ['はいはい', 'ack'],
    ['あいよ', 'ack'],
    ['ういっす', 'ack'],
    ['おっけー', 'ack'],
    ['りょ', 'ack'],
    ['りょかい', 'ack'],
    ['かしこまりました', 'ack'],
    ['そっかそっか', 'ack'],
    ['ほえー', 'ack'],
    ['ほほう', 'ack'],
    ['たしかにね', 'ack'],
    ['ふむふむ', 'ack'],
    ['ふむ', 'ack'],
    ['うむ', 'ack'],
    ['よしよし', 'ack'],
    ['よかった', 'ack'],
    ['たすかった', 'ack'],
    ['ありがてー', 'ack'],
    ['あんがと', 'ack'],
    ['大感謝', 'ack'],
    ['めっちゃ助かる', 'ack'],
    ['いい仕事するね', 'ack'],
    ['えらい', 'ack'],
    ['よくやった', 'ack'],
    ['やったー', 'ack'],
    ['いえーい', 'ack'],
    ['万歳', 'ack'],
    ['最高だ', 'ack'],
    ['さいこう', 'ack'],
    ['素晴らしいね', 'ack'],
    ['いいねいいね', 'ack'],
    ['めっちゃいい', 'ack'],
    ['ええやん', 'ack'],
    ['すげえ', 'ack'],
    ['すげー', 'ack'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('defer / hold-off → negate', () => {
  const vc = boot();
  const cases = [
    ['maybe later', 'negate'],
    ['another time', 'negate'],
    ['not right now', 'negate'],
    ['hold off', 'negate'],
    ['hold that', 'negate'],
    ['wait on it', 'negate'],
    ['sit tight', 'negate'],
    ['stand down', 'negate'],
    ['i changed my mind', 'negate'],
    ['change of plans', 'negate'],
    ['forget this', 'negate'],
    ['もうやだ', 'negate'],
    ['いやだ', 'negate'],
    ['やだ', 'negate'],
    ['嫌だ', 'negate'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('frustration / inability reports → trouble', () => {
  const vc = boot();
  const cases = [
    ['its stuck', 'trouble'],
    ['crashed again', 'trouble'],
    ['lost everything', 'trouble'],
    ['great now what', 'trouble'],
    ['for petes sake', 'trouble'],
    ['bloody hell', 'trouble'],
    ['damn it all', 'trouble'],
    ['shoot me', 'trouble'],
    ['kill me', 'trouble'],
    ['i give up', 'trouble'],
    ['whats wrong with it', 'trouble'],
    ['whats wrong with this thing', 'trouble'],
    ['why does this keep happening', 'trouble'],
    ['うんざり', 'trouble'],
    ['うざい', 'trouble'],
    ['うざったい', 'trouble'],
    ['くそー', 'trouble'],
    ['ちくしょう', 'trouble'],
    ['畜生', 'trouble'],
    ['ふざけんな', 'trouble'],
    ['なめんな', 'trouble'],
    ['なんなんだよ', 'trouble'],
    ['どういうこと', 'trouble'],
    ['どうなってんの', 'trouble'],
    ['どうなってんだ', 'trouble'],
    ['お手上げだ', 'trouble'],
    ['ギブアップ', 'trouble'],
    ['諦めた', 'trouble'],
    ['あきらめた', 'trouble'],
    ['限界', 'trouble'],
    ['もう限界', 'trouble'],
    ['無理だ', 'trouble'],
    ['むり', 'trouble'],
    ['不可能', 'trouble'],
    ['できそうにない', 'trouble'],
    ['どうにもならない', 'trouble'],
    ['どうしようもない', 'trouble'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('how-to / confusion → help', () => {
  const vc = boot();
  const cases = [
    ['どうすりゃいい', 'help'],
    ['どうすんの', 'help'],
    ['どうするんだ', 'help'],
    ['どうするつもり', 'help'],
    ['わからなくなった', 'help'],
    ['もうわからない', 'help'],
    ['訳わからない', 'help'],
    ['わけがわからない', 'help'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('exit phrase', () => {
  const vc = boot();
  test('i quit → vr-exit', () => {
    expect(hit(vc, 'i quit')).toBe('vr-exit');
  });
});

const VCB = require('../src/vr/input/VoiceCommands').VoiceCommands;

function bootB() {
  const vc = new VCB({ enabled: true });
  const tm = {
    tabs: [{ title: 'A' }, { title: 'B' }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab() {}, setActive(i) { this.activeIndex = i; },
    closeTabs() {}, goBack() {}, goForward() {}, reload() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return vc;
}

function hitB(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand && vc.lastCommand.key;
}

describe('JA residual request tails (execute)', () => {
  const vc = bootB();
  const cases = [
    ['閉じてよろしい', 'close-tab'],
    ['閉じてよー', 'close-tab'],
    ['閉じて頂戴できますか', 'close-tab'],
    ['閉じといたほうが', 'close-tab'],
    ['閉じといたほうがいい', 'close-tab'],
    ['閉じたほうが', 'close-tab'],
    ['閉じる予定', 'close-tab'],
    ['閉じるつもり', 'close-tab'],
    ['閉じるつもりです', 'close-tab'],
    ['読むつもり', 'read-aloud'],
    ['戻るつもり', 'back'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('JA negated request → negate', () => {
  const vc = bootB();
  const cases = [
    ['閉じんといて', 'negate'],
    ['閉じんとく', 'negate'],
    ['閉じなくてよい', 'negate'],
    ['閉じなくてもよい', 'negate'],
    ['閉じないでほしい', 'negate'],
    ['閉じちゃダメ?', 'negate'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('JA in-progress / looks-like reports → describe-tab', () => {
  const vc = bootB();
  const cases = [
    ['閉じかけてる', 'describe-tab'],
    ['閉じてる最中', 'describe-tab'],
    ['閉じそう', 'describe-tab'],
    ['閉じちゃいそう', 'describe-tab'],
    ['閉じれそう', 'describe-tab'],
    ['閉じられそう', 'describe-tab'],
    ['閉じちゃうところだった', 'describe-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('EN vocatives, spellings, tails → execute', () => {
  const vc = bootB();
  const cases = [
    ['close it for me will ya', 'close-tab'],
    ['close it wontcha', 'close-tab'],
    ['be a good bot and close it', 'close-tab'],
    ['you might wanna close it', 'close-tab'],
    ['u can close it', 'close-tab'],
    ['u should close it', 'close-tab'],
    ['ya better close it', 'close-tab'],
    ['better close it', 'close-tab'],
    ['close it pls', 'close-tab'],
    ['close it plz', 'close-tab'],
    ['plz close it', 'close-tab'],
    ['pwease close it', 'close-tab'],
    ['close it ttyl', 'close-tab'],
    ['close it if u could', 'close-tab'],
    ['close it if u can', 'close-tab'],
    ['close it whenever you want', 'close-tab'],
    ['close it today', 'close-tab'],
    ['close it rn', 'close-tab'],
    ['close it rn pls', 'close-tab'],
    ['close it thx', 'close-tab'],
    ['close it kthx', 'close-tab'],
    ['close that one', 'close-tab'],
    ['close it bud', 'close-tab'],
    ['close it fam', 'close-tab'],
    ['close it boss', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('EN status / factual fills', () => {
  const vc = bootB();
  const cases = [
    ['still loading', 'loading-status'],
    ['is it done loading', 'loading-status'],
    ['how long left', 'remaining-time'],
    ['how many more pages', 'reader-progress'],
    ['how many more words', 'reader-progress'],
    ['what percent', 'reader-progress'],
    ['which page am i on', 'reader-progress'],
    ['do you have the time', 'time'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('OS apps are honest device-apps (not literal navigation)', () => {
  const vc = bootB();
  const cases = [
    ['empty the recycle bin', 'device-apps'],
    ['open file explorer', 'device-apps'],
    ['open calculator', 'device-apps'],
    ['open notepad', 'device-apps'],
    ['open terminal', 'device-apps'],
    ['open command prompt', 'device-apps'],
    ['open control panel', 'device-apps'],
    ['open system preferences', 'device-apps'],
    ['open the app store', 'device-apps'],
    ['open play store', 'device-apps'],
    ['open photoshop', 'device-apps'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('acknowledgements II', () => {
  const vc = bootB();
  const cases = [
    ['roger wilco', 'ack'],
    ['over and out', 'ack'],
    ['affirmative', 'ack'],
    ['aye sir', 'ack'],
    ['yes sir', 'ack'],
    ['yes maam', 'ack'],
    ['ok boss', 'ack'],
    ['sure boss', 'ack'],
    ['got it boss', 'ack'],
    ['はいはい', 'ack'],
    ['あいよ', 'ack'],
    ['ういっす', 'ack'],
    ['おっけー', 'ack'],
    ['りょ', 'ack'],
    ['りょかい', 'ack'],
    ['かしこまりました', 'ack'],
    ['そっかそっか', 'ack'],
    ['ほえー', 'ack'],
    ['ほほう', 'ack'],
    ['たしかにね', 'ack'],
    ['ふむふむ', 'ack'],
    ['ふむ', 'ack'],
    ['うむ', 'ack'],
    ['よしよし', 'ack'],
    ['よかった', 'ack'],
    ['たすかった', 'ack'],
    ['ありがてー', 'ack'],
    ['あんがと', 'ack'],
    ['大感謝', 'ack'],
    ['めっちゃ助かる', 'ack'],
    ['いい仕事するね', 'ack'],
    ['えらい', 'ack'],
    ['よくやった', 'ack'],
    ['やったー', 'ack'],
    ['いえーい', 'ack'],
    ['万歳', 'ack'],
    ['最高だ', 'ack'],
    ['さいこう', 'ack'],
    ['素晴らしいね', 'ack'],
    ['いいねいいね', 'ack'],
    ['めっちゃいい', 'ack'],
    ['ええやん', 'ack'],
    ['すげえ', 'ack'],
    ['すげー', 'ack'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('defer / hold-off → negate', () => {
  const vc = bootB();
  const cases = [
    ['maybe later', 'negate'],
    ['another time', 'negate'],
    ['not right now', 'negate'],
    ['hold off', 'negate'],
    ['hold that', 'negate'],
    ['wait on it', 'negate'],
    ['sit tight', 'negate'],
    ['stand down', 'negate'],
    ['i changed my mind', 'negate'],
    ['change of plans', 'negate'],
    ['forget this', 'negate'],
    ['もうやだ', 'negate'],
    ['いやだ', 'negate'],
    ['やだ', 'negate'],
    ['嫌だ', 'negate'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('frustration / inability reports → trouble', () => {
  const vc = bootB();
  const cases = [
    ['its stuck', 'trouble'],
    ['crashed again', 'trouble'],
    ['lost everything', 'trouble'],
    ['great now what', 'trouble'],
    ['for petes sake', 'trouble'],
    ['bloody hell', 'trouble'],
    ['damn it all', 'trouble'],
    ['shoot me', 'trouble'],
    ['kill me', 'trouble'],
    ['i give up', 'trouble'],
    ['whats wrong with it', 'trouble'],
    ['whats wrong with this thing', 'trouble'],
    ['why does this keep happening', 'trouble'],
    ['うんざり', 'trouble'],
    ['うざい', 'trouble'],
    ['うざったい', 'trouble'],
    ['くそー', 'trouble'],
    ['ちくしょう', 'trouble'],
    ['畜生', 'trouble'],
    ['ふざけんな', 'trouble'],
    ['なめんな', 'trouble'],
    ['なんなんだよ', 'trouble'],
    ['どういうこと', 'trouble'],
    ['どうなってんの', 'trouble'],
    ['どうなってんだ', 'trouble'],
    ['お手上げだ', 'trouble'],
    ['ギブアップ', 'trouble'],
    ['諦めた', 'trouble'],
    ['あきらめた', 'trouble'],
    ['限界', 'trouble'],
    ['もう限界', 'trouble'],
    ['無理だ', 'trouble'],
    ['むり', 'trouble'],
    ['不可能', 'trouble'],
    ['できそうにない', 'trouble'],
    ['どうにもならない', 'trouble'],
    ['どうしようもない', 'trouble'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('how-to / confusion → help', () => {
  const vc = bootB();
  const cases = [
    ['どうすりゃいい', 'help'],
    ['どうすんの', 'help'],
    ['どうするんだ', 'help'],
    ['どうするつもり', 'help'],
    ['わからなくなった', 'help'],
    ['もうわからない', 'help'],
    ['訳わからない', 'help'],
    ['わけがわからない', 'help'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hitB(vc, p)).toBe(key);
  });
});

describe('exit phrase', () => {
  const vc = bootB();
  test('i quit → vr-exit', () => {
    expect(hitB(vc, 'i quit')).toBe('vr-exit');
  });
});
