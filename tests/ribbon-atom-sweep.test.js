// Pass CXCVII — ribbon atom sweep: EN farewell/demise + this-one disposal + state-want
// closers + hurry/permission prefixes; JA ちまう/しまえば/っす request tails + toku
// regret/report tails + dict recommendation nouns XXXVI.
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

describe('ribbon atom sweep (CXCVII)', () => {
  it.each([
    // EN farewell/demise idioms → close-tab
    'sayonara tab', 'adios tab', 'ciao tab', 'ta ta tab', 'toodles tab',
    'bye bye tab', 'goodnight tab', 'night night tab', 'lights out for this tab',
    'lights out tab', 'curtains for this tab', 'curtains tab',
    'thats a wrap on this tab', 'this tab has got to go', 'this ones gotta go',
    'this ones got to go', 'this page has to go', 'this tab needs to die',
    'this tab must die', 'let it die', 'let this tab die', 'it dies now',
    'time for it to die', 'kill it with fire', 'kill it already', 'just kill it',
    'close it already', 'shut it already',
    'end of the road for this tab', 'thats all she wrote for this tab',
    'thats it for this tab', 'were done with this tab', 'were through with this tab',
    'im done with this tab', 'im finished with this tab', 'im through with this tab',
    'im over this tab',
  ])('farewell/demise %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN this-one / this-page disposal → close-tab
    'toss this one', 'yeet this one', 'drop this one', 'kill this one',
    'ice this one', 'smoke this one', 'axe this thing', 'nuke this one',
    'zap this thing', 'bin this page', 'junk this page', 'ditch this page',
    'dump this page', 'trash this page', 'can this page', '86 this page',
    'deep six this page', 'axe this page', 'kill this page', 'end this page',
    'finish this page', 'kill this tab for me', 'close it down for me',
    'shut it down for me', 'end it for me', 'kill it for me',
    'close it on out', 'shut it on down', 'get it closed', 'have it closed',
    'make it closed', 'want it closed', 'need it closed',
    'do away with this tab', 'put it in the bin', 'off with its head',
  ])('this-one/page disposal %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN temporal/emphasis tails II → close-tab
    'close it asf', 'close it fr', 'close it like now', 'close it like yesterday',
    'close it yesterday', 'close it five minutes ago', 'close it instantly',
    'close it at once', 'close it straight away', 'close it this instant',
    'close it this second', 'close it this minute', 'close it right this second',
    'close it posthaste', 'close it on the spot', 'close it in a hurry',
  ])('temporal tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN hurry/permission/report prefixes → close-tab
    'hurry up and close it', 'quit stalling and close it',
    'stop messing around and close it', 'stop dilly dallying and close it',
    'how about you close it', 'hows about you close it', 'what about closing it',
    'how bout you close it', 'how boutcha close it', 'whaddya say close it',
    'what say you close it', 'suppose you could close it', 'suppose youd close it',
    'think you could close it', 'think you can close it',
    'you think you could close it', 'be my guest close it', 'have at it close it',
    'by all means close it',
  ])('hurry/permission prefix %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ちまう/しまえば/っす request tails → close-tab
    '閉じちまったほうがいい', '閉じてしまえばいいんです', '閉じてしまえばいいのでしょう',
    '閉じてしまうべきだな', '閉じてしまうがいいでしょう', '閉じちゃっていいですか',
    '閉じちゃうのもありだね', '閉じちゃうのもいいですね', '閉じちゃう方向でいきましょう',
    '閉じちゃいましょうか', '閉じてもらっていいっすか', '閉じてもらってもいいっすか',
    '閉じてほしいっす', '閉じてくれっす', '閉じてくださいっす', '閉じてもええんすか',
    '閉じとくっす',
  ])('JA ちまう/しまえば/っす tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA とく report/regret tails → close-tab
    '閉じときますんで', '閉じとくんで', '閉じといてんで', '閉じといてんでな',
    '閉じときましょうよ', '閉じときゃよかったのに', '閉じとけばよかった',
    '閉じとくの忘れた', '閉じとくの忘れてた', '閉じとくべきだった',
    '閉じとくべきでした', '閉じとくよ', '閉じとくね', '閉じとくわ',
    // JA benefactive conditional II
    '閉じてくれるとありがたいな', '閉じてくれると助かるな', '閉じてもらえるとありがたいです',
    '閉じてもらえると助かります', '閉じてもらえると嬉しいです', '閉じていただけると助かります',
    '閉じていただければと思います', '閉じていただければ助かります', '閉じていただけたらと思います',
    '閉じてもらえるなら幸いです', '閉じてもらえれば幸いです', '閉じてもらえるならありがたいです',
    '閉じてくれればいいのに', '閉じてくれるとそれでいい', '閉じてくれればそれでいい',
  ])('JA toku/benefactive tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dict tail XXXVI (recommendation/principle nouns) → close-tab
    '閉じるのが良案かと', '閉じるのが妙案かと', '閉じるのが名案でしょう',
    '閉じるのが得策と存じます', '閉じるのが得策かと存じます', '閉じるのが上策と思います',
    '閉じるのが上策かと', '閉じるのが早道かと', '閉じるのが近道ですね',
    '閉じるのが正攻法だと思います', '閉じるのが常套でしょう', '閉じるのが鉄則です',
    '閉じるのが定石かと', '閉じるのが原則です', '閉じるのが規範です',
    '閉じるのがルールです', '閉じるのが慣例です', '閉じるのが常識です',
    '閉じるのが自明です', '閉じるのが明白です', '閉じるのが一目瞭然です',
    '閉じるのが言うまでもありません',
  ])('dict XXXVI %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // Pins kept: 'shut X down' is a vr-exit idiom, not a tab close
    ['shut this thing down', 'vr-exit'],
    ['shut it all down', 'vr-exit'],
    // 'leave it closed' is "keep it closed" → negate stays
    ['leave it closed', 'negate'],
    // 'end of the line' is an End-key caret idiom — caret-edge owns it
    ['end of the line for this tab', 'caret-edge'],
    // 'do it then' alone has no close intent → unrouted
    ['do it then', null],
  ])('pin %s -> %s', (p, k) => {
    expect(key(mk(), p)).toBe(k);
  });
});
