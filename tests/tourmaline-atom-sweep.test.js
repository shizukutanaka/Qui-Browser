// pass CCLXX: rebuke/expectation frames -> close-tab, thought-closed/neglect reports -> trouble
// (EN supposed-to/told-you/begged/ASR-mishear residue + JA quotative-imperative rebukes,
// つもりだった intent reports vs 閉じたと思った/そびれた state reports)
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

describe('pass CCLXX: rebuke/expectation vs state-report routing', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN rebuke/expectation -> close-tab
    ['its as good as done', 'close-tab'], ['done deal close it', 'close-tab'],
    ['understood close it', 'close-tab'], ['you were supposed to close it', 'close-tab'],
    ['i thought i told you to close it', 'close-tab'], ['you were meant to close it', 'close-tab'],
    ['you had one job close it', 'close-tab'], ['how many times close it', 'close-tab'],
    ['i begged you to close it', 'close-tab'], ['werent you told to close it', 'close-tab'],
    ['were you not told to close it', 'close-tab'], ['you havent closed it', 'close-tab'],
    ['still not closed', 'close-tab'],
    // EN ASR mishears of "close" -> close-tab
    ['clothes the tab', 'close-tab'], ['clothes this tab', 'close-tab'], ['clothes it', 'close-tab'],
    ['clothe this tab', 'close-tab'], ['clothe the tab', 'close-tab'],
    ['close the tap', 'close-tab'], ['klose the tab', 'close-tab'], ['klose this tab', 'close-tab'],
    ['close the table', 'close-tab'], ['close the tablet', 'close-tab'],
    ['clothes tab', 'close-tab'], ['close da tab', 'close-tab'],
    // JA quotative-imperative rebukes (still commanding) -> close-tab
    ['閉じろといった', 'close-tab'], ['閉じろって言ったのに', 'close-tab'],
    ['閉じろと言ったのに', 'close-tab'], ['閉じよと言ったのに', 'close-tab'],
    ['閉じてと頼んだのに', 'close-tab'], ['閉じてと言ったのに', 'close-tab'],
    ['閉じなさいと言ったのに', 'close-tab'],
    // JA intent reports -> close-tab
    ['閉じるつもりだった', 'close-tab'], ['閉じるつもりだったよ', 'close-tab'],
    ['閉じるつもりだったのに', 'close-tab'], ['閉じるつもりだったんだ', 'close-tab'],
    // JA state reports (thought it was closed / neglected) -> trouble
    ['閉じたと思ったけど', 'trouble'], ['閉じたと思ったのに', 'trouble'],
    ['閉じてあると思ってた', 'trouble'], ['閉じていると思ってた', 'trouble'],
    ['閉じそびれた', 'trouble'], ['閉じそびれたよ', 'trouble'], ['閉じ残した', 'trouble'],
    ['閉じてなかった', 'trouble'], ['閉じられてなかった', null], // passive-past ambiguity pin (mortar)
    // coexistence: established pins unchanged
    ['閉じてると思ったのに', 'trouble'], ['閉じるはずだったんだ', 'trouble'],
    ['閉じると言ったのに', 'trouble'], ['閉じろと言った', 'close-tab'],
    ['閉じろって言った', 'close-tab'], ['its still open', 'describe-tab'],
    ['why is it still open', 'describe-tab'], ['how come its open', 'describe-tab'],
    ['why havent you closed it', 'close-tab'], ['i asked you to close it', 'close-tab'],
    ['you didnt close it', 'trouble'], ['you still havent closed it', 'trouble'], ['閉じ忘れた', 'close-tab'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
