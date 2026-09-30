// Pass CXCIX — vault atom sweep: EN when/conditional prefixes + hypothetical
// declaratives + want-state literals + be-gone idioms + comprehension-check
// tails; JA accident reports (reopen) + advisory んだ + こそ/のみ/さえ + dict XXXVIII.
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

describe('vault atom sweep (CXCIX)', () => {
  it.each([
    // EN when/conditional frames → close-tab
    'when you get the chance close it', 'when youve got a sec close it',
    'when youre free close it', 'next time you get a chance close it',
    'the next chance you get close it', 'whenever you feel like it close it',
    'when you have a moment close it', 'once youre done close it',
    'after youre done close it', 'as soon as you can close it',
    'first chance you get close it', 'once you get a sec close it',
    'when you get a sec close it', 'when you get the chance close it now',
  ])('when-frame %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN opinion/perspective prefixes → close-tab
    'if you ask me close it', 'if you want my opinion close it',
    'what id do is close it', 'herere what id do close it',
    'if i were you id close it', 'were i you id close it',
  ])('opinion-frame %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN hypothetical/state declaratives → close-tab
    'if it were up to me itd be closed',
    'if it were up to me the tab would be closed',
    'if i had my way itd be closed', 'if i had it my way itd be closed',
    'in an ideal world itd be closed', 'ideally itd be closed',
    'in a perfect world itd be closed', 'if you ask me it should be closed',
    'id like it gone', 'id like it closed', 'id like this closed',
    'we need it closed', 'we want it closed', 'everyone wants it closed',
    'no one wants this tab open', 'nobody wants this open',
    'who needs this tab anyway', 'who needs it anyway',
  ])('declarative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN make-it-so / be-gone idioms → close-tab
    'make it not be open', 'make it not be there',
    'make it so its closed', 'make it so it closes',
    'begone from my sight',
    'away with you tab', 'out of my sight tab', 'out with this tab',
    'remove it from my sight', 'get it out of my sight',
    'handle the tab', 'handle this tab',
    'deal with the tab', 'deal with this tab',
  ])('be-gone %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN comprehension-check / verdict tails → close-tab
    'close it if you get me', 'close it you dig', 'close it you feel me',
    'close it you hear me', 'close it ya feel', 'close it feel me',
    'close it catch my drift', 'close it capisce', 'close it understand',
    'close it got it', 'close it roger that', 'close it copy that',
    'close it know what im saying', 'close it know what i mean',
    'close it you get me', 'close it you get the idea',
    'close it if you catch my drift', 'close it savvy',
  ])('verdict-tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA accident reports → reopen-tab
    '閉じちゃった', '閉じちゃいました', '閉じちゃったんです',
    '閉じてしまいました', '閉じてしまいましたね', '閉じてしまったんです',
    'うっかり閉じた', 'うっかり閉じちゃった', 'つい閉じた',
    'つい閉じちゃった', '思わず閉じた', '間違えて閉じちゃった',
    '間違って閉じてしまった',
  ])('JA accident %s -> reopen-tab', (p) => {
    expect(key(mk(), p)).toBe('reopen-tab');
  });

  it.each([
    // JA passive-permission / desire-report → close-tab
    '閉じられてもいい', '閉じられてもかまいません', '閉じれるもんなら閉じたい',
  ])('JA passive %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA advisory んだ family → close-tab
    '閉じるんだ', '閉じるのだ', '閉じることだ', '閉じるんだよ',
    '閉じるのだよ', '閉じたほうがいいんだ', '閉じたほうがいいのだ',
    '閉じるといいんだ', '閉じるべきだよ', '閉じるべきなんだ',
    '閉じなきゃだよ', '閉じなきゃいけないんだ', '閉じないとだめだよ',
    '閉じないといけないんだ',
  ])('JA advisory %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA emphatic こそ/のみ + さえ conditional → close-tab
    '閉じるこそ', '閉じるのみ', '閉じてのみ', '閉じさえすればいい',
    '閉じてさえもらえば', '閉じてさえもらえれば', '閉じさえしてくれれば',
    '閉じてさえくれれば', '閉じてくれさえすれば',
  ])('JA emphatic %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // dict XXXVIII recommendation nouns → close-tab
    '閉じるのが無難です', '閉じるのが無難だ', '閉じるのが無難でしょう',
    '閉じるのが手堅い', '閉じるのが手堅いです', '閉じるのが確実です',
    '閉じるのが確実だ', '閉じるのが安全です', '閉じるのが安全だ',
    '閉じるのが安心です', '閉じるのが鉄板です', '閉じるのが鉄板だ',
    '閉じるのが定石ですね', '閉じるのが本命です', '閉じるのが本筋です',
    '閉じるのが道理です', '閉じるのが道理でしょう',
    '閉じるのが理にかなってます', '閉じるのが賢明です',
    '閉じるのが賢明だ', '閉じるのが利口です', '閉じるのが利口だ',
  ])('dict %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // established pins kept
    ['閉じられますかね', 'help'],       // capability question → help
    ['閉じられますでしょうか', 'help'],
    ['閉じられるかな', 'help'],
    ['閉じられるでしょうか', 'help'],
    ['閉じれますか', 'help'],
    ['閉じれますかね', 'help'],
    ['handle it', 'ack'],               // vague-verb + it → ack family
    ['deal with it', 'ack'],
    ['sort it out', 'ack'],
    ['fix it', 'trouble'],
    ['閉じるのが理にかないます', 'negate'], // literal ない inside
    ['begone tab', null],                // R242 pin: archaic address, rejected
    ['be gone tab', null],
    ['begone', null],
    ['閉じれるかな', null],             // capability-wonder, ambiguous
    ['閉じてばかりでは', null],         // habitual-critical, ambiguous
    ['閉じるばかり', null],
    ['handle this', null],              // vague object 'this'
    ['deal with this', null],
    ['sort this out', null],
    ['fix this', null],
    ['address this', null],
    ['do something about it', null],
    ['do something with it', null],
    ['something needs to happen to this tab', null],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
