// Pass CXCI — casual disposal verbs (Reddit/chat register), close-all idioms,
// JA dialect residue (じゃい/まえよう/ておいちゃ/ちゃうけど/てしまう+particle),
// dict noun-tail XXX (canonical-path nouns), close-intent politeness shadowing negate.
import { describe, it, expect } from '@jest/globals';
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'},{id:'t2',title:'Y',url:'https://y'},{id:'t3',title:'Z',url:'https://z'}],
    getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;}, closeTab(){}, pinTab(){}, closeOtherTabs(){} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};
const route = (p) => { const vc = mk(); vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : null; };

const CASES = [
  // casual disposal verbs → close-tab
  ['bin this', 'close-tab'], ['chuck it', 'close-tab'], ['chuck this', 'close-tab'],
  ['junk it', 'close-tab'], ['zap it', 'close-tab'], ['dump that', 'close-tab'],
  ['toss it', 'close-tab'], ['bin the tab', 'close-tab'], ['chuck the tab', 'close-tab'],
  ['kill the tab', 'close-tab'], ['axe the tab', 'close-tab'],
  ['shut the tab down', 'close-tab'], ['shut the tab up', 'close-tab'],
  ['put this to bed', 'close-tab'], ['finish it off', 'close-tab'], ['finish this off', 'close-tab'],
  ['sweep it away', 'close-tab'], ['sweep it off', 'close-tab'], ['wipe it out', 'close-tab'],
  ['wipe it away', 'close-tab'], ['strike it down', 'close-tab'], ['tie it off', 'close-tab'],
  ['lose the tab', 'close-tab'], ['take it away', 'close-tab'], ['take it out', 'close-tab'],
  ['take it down', 'close-tab'], ['take the tab down', 'close-tab'],
  ['i want it dead', 'close-tab'], ['get rid of that', 'close-tab'],
  ['get it out of here', 'close-tab'], ['get it outta here', 'close-tab'],
  ['close it like right now', 'close-tab'],
  // dismissive cancel → negate (NOT close)
  ['screw it', 'negate'], ['screw that', 'negate'], ['nix it', 'negate'],
  // casual close-all idioms → close-all-tabs
  ['bin all the tabs', 'close-all-tabs'], ['kill all the tabs', 'close-all-tabs'],
  ['shut all the tabs', 'close-all-tabs'], ['nuke the tabs', 'close-all-tabs'],
  ['nuke all the tabs', 'close-all-tabs'], ['wipe all tabs', 'close-all-tabs'],
  ['wipe all the tabs', 'close-all-tabs'], ['clear all tabs', 'close-all-tabs'],
  ['clear the tabs', 'close-all-tabs'], ['close every single tab', 'close-all-tabs'],
  ['chuck all the tabs', 'close-all-tabs'], ['ditch all the tabs', 'close-all-tabs'],
  // close-intent JA politeness (negate の複写リテラルを close-tab が先勝ちで正当ルート)
  ['廃棄してください', 'close-tab'], ['破棄してください', 'close-tab'],
  ['閉じる操作をして', 'close-tab'], ['タブの閉鎖を願います', 'close-tab'],
  // JA dialect/volitional residue → close-tab
  ['閉じじゃい', 'close-tab'], ['閉じてまえよう', 'close-tab'], ['閉じておいちゃって', 'close-tab'],
  ['閉じておいちゃう', 'close-tab'], ['閉じちゃうけど', 'close-tab'], ['閉じちゃうけどね', 'close-tab'],
  ['閉じてしまうよ', 'close-tab'], ['閉じてしまうね', 'close-tab'], ['閉じてしまうわ', 'close-tab'],
  ['閉じてまいなさい', 'close-tab'],
  // dict noun-tail XXX (canonical-path nouns)
  ['閉じるのが案内です', 'close-tab'], ['閉じるのが定石です', 'close-tab'],
  ['閉じるのが鉄則です', 'close-tab'], ['閉じるのが掟です', 'close-tab'],
  ['閉じるのが常道です', 'close-tab'], ['閉じるのが正道です', 'close-tab'],
  ['閉じるのが定番です', 'close-tab'], ['閉じるのが本道です', 'close-tab'],
  ['閉じるのが王道です', 'close-tab'], ['閉じるのが最善です', 'close-tab'],
  ['閉じるのが常套です', 'close-tab'], ['閉じるのが定石ですね', 'close-tab'],
];
describe('casual-disposal atoms CXCI', () => {
  it.each(CASES)('%s → %s', (phrase, expected) => {
    expect(route(phrase)).toBe(expected);
  });
});
