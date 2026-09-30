// pass CCLXXII: sarcastic status reports -> describe-tab, vocative commands -> close-tab,
// neglected-state reports -> trouble/negate (EN still-open-huh/i-see + dear/champ vocatives;
// JA おい/こら vocatives + 忘れてる present-tense forgot reports + まま residue)
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

describe('pass CCLXXII: status-sarcasm vs vocative-command routing', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN sarcastic still-open reports -> describe-tab
    ['still open huh', 'describe-tab'], ['still there i see', 'describe-tab'],
    ['still up i see', 'describe-tab'], ['open i see', 'describe-tab'], ['open huh', 'describe-tab'],
    ['i see its still open', 'describe-tab'], ['i see its open', 'describe-tab'],
    ['its open i see', 'describe-tab'], ['you left it open', 'describe-tab'],
    ['you left the tab open', 'describe-tab'], ['left it open again', 'describe-tab'],
    // EN vocative commands -> close-tab
    ['dear close it', 'close-tab'], ['love close it', 'close-tab'],
    ['honey close it', 'close-tab'], ['sweetie close it', 'close-tab'],
    ['pal close it', 'close-tab'], ['chief close it', 'close-tab'],
    ['boss close it', 'close-tab'], ['sport close it', 'close-tab'], ['champ close it', 'close-tab'],
    // JA vocative commands -> close-tab
    ['おい閉じろ', 'close-tab'], ['おい閉じて', 'close-tab'], ['こら閉じろ', 'close-tab'],
    ['こら閉じて', 'close-tab'], ['やあ閉じて', 'close-tab'], ['よう閉じて', 'close-tab'],
    ['よお閉じて', 'close-tab'],
    // JA present-tense forgot reports -> close-tab (quarry forgot-family)
    ['閉じ忘れてる', 'close-tab'], ['閉じ忘れてるよ', 'close-tab'],
    ['閉じるのを忘れてる', 'close-tab'], ['閉じるの忘れてる', 'close-tab'],
    // JA neglected-state reports -> trouble
    ['閉じてないまま', 'trouble'], ['閉じてないままだ', 'trouble'],
    // keep-open intent -> negate
    ['kept it open', 'negate'], ['kept the tab open', 'negate'], ['閉じないでいる', 'negate'],
    // JA まま residue -> describe-tab
    ['開きっぱなしのままだ', 'describe-tab'], ['開きっぱなしのままだった', 'describe-tab'],
    // coexistence: established pins unchanged
    ['開きっぱなしだよ', 'describe-tab'], ['開きっぱなしのまま', 'describe-tab'],
    ['閉じずにいる', 'negate'], ['閉じないまま', 'negate'], ['閉じなくていい', 'negate'],
    ['why did you keep it open', 'negate'], ['閉じていいよ', 'close-tab'],
    ['閉じちゃっていい', 'close-tab'], ['閉じてもいいよ', 'close-tab'],
    ['さあ閉じなさい', 'close-tab'], ['ねえ閉じて', 'close-tab'], ['なあ閉じて', 'close-tab'],
    ['なあ閉じろ', 'close-tab'], ['care to close it', 'close-tab'],
    ['wanna close it', 'close-tab'], ['be a dear close it', 'close-tab'],
    ['buddy close it', 'close-tab'], ['listen close it', 'close-tab'], ['hey close it', 'close-tab'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
