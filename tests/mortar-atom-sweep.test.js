// Pass CCII — mortar atom sweep: EN farewell/bedtime idioms + immediacy/
// exasperation + hedge inversions; JA conditional-benefactive II + delegation
// tails + thought-it-closed complaints + past-tense status confirmations.
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

describe('mortar atom sweep (CCII)', () => {
  it.each([
    // EN farewell / bedtime idioms -> close-tab
    'the tab goes', 'tab goes', 'gone tab', 'gone with it',
    'bye tab', 'bye bye tab', 'byebye tab', 'later tab',
    'see ya tab', 'sayonara tab', 'adios tab', 'ciao tab',
    'goodnight tab', 'night night tab', 'nighty night tab',
    'tuck it in', 'put it to bed', 'put the tab to bed',
    'tuck the tab in', 'tuck it away',
    'send it off', 'send it away', 'send it home',
    'ship it off', 'march it out',
  ])('farewell %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN immediacy / exasperation -> close-tab
    'finally close it', 'close it finally', 'at last close it',
    'close it at last', 'close it once already', 'close it already',
    'close it jesus', 'close it christ', 'close it damn',
    'close it damn it', 'close it goddamn', 'close it hell',
    'close it for the love of', 'close it would ya', 'close it wouldja',
    'close it you hear', 'close it you hear me', 'close it i said',
    'i said close it', 'i said to close it', 'did i not say close it',
  ])('immediacy %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN hedge inversions -> close-tab
    'maybe just close it', 'maybe close it', 'close it maybe',
    'possibly close it', 'perhaps just close it', 'close it perhaps',
    'probably should close it', 'should probably close it',
    'might just close it', 'could just close it',
    'lets just close it', 'lets go ahead and close it',
    'just go ahead and close it', 'go right ahead close it',
    'please feel free to close it', 'feel free to close it',
  ])('hedge %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA conditional benefactive II -> close-tab
    '閉じてもらえるなら', '閉じてもらえるのであれば',
    '閉じてもらえるのでしたら', '閉じてくれれば',
    '閉じてくれるなら', '閉じてくれればいい',
    '閉じてくれるのであれば', '閉じてもらえるならば',
    '閉じてもらえればと', '閉じてもらうなら',
    '閉じてくれるのなら', '閉じてもらえるのなら',
  ])('JA conditional %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA delegation / relay tails -> close-tab
    '閉じるようお願い', '閉じるようにお願い', '閉じるように言って',
    '閉じるように命じて', '閉じるよう頼む', '閉じるよう頼みます',
    '閉じるように頼む', '閉じるように言っといて',
    '閉じるように言っておいて', '閉じるべくして', '閉じるべく',
    '閉じるべきもの',
  ])('JA delegation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA left-open declarations -> negate
    '閉じなくていい', '閉じなくていいよ', '閉じなくていいです',
    '閉じなくていいの', '閉じなくてもいい', '閉じなくてもいいよ',
    '閉じなくてもいいです', '閉じずにおこう', '閉じないでおこう',
    '閉じないままにしよう', '閉じないままおく', '閉じずにいる',
    '閉じずにいるつもり', '閉じずにおく', '閉じないでおく',
  ])('JA left-open %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  it.each([
    // JA thought-it-closed complaints -> trouble
    '閉じたつもりなのに', '閉じたと思ったのに', '閉じたと思ってた',
    '閉じたはずだったのに', '閉じたはずなのに',
  ])('JA complaint %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // JA past-tense status confirmations -> describe-tab
    '閉じましたか', '閉じましたよね', '閉じたよね', '閉じたかな',
    '閉じましたよ', '閉じてくれましたか', '閉じてくれたよね',
    '閉じましたっけ', '閉じたんだっけ', '閉じられましたか',
    '閉じれましたか', '閉じてもらいましたか',
  ])('JA status-confirm %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // established pins kept
    ['閉じたつもりだった', 'describe-tab'], // believed-closed report -> describe
    ['閉じてもらえましたか', 'close-tab'],  // 受益 request form (established)
    ['閉じられてなかった', null],           // passive-past ambiguity
    ['閉じられてない', null],
    ['閉じていなかった', null],
    ['閉じれてなかった', null],
    ['閉じれてない', null],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
