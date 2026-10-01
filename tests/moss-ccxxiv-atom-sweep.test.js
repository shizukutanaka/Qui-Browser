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

describe('moss atom sweep — pass CCXXIV', () => {
  it.each([
    // EN politeness tags II (inverted modals / bare tags)
    'close it if you will', 'close it will you', 'close it wont you',
    'close it would you', 'close it shall we', 'close it might you',
    'close it may you', 'close it dare you', 'close it must you',
    // EN conditionals / discretion
    'close it if needed', 'close it if necessary', 'close it if required',
    'close it as needed', 'close it at will', 'close it as you see fit',
    'close it as you wish', 'close it whenever you like',
    'close it at leisure', 'close it at convenience',
    // EN temporal tails
    'close it sometime soon', 'close it afterwards', 'close it then',
    'close it next', 'close it after this', 'close it after reading',
    'close it once read', 'close it before bed', 'close it tonight',
    'close it today', 'close it for now', 'close it for today',
    // EN sake/purpose/favor tails
    'close it for good measure', 'close it to be sure',
    'close it to be safe', 'close it for safety', 'close it for them',
    'close it for everyone', 'close it as a favor',
    'close it one last time', 'close it one final time',
    'close it out of kindness', 'close it out of pity',
    'close it for the love', 'close it for the sake',
    'close it for your own good', 'close it for its own good',
    'close it for the best', 'close it for better', 'close it for worse',
    'close it all around', 'close it for everyone concerned',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dialect imperatives (stem+ん forms + ろ-forms)
    '閉じいん', '閉じんよ', '閉じんや', '閉じやい', '閉じんすい',
    '閉じんせい', '閉じんど', '閉じんなってば', '閉じんちゃ',
    '閉じろや', '閉じろったら', '閉じろったって',
    // JA dialect あげる/たげる + benefactive conditionals
    '閉じたげて', '閉じたげてよ', '閉じたげるわ',
    '閉じてあげればいいのに', '閉じてくれればありがたい',
    // JA eval nouns III + declarative frames
    '閉じるのが懸命', '閉じるが懸命', '閉じた方が懸命',
    '閉じるのが利口', '閉じるが利口', '閉じるのが得策', '閉じるが得策',
    '閉じるのが賢明かも', '閉じるのが道理', '閉じるが道理',
    '閉じるのが常道', '閉じるのが当然の帰結', '閉じるが早い',
    '閉じるのが早い話', '閉じるのが結局', '閉じるのが結局のところ',
    '閉じるべきところ', '閉じるのでいいです', '閉じるが宜しい',
    '閉じることに相違ない', '閉じるに相違ない', '閉じるのでございます',
    '閉じるとするか', '閉じることとする', '閉じちゃおうかなあ',
    // JA て-tail dialect pushes
    '閉じてくださいそうろう', '閉じてくださいせ', '閉じてくだされませ',
    '閉じてほしゅうございますね', '閉じてほしゅうね',
    '閉じてはり', '閉じてすん', '閉じてすんな', '閉じてじゃん',
    '閉じてじゃわ', '閉じてきざい', '閉じてながら', '閉じてえんか',
    '閉じてやがら', '閉じてがも', '閉じてけぇ', '閉じてけえ',
    '閉じてけの', '閉じてけさ', '閉じてくんない', '閉じてくんなよ',
    '閉じてなんね', '閉じてあれよ', '閉じてもろう', '閉じてもろうて',
    '閉じてもろてもええ', '閉じてもろてな', '閉じてもろたらええ',
    '閉じてなー', '閉じてならーん', '閉じてならんか',
    '閉じてくりゃれ', '閉じてくりゃあ', '閉じてくれんのね',
    '閉じておいとき', '閉じておいてー', '閉じてちょき',
    '閉じておくべきでしょう', '閉じておいた方がよろしい',
    '閉じちゃっといて', '閉じといてよ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA prohibition declarations -> negate
    '閉じてはいけない', '閉じてはいけません', '閉じるなんてもってのほか',
    '閉じたらだめ', '閉じてはだめです', '閉じてはあかん',
  ])('JA prohibition %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});
