const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

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

describe('JA forgot/should-have residue (execute)', () => {
  const vc = boot();
  const cases = [
    ['閉じるの忘れてた', 'close-tab'],
    ['閉じるんだった', 'close-tab'],
    ['閉じとくべきだった', 'close-tab'],
    ['戻るの忘れてた', 'back'],
    ['読むの忘れてた', 'read-aloud'],
    ['閉じ忘れてた', 'close-tab'],
    ['閉じ忘れた', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA permissive / volitional residue', () => {
  const vc = boot();
  const cases = [
    ['閉じてもええんやで', 'close-tab'],
    ['閉じてもええわ', 'close-tab'],
    ['閉じてもええで', 'close-tab'],
    ['閉じよかな', 'close-tab'],
    ['閉じよか', 'close-tab'],
    ['閉じよかろう', 'close-tab'],
    ['戻ろうかいな', 'back'],
    ['閉じときなさい', 'close-tab'],
    ['読んじまえ', 'read-aloud'],
    ['閉じちまえ', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA failure reports → trouble / say-again', () => {
  const vc = boot();
  const cases = [
    ['読み損ねた', 'trouble'],
    ['閉じ損ねた', 'trouble'],
    ['開き損ねた', 'trouble'],
    ['閉じ損ねちゃった', 'trouble'],
    ['聞き損ねた', 'say-again'],
    ['聞き損ねちゃった', 'say-again'],
    ['見損ねた', 'describe-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA skim / read-mode idioms', () => {
  const vc = boot();
  const cases = [
    ['ちらっと見て', 'describe-tab'],
    ['ちら見して', 'describe-tab'],
    ['ざっと読んで', 'read-aloud'],
    ['流し読みして', 'read-aloud'],
    ['斜め読みして', 'read-aloud'],
    ['音読して', 'read-aloud'],
    ['ざっと読み', 'read-aloud'],
    ['黙読する', 'stop-reading'],
    ['黙読', 'stop-reading'],
    ['黙読したい', 'stop-reading'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('JA openers / Kansai farewells / verify', () => {
  const vc = boot();
  const cases = [
    ['じゃあ閉じて', 'close-tab'],
    ['ほな閉じて', 'close-tab'],
    ['ほなら閉じて', 'close-tab'],
    ['じゃあ戻って', 'back'],
    ['さて閉じて', 'close-tab'],
    ['では閉じて', 'close-tab'],
    ['確かめてみて', 'web-search'],
    ['調べてみてよ', 'web-search'],
    ['調べてみて', 'web-search'],
    ['もうええわ', 'negate'],
    ['もうええ', 'negate'],
    ['もう結構です', 'negate'],
    ['おおきに', 'ack'],
    ['おおきにありがとう', 'ack'],
    ['またな', 'vr-exit'],
    ['ほなね', 'vr-exit'],
    ['じゃあの', 'vr-exit'],
    ['しつれい', 'vr-exit'],
    ['お先に失礼', 'vr-exit'],
    ['おつかれさま', 'vr-exit'],
    ['戻っちまう', 'back'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('EN appreciation / conditional prefixes (execute)', () => {
  const vc = boot();
  const cases = [
    ['be so good as to close it', 'close-tab'],
    ['i would appreciate it if you closed it', 'close-tab'],
    ['id appreciate it if you closed it', 'close-tab'],
    ['it would help if you closed it', 'close-tab'],
    ['it would be great if you closed it', 'close-tab'],
    ['i would love it if you closed it', 'close-tab'],
    ['mind closing it for me', 'close-tab'],
    ['mind closing it', 'close-tab'],
    ['i was gonna close it', 'close-tab'],
    ['i was about to close it', 'close-tab'],
    ['i meant to close it', 'close-tab'],
    ['meant to close it', 'close-tab'],
    ['i was supposed to close it', 'close-tab'],
    ['was gonna close it', 'close-tab'],
    ['i was meaning to close it', 'close-tab'],
    ['i never got around to closing it', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('EN how-to / coaching → help', () => {
  const vc = boot();
  const cases = [
    ['show me how to close it', 'help'],
    ['walk me through closing it', 'help'],
    ['teach me how to close it', 'help'],
    ['how does this work', 'help'],
    ['how do i use this', 'help'],
    ['whats the trick', 'help'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('EN small fills → existing atoms', () => {
  const vc = boot();
  const cases = [
    ['make it so', 'repeat-command'],
    ['lemme have the url', 'read-url'],
    ['gimme the url', 'read-url'],
    ['lemme see the url', 'read-url'],
    ['the url', 'read-url'],
    ['put me in vr', 'vr-enter'],
    ['take me into vr', 'vr-enter'],
    ['zoom to 150', 'percent-jump'],
    ['zoom to 200 percent', 'percent-jump'],
    ['reset the zoom', 'reader-scale-reset'],
    ['zoom back to normal', 'reader-scale-reset'],
    ['one line down', 'scroll-down'],
    ['a line down', 'scroll-down'],
    ['one line up', 'scroll-up'],
    ['next block', 'next-paragraph'],
    ['previous block', 'prev-paragraph'],
    ['say it slower', 'speech-slower'],
    ['can you say it slower', 'speech-slower'],
    ['read it slower', 'speech-slower'],
    ['say it faster', 'speech-faster'],
    ['kindly close it', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});

describe('coexistence — established routes preserved', () => {
  const vc = boot();
  const cases = [
    ['it would help a lot', 'scoped-help'],
    ['help me', 'help'],
    ['what should i do', 'help'],
    ['help me please', 'help'],
    ['help with tabs', 'scoped-help'],
    ['mind if i close it', 'help'],
    ['i would appreciate it', 'ack'],
    ['closed it', 'close-tab'],
    ['閉じた', 'describe-tab'],
    ['調べて', 'web-search'],
    ['検索して', 'find-in-page'],
  ];
  test.each(cases)('%s → %s', (p, key) => {
    expect(hit(vc, p)).toBe(key);
  });
});
