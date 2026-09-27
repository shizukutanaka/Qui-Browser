// Round 107: masu+particle tails, JA quotative/purpose tails, EN appreciation-
// prefix layer IV (passive 'this closed' swaps), read-mode fills.
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function run(phrase) {
  const vc = new VC({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example' }],
    closeTab() {},
    setActive() {},
    closeTabs() {},
    goBack() {},
    goForward() {},
    reload() {},
    getActiveTab() { return { title: 'Example', url: 'https://example.com' }; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const cases = [
  // === JA masu + final-particle tails → te-form ===
  ['閉じますよ', 'close-tab'],
  ['閉じますね', 'close-tab'],
  ['閉じますわ', 'close-tab'],
  ['閉じますから', 'close-tab'],
  ['閉じまっか', 'close-tab'],
  ['読みますよ', 'read-aloud'],
  ['読みますね', 'read-aloud'],
  ['読みますわ', 'read-aloud'],
  ['読みまっか', 'read-aloud'],
  ['戻りますよ', 'back'],
  ['進みますよ', 'navigate'],
  ['消しますね', 'dismiss-notify'],
  ['止めますよ', 'stop-everything'],

  // === JA quotative imperatives (って/と) ===
  ['読めって', 'read-aloud'],
  ['閉じろと', 'close-tab'],
  ['読めと', 'read-aloud'],
  ['閉じろとよ', 'close-tab'],
  ['探せって', 'find-in-page'],
  ['戻れと', 'back'],

  // === JA dict + purpose/explanatory tails ===
  ['閉じるように', 'close-tab'],
  ['閉じること', 'close-tab'],
  ['閉じるんだよ', 'close-tab'],
  ['閉じるんやで', 'close-tab'],
  ['読むんだよ', 'read-aloud'],
  ['戻るんやで', 'back'],
  ['閉じるのか', 'close-tab'],

  // === JA とけ/とこ dialect tails with particles ===
  ['閉じとけよ', 'close-tab'],
  ['閉じとけな', 'close-tab'],
  ['閉じとこな', 'close-tab'],
  ['読みときよ', 'read-aloud'],
  ['戻っときな', 'back'],

  // === JA te + elongated dialect tails ===
  ['閉じてやー', 'close-tab'],
  ['閉じてなー', 'close-tab'],
  ['閉じてやよ', 'close-tab'],
  ['読んでやー', 'read-aloud'],
  ['戻ってなー', 'back'],

  // === JA opener 'あのさ' ===
  ['あのさ閉じて', 'close-tab'],
  ['あのさあ閉じて', 'close-tab'],
  ['あのさ読んで', 'read-aloud'],
  ['閉じましょか', 'close-tab'],

  // === EN passive-particle 'this closed' swaps ===
  ['i want this closed', 'close-tab'],
  ['i need this closed', 'close-tab'],
  ['get this closed', 'close-tab'],
  ['have this closed', 'close-tab'],
  ['id like this muted', 'mute-status'],
  ['i want it muted', 'mute-toggle'],
  ['get this pinned', 'pin-active'],

  // === EN subject prefixes ===
  ['you can close it', 'close-tab'],
  ['you may close it', 'close-tab'],
  ['you will close it', 'close-tab'],

  // === EN adverb/vocative openers ===
  ['yo close it', 'close-tab'],
  ['quickly close it', 'close-tab'],
  ['slowly scroll down', 'scroll-down'],
  ['hurry and close it', 'close-tab'],
  ['hurry up and close it', 'close-tab'],
  ['carefully close it', 'close-tab'],

  // === EN question ability → help ===
  ['how might i close this', 'help'],
  ['how may i close this', 'help'],
  ['how would i close this', 'help'],

  // === EN polite refusal / sufficiency ===
  ['im good thanks', 'ack'],
  ['im good', 'ack'],
  ['im fine thanks', 'ack'],
  ['im okay thanks', 'ack'],
  ['thats enough reading', 'stop-reading'],
  ['thats enough of this', 'stop-reading'],

  // === JA reading-mode fills ===
  ['もう読まない', 'stop-reading'],
  ['読むのやめる', 'stop-reading'],
  ['読むのやめた', 'stop-reading'],
  ['読み止め', 'stop-reading'],
  ['読み切った', 'reader-progress'],
  ['読み切ったよ', 'reader-progress'],

  // === JA small fills ===
  ['タブ教えて', 'tabs-list'],
  ['タブを教えて', 'tabs-list'],
  ['ここどこ', 'where-am-i'],
  ['ここはどこ', 'where-am-i'],
  ['なんのページ', 'describe-tab'],
  ['誰が話してる', 'voice-name'],
  ['誰の声', 'voice-name'],
  ['誰の声ですか', 'voice-name'],

  // === EN question fills ===
  ['what am i on', 'describe-tab'],
  ['what tab is this', 'describe-tab'],
  ['what is this tab', 'describe-tab'],
  ['still going', 'working-status'],
  ['still at it', 'working-status'],
  ['you alive', 'working-status'],
  ['you still there', 'working-status'],
  ['are you alive', 'working-status'],

  // === coexistence: established routes preserved ===
  ['閉じろって', 'close-tab'],
  ['閉じろってば', 'close-tab'],
  ['閉じて', 'close-tab'],
  ['閉じます', 'close-tab'],
  ['閉じましょう', 'close-tab'],
  ['閉じるんだ', 'close-tab'],
  ['閉じるねん', 'close-tab'],
  ['閉じとけ', 'close-tab'],
  ['閉じとこ', 'close-tab'],
  ['戻れって', 'back'],
  ['調べろって', 'web-search'],
  ['どこだっけ', 'where-am-i'],
  ['何のページ', 'describe-tab'],
  ['どの声', 'voice-name'],
  ['何タブ', 'tab-status'],
  ['タブの状態', 'describe-tab'],
  ['whats this', 'describe-tab'],
  ['which tab am i on', 'where-am-i'],
  ['still working', 'working-status'],
  ['still there', 'working-status'],
  ['how can i close this', 'help'],
  ['how do i close this', 'help'],
  ['you could close it', 'close-tab'],
  ['you should close it', 'close-tab'],
  ['hey close it', 'close-tab'],
  ['thats enough', 'stop-everything'],
  ['enough', 'stop-everything'],
  ['読み終わった', 'reader-progress'],
  ['閉じんといて', 'negate'],
  ['閉じずに', 'negate'],
  ['閉じるけんね', 'negate'],
  ['閉じるまい', 'negate'],
];

describe('Round 107: masu-tail & passive-swap atoms', () => {
  test.each(cases)('%s → %s', (phrase, key) => {
    expect(run(phrase)).toBe(key);
  });
});
