// pass CCLXXV: breadth sweep beyond close-tab — back/next-tab/prev-tab/
// pin-active/mute-toggle/read-aloud/volume-up/reader-size-up literal fills.
// silence/quiet/hush family stays close-tab (established death-euphemism pins);
// 元に戻して stays reopen-tab (undo semantics).
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

describe('pass CCLXXV: cross-command literal fills', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN back-frames
    ['go back one', 'back'], ['back to where i was', 'back'],
    ['return to where i was', 'back'], ['one step back', 'back'],
    ['retreat', 'back'], ['reverse', 'back'], ['さっきのとこ', 'back'],
    // next-tab deictic/colloquial
    ['tab over', 'next-tab'], ['next one please', 'next-tab'],
    ['switch to the next', 'next-tab'], ['cycle forward', 'next-tab'],
    ['となりのタブ', 'next-tab'], ['次のタブいって', 'next-tab'],
    ['次いこ', 'next-tab'], ['つぎのやつ', 'next-tab'], ['その次のやつ', 'next-tab'],
    // prev-tab
    ['the one before', 'prev-tab'], ['前のタブもどって', 'prev-tab'],
    // pin-active
    ['keep this one around', 'pin-active'], ['pin it down', 'pin-active'],
    ['このタブ固定', 'pin-active'],
    // mute-toggle explicit audio intents
    ['make it quiet', 'mute-toggle'], ['ミュートにして', 'mute-toggle'],
    ['消音にして', 'mute-toggle'], ['うるさいから消して', 'mute-toggle'],
    // read-aloud
    ['speak it', 'read-aloud'], ['narrate this', 'read-aloud'],
    ['よみあげて', 'read-aloud'], ['音読お願い', 'read-aloud'],
    // volume / reader size
    ['turn it up a notch', 'volume-up'], ['ボリューム上げて', 'volume-up'],
    ['ちょっと大きく', 'reader-size-up'],
    // coexistence: established pins unchanged
    ['silence it', 'close-tab'], ['quiet it', 'close-tab'], ['hush it', 'close-tab'],
    ['shut it up', 'close-tab'], ['shush it', 'close-tab'],
    ['mute that', 'mute-toggle'], ['音消して', 'mute-toggle'], ['静かにして', 'mute-toggle'],
    ['元に戻して', 'reopen-tab'], ['戻してくださいな', 'reopen-tab'],
    ['one tab over', 'tab-relative'], ['tab before this', 'tab-relative'],
    ['the other tab', 'next-tab'], ['隣のタブ', 'next-tab'], ['右のタブ', 'next-tab'],
    ['左のタブ', 'prev-tab'], ['the one before this', 'prev-tab'],
    ['take me back', 'back'], ['bring me back', 'back'], ['step back', 'back'],
    ['戻って', 'back'], ['おい戻れ', 'back'], ['pin this', 'pin-active'],
    ['ピン留めして', 'pin-active'], ['固定しておいて', 'pin-tab'],
    ['read it out', 'read-aloud'], ['朗読して', 'read-aloud'],
    ['louder', 'volume-up'], ['crank it up', 'volume-up'], ['もっと大きく', 'reader-size-up'],
    ['dont let it move', 'negate'], ['move along', 'resume-reading'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
