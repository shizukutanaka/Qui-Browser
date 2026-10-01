// Pass CCVII — lintel atom sweep: EN particle-verb/causative residue;
// JA masu-particles + すませ dialect + てあげ/てやり + permission/consent +
// 決定 reports.
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'Alpha', url: 'https://alpha' },
      { id: 't2', title: 'Beta', url: 'https://beta' },
      { id: 't3', title: 'Gamma', url: 'https://gamma' },
    ],
    getActiveTab() { return this.tabs.find(t => t.id === this.activeTabId); },
    closeAllTabs() { return this.tabs.length; },
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('lintel atom sweep (CCVII)', () => {
  it.each([
    // EN particle-verb disposal -> close-tab
    'close it off', 'close it out', 'close it up', 'close it down for me',
    'close it off please', 'close it away', 'close it back', 'close it shut',
    'shut it away', 'shut it off for me', 'shut it down now',
    'seal it off', 'seal it up', 'button it up', 'zip it closed',
    'snap it shut',
  ])('phrasal %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN causative/permissive frames -> close-tab
    'make it close', 'make the tab close', 'make it shut', 'make it go',
    'make that close', 'have it close', 'have it shut', 'have it gone',
    'get it to close', 'get it closed', 'get that closed',
    'get the tab closed', 'let it close', 'let it be closed',
  ])('causative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA masu-particle tail -> close-tab
    '閉じまして', '閉じましょうね', '閉じましょうよ', '閉じましょうぞ',
    '閉じましょうわ', '閉じますよね', '閉じますからね', '閉じますのよ',
    '閉じますとも', '閉じますけどね', '閉じますんで', '閉じますし',
    '閉じますよぞ',
  ])('JA masu %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA すませ/ませ dialect imperatives -> close-tab
    '閉じすませ', '閉じすませて', '閉じしませ', '閉じやして',
  ])('JA dialect %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てあげ/てやり benefactive-giving -> close-tab
    '閉じてあげる', '閉じてあげます', '閉じてあげるよ', '閉じてあげるわ',
    '閉じてあげたら', '閉じてあげちゃう', '閉じてやる', '閉じてやります',
    '閉じてやるよ', '閉じてやるわ', '閉じてやったら', '閉じてやっちゃう',
    '閉じてあげたい', '閉じてあげるつもり', '閉じてあげるね',
  ])('JA giving %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA permission/acceptance reports -> close-tab
    '閉じても構わない', '閉じても構いません', '閉じてもかまわん',
    '閉じてもかまへん', '閉じても大丈夫', '閉じても大丈夫です',
    '閉じていいと思う', '閉じていいと思うよ', '閉じてもいいと思う',
    '閉じていいところ', '閉じていいとこ', '閉じたっていいじゃん',
    '閉じても悪くない', '閉じたほうがいいと思う', '閉じた方がいいと思う',
  ])('JA consent %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA decision reports -> close-tab
    '閉じることに決めた', '閉じることに決めたよ', '閉じることに決定した',
    '閉じると決めた', '閉じると決めたよ', '閉じると決定した',
    '閉じると決めました', '閉じると決めたんだ', '閉じると決めたのです',
  ])('JA decision %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // established pins kept
    ['let it go', 'negate'],           // let-go dismissal -> negate
    ['leave it gone', 'negate'],
    ['shut the thing down', null],     // ambiguous scope (tab vs app)
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
