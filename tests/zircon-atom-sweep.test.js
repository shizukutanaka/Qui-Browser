// pass CCLXXI: concessive/imperative-reiteration frames -> close-tab
// (EN i-dont-care/why-not/if-you-must/as-i-said tails + JA 通り/ええから prefixes;
// coexistence vs negate/status/ack pins)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function mk() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  return {
    tabs: [t1, t2],
    activeTab: t2,
    activeTabId: 2,
    getActiveTab() { return this.activeTab; },
    getTab(id) { return this.tabs.find((t) => t.id === id); },
  };
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('pass CCLXXI: concessive/imperative-reiteration -> close-tab', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN concessive/dismissive command frames -> close-tab
    ['close it i dont care', 'close-tab'], ['yeah close it', 'close-tab'],
    ['close it why not', 'close-tab'], ['close it if you must', 'close-tab'],
    // EN imperative reiteration -> close-tab
    ['i did say close it', 'close-tab'], ['close it like i said', 'close-tab'],
    ['as i said close it', 'close-tab'], ['final time close it', 'close-tab'],
    // JA 通り/したがい imperative reinforcement -> close-tab
    ['言った通り閉じろ', 'close-tab'], ['言う通りに閉じろ', 'close-tab'],
    ['言ったように閉じろ', 'close-tab'], ['言う通り閉じて', 'close-tab'],
    ['頼んだ通り閉じろ', 'close-tab'], ['注文通り閉じろ', 'close-tab'],
    ['言われた通りに閉じろ', 'close-tab'],
    // JA exasperated concessive prefixes -> close-tab
    ['もういいから閉じろ', 'close-tab'], ['ええから閉じなさい', 'close-tab'],
    ['もういいから閉じなさい', 'close-tab'],
    // coexistence: established pins unchanged
    ['fine close it', 'close-tab'], ['go ahead close it', 'close-tab'],
    ['sure close it', 'close-tab'], ['ok close it already', 'close-tab'],
    ['close it whatever', 'close-tab'], ['might as well close it', 'close-tab'],
    ['go right ahead close it', 'close-tab'], ['be my guest close it', 'close-tab'],
    ['youre welcome to close it', 'close-tab'], ['please do close it', 'close-tab'],
    ['do close it', 'close-tab'], ['i said close it', 'close-tab'],
    ['didnt i say close it', 'close-tab'], ['close it like i told you', 'close-tab'],
    ['close it as instructed', 'close-tab'], ['like i said close it', 'close-tab'],
    ['for the last time close it', 'close-tab'], ['last warning close it', 'close-tab'],
    ['いいから閉じろ', 'close-tab'], ['とにかく閉じろ', 'close-tab'],
    ['さっさと閉じろ', 'close-tab'], ['さっさと閉じなさい', 'close-tab'],
    ['閉じろと言ったでしょ', 'close-tab'], ['閉じろって言ったでしょ', 'close-tab'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
