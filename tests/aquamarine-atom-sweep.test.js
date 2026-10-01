// pass CCLXXIV: violated-expectation imperatives + certainty/plea/vocative
// frames -> close-tab; verification queries -> describe-tab (no execute);
// thought-closed reports -> trouble; compliance acknowledgments -> ack.
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

describe('pass CCLXXIV: expectation/verification/thought-closed routing', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN violated-expectation + force/threat imperatives -> close-tab
    ['it shouldve been closed', 'close-tab'], ['it should have been closed', 'close-tab'],
    ['shouldve been closed already', 'close-tab'], ['see it closed', 'close-tab'],
    ['it better be closed', 'close-tab'], ['it better close', 'close-tab'],
    ['itd better be closed', 'close-tab'], ['wanna see it closed', 'close-tab'],
    ['close it for good this time', 'close-tab'],
    ['force it to close', 'close-tab'], ['force close it', 'close-tab'], ['hard close it', 'close-tab'],
    // EN verification queries -> describe-tab (status, no execute)
    ['confirm it closed', 'describe-tab'], ['double check its closed', 'describe-tab'],
    ['verify its closed', 'describe-tab'], ['check if its closed', 'describe-tab'],
    ['see if it closed', 'describe-tab'], ['see if its closed', 'describe-tab'],
    ['has it closed yet', 'describe-tab'], ['is it finally closed', 'describe-tab'],
    // EN thought-closed reports -> trouble
    ['thought it was closed', 'trouble'], ['thought itd be closed', 'trouble'],
    ['i figured it closed', 'trouble'],
    // EN compliance acknowledgments -> ack
    ['doing it now', 'ack'], ['getting to it', 'ack'],
    // JA certainty/plea/vocative imperatives -> close-tab
    ['きちんと閉じて', 'close-tab'], ['確かに閉じて', 'close-tab'], ['必ず閉じて', 'close-tab'],
    ['確実に閉じろ', 'close-tab'], ['必ず閉じるように', 'close-tab'], ['確実に閉じるんだ', 'close-tab'],
    ['絶対閉じろ', 'close-tab'], ['絶対に閉じて', 'close-tab'],
    ['閉じなよお前', 'close-tab'], ['閉じてくれよおい', 'close-tab'], ['閉じてねぇ', 'close-tab'],
    ['頼むよ閉じて', 'close-tab'], ['お願いだから閉じて', 'close-tab'], ['お願いだよ閉じろ', 'close-tab'],
    ['そろそろ閉じろ', 'close-tab'], ['そろそろ閉じて', 'close-tab'],
    ['もう閉じろ', 'close-tab'], ['もう閉じていい', 'close-tab'],
    ['今度こそ閉じろ', 'close-tab'], ['今度こそ閉じて', 'close-tab'], ['閉じちゃっていいから', 'close-tab'],
    // JA thought-closed reports -> trouble
    ['閉じておいたのに', 'trouble'],
    // coexistence: established pins unchanged
    ['on it', 'ack'], ['did it close', 'describe-tab'], ['has it closed', 'describe-tab'],
    ['did i close it', 'describe-tab'], ['ちゃんと閉じて', 'close-tab'],
    ['it was supposed to be closed', 'close-tab'], ['閉じたつもりだった', 'describe-tab'],
    ['閉じたと思ってた', 'trouble'], ['閉じたはずだった', 'trouble'],
    ['閉じてよね', 'close-tab'], ['閉じてね', 'close-tab'], ['早く閉じなよ', 'close-tab'],
    ['閉じさせろ', 'close-tab'], ['閉じてしまおう', 'close-tab'], ['閉じちゃっていいよ', 'close-tab'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
