import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', currentTitle: 'A', currentUrl: 'https://a' },
      { id: 't2', currentTitle: 'B', currentUrl: 'https://b' },
      { id: 't3', currentTitle: 'C', currentUrl: 'https://c' },
    ],
    getActiveTab() { return this.tabs.find((t) => t.id === this.activeTabId); },
    closeAllTabs() { return 3; },
    closeTab() {},
    pinTab() {},
    closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};

const key = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('impost atom sweep — pass CCXX', () => {
  it.each([
    // EN formal directives
    'i demand it be closed', 'you are to close it', 'thou shalt close it',
    // EN immediacy idioms (incl. FR/DE/ES loans)
    'close it immediately if not sooner', 'close it on the double quick',
    'close it in two shakes', 'close it in a heartbeat',
    'close it in a second', 'close it in a minute', 'close it in no time',
    'close it stat pronto', 'close it make it snappy',
    'close it quick sticks', 'close it tout de suite', 'close it schnell',
    'close it vite',
    // EN permanence
    'close it for keeps', 'close it forever', 'close it for ever',
    'close it for all eternity', 'close it eternally',
    // EN fun/dialect + farewell III
    'close it shoo', 'shoo close it', 'shoo tab',
    'off you pop close it', 'okey dokey close it', 'okie dokie close it',
    'righto close it', 'close it for the road',
    'close it done and dusted', 'done and dusted close it',
    'farewell cruel tab', 'close it if you know whats good for you',
    'close it godspeed', 'godspeed close it',
    'au revoir tab', 'arrivederci tab', 'hasta la vista tab',
    'hasta luego tab', 'auf wiedersehen tab', 'bye tab bye',
    'peace out close it', 'close it good riddance',
    'good riddance close it', 'tab dont let the door hit you',
    'dont let the door hit you tab',  // negate misroute fix
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ておく残置
    '閉じておくがいい', '閉じておくとよい', '閉じておくのだ', '閉じておくぞ',
    '閉じておくがええ', '閉じておきますから', '閉じておきますんで',
    '閉じておきますわ', '閉じておきましょうか', '閉じておきたいものだ',
    '閉じておきたいのだが', '閉じておいてええよ', '閉じといておいていいよ',
    // JA 候(Edo)
    '閉じてもらいたく候', '閉じてほしく候', '閉じたく存じ候',
    '閉じてよろしゅうございます', '閉じておくれ候', '閉じるように候',
    // JA dialect
    '閉じてもらうど', '閉じてもらうだ', '閉じてもらわんか',
    '閉じてくれんならん', '閉じとくれたい', '閉じとくれぞ', '閉じとくれたら',
    // JA negate misroute fixes
    '閉じてくれんねん', '閉じてお願いしますな', '閉じてくださいそうな',
    // JA お願い残置
    '閉じてお願いしますぞ', '閉じてお願いしますね', '閉じてお願いしますわ',
    '閉じてお願いしますよ', '閉じてお願いしますって', '閉じてお願いしとります',
    '閉じてお願いしてんの', '閉じてお願いだから', '閉じてお願いだ',
    '閉じてお願いを', '閉じてお頼みします', '閉じてお頼み申します',
    '閉じてお願いさせてください', '閉じてくださいじゃ',
    '閉じてくださいまへんか',
    // JA 筋/conditional-lament
    '閉じてもらうが筋だ', '閉じてくれるのが筋',
    '閉じてくれれば助かるのに', '閉じてくれればなあ',
    '閉じてくれればええのに', '閉じてくれればと思うのに',
    '閉じてくれるなら助かるのに', '閉じてくれるなら助かるけど',
    '閉じてくれるなら幸いだが', '閉じてくれるなら文句ない',
    '閉じてくれるならば助かる',
    // JA desire declarations
    '閉じたいからね', '閉じたいからさ', '閉じたいのですから',
    '閉じたいんですから', '閉じたいんだからね',
    '閉じたくてたまらん', '閉じたくてしょうがない', '閉じたくてしかたない',
    '閉じたい衝動', '閉じたい気分', '閉じたい気持ちが強い',
    '閉じたい一心', '閉じたく思っている', '閉じたく思う',
    '閉じる方が好みだ', '閉じるが好み', '閉じたほうが好みだ',
    '閉じるのが好み',
    // JA しまい/miru残置
    '閉じてしまいませ', '閉じてしまいだまれ', '閉じてしまいだめ',
    '閉じてもうていいよ', '閉じてもうてもええで', '閉じてみなはれ',
    '閉じてみてほしいよ', '閉じてみてくれんか', '閉じてみてもらいたい',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    ['close that tab yonder', 'close-tab'],  // positional 'yonder' is unaddressable; plain close
    ['close that there tab', 'close-tab-by-name'],  // established pin
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
