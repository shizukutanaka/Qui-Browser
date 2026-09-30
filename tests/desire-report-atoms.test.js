// Round 108: JA desire/expectation/permission tails, EN close-verb vocabulary,
// accidental-close reports, passive 'it X-ed' swap extension.
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
  // === JA たい desire tails → execute ===
  ['閉じたいのに', 'close-tab'],
  ['閉じたいんだ', 'close-tab'],
  ['閉じたいので', 'close-tab'],
  ['閉じたいから', 'close-tab'],
  ['閉じたいっす', 'close-tab'],
  ['閉じたいなあ', 'close-tab'],
  ['閉じたいんや', 'close-tab'],
  ['閉じたいわ', 'close-tab'],
  ['読みたいんだ', 'read-aloud'],
  ['戻りたいので', 'back'],

  // === JA intent/expectation reports → execute ===
  ['閉じると思います', 'close-tab'],
  ['閉じると考えて', 'close-tab'],
  ['閉じるはず', 'close-tab'],
  ['閉じるはずだ', 'close-tab'],
  ['閉じるはずです', 'close-tab'],
  ['閉じるのでは', 'close-tab'],
  ['閉じるのだ', 'close-tab'],
  ['閉じるのである', 'close-tab'],

  // === JA past-expectation complaints → trouble ===
  ['閉じたはず', 'trouble'],
  ['閉じたはずなのに', 'trouble'],
  ['閉じたはずだった', 'trouble'],

  // === JA negative desire/intent → negate ===
  ['閉じるべきでは', 'negate'],
  ['閉じる気ない', 'negate'],
  ['閉じるつもりない', 'negate'],
  ['閉じたくない', 'negate'],
  ['読みたくない', 'negate'],

  // === JA といて request tails ===
  ['閉じといてほしい', 'close-tab'],
  ['閉じといてほしいな', 'close-tab'],
  ['閉じといてくれ', 'close-tab'],
  ['閉じといてもらう', 'close-tab'],
  ['読んどいてほしい', 'read-aloud'],

  // === JA させて causative-request tails ===
  ['閉じさせてもらいます', 'close-tab'],
  ['閉じさせてもらうね', 'close-tab'],
  ['読ませてもらいます', 'read-aloud'],

  // === JA permission/honorific tails ===
  ['閉じていいよね', 'close-tab'],
  ['閉じても大丈夫', 'close-tab'],
  ['閉じていいっす', 'close-tab'],
  ['閉じてええん', 'close-tab'],
  ['閉じてええんか', 'close-tab'],
  ['閉じてくださいますと幸いです', 'close-tab'],
  ['閉じてくだされば幸いです', 'close-tab'],
  ['閉じてくれますと', 'close-tab'],
  ['閉じてもいいでしょうか', 'close-tab'],
  ['閉じて問題ありませんか', 'close-tab'],
  ['閉じて構いません', 'close-tab'],

  // === JA deliberative/capability questions → help ===
  ['閉じるべきか', 'help'],
  ['閉じるべきかどうか', 'help'],
  ['閉じられますか', 'help'],
  ['閉じられます', 'help'],
  ['閉じられるか', 'help'],
  ['閉じれますか', 'help'],
  ['閉じられる', 'help'],

  // === EN close-verb vocabulary ===
  ['shut this', 'close-tab'],
  ['shut that', 'close-tab'],
  ['shut the tab', 'close-tab'],
  ['drop this', 'close-tab'],
  ['drop the tab', 'close-tab'],
  ['lose this', 'close-tab'],
  ['remove this', 'close-tab'],
  ['remove the tab', 'close-tab'],
  ['delete this', 'close-tab'],
  ['delete the tab', 'close-tab'],
  ['kill this', 'close-tab'],
  ['kill it dead', 'close-tab'],
  ['nuke this', 'close-tab'],
  ['nuke the tab', 'close-tab'],
  ['scrap it', 'close-tab'],
  ['scrap this', 'close-tab'],
  ['get rid of the tab', 'close-tab'],
  ['close it away', 'close-tab'],

  // === EN passive-object swap II (make / id like / it pronoun) ===
  ['make it closed', 'close-tab'],
  ['make this closed', 'close-tab'],
  ['i need it closed', 'close-tab'],
  ['id like it closed', 'close-tab'],
  ['i want it closed', 'close-tab'],
  ['i want it shut', 'close-tab'],

  // === EN openers ===
  ['merely close it', 'close-tab'],
  ['no close it', 'close-tab'],
  ['nah close it', 'close-tab'],
  ['wait close it', 'close-tab'],
  ['so yeah close it', 'close-tab'],

  // === EN status questions → describe-tab ===
  ['is it closing', 'describe-tab'],
  ['is it still up', 'describe-tab'],
  ['has it closed', 'describe-tab'],
  ['was it closed', 'describe-tab'],
  ['was it open', 'describe-tab'],
  ['is it gone', 'describe-tab'],
  ['its back', 'describe-tab'],
  ['it came back', 'describe-tab'],

  // === EN/JA accidental-close reports → reopen-tab ===
  ['it closed on me', 'reopen-tab'],
  ['it closed itself', 'reopen-tab'],
  ['it disappeared', 'reopen-tab'],
  ['it went away', 'reopen-tab'],
  ['its gone now', 'reopen-tab'],
  ['消えたよ', 'reopen-tab'],
  ['消えたんだけど', 'reopen-tab'],
  ['消えちゃいました', 'reopen-tab'],
  ['閉じちゃいました', 'reopen-tab'],
  ['閉じちゃったから', 'reopen-tab'],
  ['閉じられたんだ', 'reopen-tab'],
  ['閉じちゃうんだ', 'reopen-tab'],

  // === involuntary-close bug reports → trouble ===
  ['it crashed on me', 'trouble'],
  ['勝手に閉じる', 'trouble'],
  ['勝手に閉じられた', 'trouble'],
  ['自動で閉じた', 'trouble'],
  ['急に閉じた', 'trouble'],
  ['いきなり閉じた', 'trouble'],
  ['勝手に消えた', 'trouble'],

  // === coexistence ===
  ['閉じていいよ', 'close-tab'],
  ['閉じてもいいです', 'close-tab'],
  ['閉じてええで', 'close-tab'],
  ['閉じたいんです', 'close-tab'],
  ['閉じたいけど', 'close-tab'],
  ['閉じさせてください', 'close-tab'],
  ['閉じてもらいたいのですが', 'close-tab'],
  ['閉じるべきだ', 'close-tab'],
  ['閉じていいか', 'close-tab'],
  ['閉じるべきではない', 'negate'],
  ['閉じられない', 'trouble'],
  ['閉じれない', 'trouble'],
  ['閉じれへん', 'negate'],
  ['閉じちゃった', 'reopen-tab'],
  ['消えちゃった', 'reopen-tab'],
  ['閉じちゃったよ', 'reopen-tab'],
  ['勝手に閉じた', 'trouble'],
  ['勝手に動いた', 'trouble'],
  ['close this tab', 'close-tab'],
  ['close that tab', 'close-tab-by-name'],
  ['close a tab', 'close-tab-by-name'],
  ['ditch this', 'close-tab'],
  ['get rid of it', 'close-tab'],
  ['close it off', 'close-tab'],
  ['shut it off', 'close-tab'],
  ['may i close this', 'close-tab'],
  ['should i close this', 'help'],
  ['shall i close this', 'help'],
  ['is it ok to close this', 'help'],
  ['is it open still', 'describe-tab'],
  ['did it close', 'describe-tab'],
  ['is it open', 'describe-tab'],
  ['keep it closed', 'negate'],
  ['leave it closed', 'negate'],
];

describe('Round 108: desire & report atoms', () => {
  test.each(cases)('%s → %s', (phrase, key) => {
    expect(run(phrase)).toBe(key);
  });
});
