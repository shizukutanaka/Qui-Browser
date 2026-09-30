// Pass CCI — mason atom sweep: EN rhetorical challenges + ultimatum/finality
// + exasperated persistence (trouble); JA quotative imperatives + intent/
// proposal/insistence tails + 忘れ残置 III + capability-question のか forms.
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

describe('mason atom sweep (CCI)', () => {
  it.each([
    // EN rhetorical challenges -> close-tab
    'what part of close it dont you get',
    'how hard is it to close it',
    'how many times do i have to say close it',
    'is it really that hard to close it',
    'am i asking too much close it', 'was i unclear close it',
    'did i stutter close it', 'do you need it in writing close it',
    'want me to say it again close it',
  ])('rhetorical %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN ultimatum / finality -> close-tab
    'this is your last chance close it', 'last warning close it',
    'final warning close it', 'close it or else',
    'close it or so help me', 'close it or ill do it myself',
    'close it or were done', 'close it or i swear',
    'close it and thats final', 'close it and thats that',
    'close it period', 'close it end of story',
    'close it end of discussion', 'close it no ifs ands or buts',
    'close it no arguments', 'close it no debate',
    'close it no questions', 'close it dont argue',
    'close it dont fight me on this',
    'close it and dont make me ask again',
  ])('ultimatum %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN exasperated persistence -> trouble
    'it wont close', 'it just wont close', 'why wont it close',
    'how come it wont close', 'it refuses to close',
    'it keeps reopening', 'it keeps coming back up',
    'it wont go away', 'it wont die', 'it just wont die',
    'this wont close', 'this just wont close', 'this wont go away',
    '閉じないのかよ', '閉じないわけ', '閉じへんのか', '閉じへんわけ',
  ])('exasperated %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // JA quotative imperatives -> close-tab
    '閉じろと言ってる', '閉じろと言った', '閉じろと言ったはず',
    '閉じろといったんだ', '閉じろって言ってんだよ', '閉じろって言ったろ',
    '閉じろと言ったでしょ', '閉じろと申しております', '閉じろと命じます',
    '閉じろを命じる', '閉じろって何回言う', '閉じろと再三言った',
    '閉じなさいと言った', '閉じなさいってば', '閉じなさいよね',
  ])('JA quotative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA intent/proposal/nudge -> close-tab
    '閉じる気ある', '閉じる気はある', '閉じるつもりある',
    '閉じるつもりはあるの', '閉じるのかよ', '閉じるかね',
    '閉じちゃうか', '閉じちゃおうか', '閉じちゃうかな',
    '閉じちゃおうかな', '閉じちゃおうかしら', '閉じちゃいますか',
    '閉じちゃうよね', '閉じちゃうね', '閉じちゃうかしらね',
    '閉じようかしら', '閉じるかしら', '閉じましょうかね',
    '閉じましょうかな', '閉じますかね',
  ])('JA proposal %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA insistence / repeated-plea -> close-tab
    '閉じてほしいって何度も', '閉じてって何回も言ってる',
    '閉じてとお願いしてる', '閉じてと頼んでる', '閉じてと頼んでます',
    '閉じてと言ったのに', '閉じてと言いました', '閉じてと言っている',
    '閉じてと何度も言った', '閉じてと再三お願い',
  ])('JA insistence %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA forgot reports III -> close-tab
    '閉じるの忘れそう', '閉じ忘れそうだった', '閉じ忘れてしまった',
    '閉じ忘れちゃった', '閉じるの忘れちゃった', '閉じるの忘れてしまった',
    '閉じるの忘れちゃいました',
  ])('JA forgot %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // capability questions -> help
    '閉じられるのか', '閉じれるのか', '開けられるのか', '閉じるかどうか',
  ])('capability %s -> help', (p) => {
    expect(key(mk(), p)).toBe('help');
  });

  it.each([
    // established pins kept
    ['do i have to spell it out close it', 'help'],   // do-i interrogative raw hit
    ['do i look like im joking close it', 'help'],
    ['shall i repeat myself close it', 'help'],
    ['must i repeat close it', 'say-again'],           // repeat keyword
    ['close it or else what', null],                   // sass-back, ambiguous
    ['閉じないんか', 'negate'],                         // ない literal family
    ['閉じなくていいやつ', 'negate'],
    ['閉じるなよ絶対', 'negate'],                       // reversed emphatic
    ['絶対閉じるな', 'negate'],
    ['絶対に閉じるな', 'negate'],
    ['閉じちゃダメ絶対', 'negate'],
    ['閉じっぱでいい', null],                           // ambiguous: closed vs left-open
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
