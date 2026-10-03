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
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};
const key = (vc, p) => { vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : null; };

describe('quartz atom sweep — pass CCXXXVII', () => {
  test.each([
    'scuttle it', 'scuttle the tab', 'send it overboard',
    'overboard with it', 'keelhaul it', 'keelhaul the tab',
    'walk the plank', 'make it walk the plank',
    'make the tab walk the plank', 'jettison it out the airlock',
    'deep-six the tab', 'deep-six it', 'six feet under it',
    'take care of that tab', 'take care of the tab',
    'see to it', 'do the honors', 'do the honours', 'have at it',
    'be my guest', 'be my guest and close it', 'attend to it',
    'wind it down', 'wind it up', 'wrap it', 'wrap this tab up',
    'strike it from the record', 'scratch that tab', 'cross it off',
    'tick it off', 'check it off', 'mark it done', 'mark it as done',
    'wave it goodbye', 'wave goodbye to the tab', 'blow it a kiss',
    'pour one out', 'pour one out for the tab', 'one for the road',
    'done here', 'we are done here',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  test.each([
    'sayonara', 'au revoir', 'arrivederci', 'tschuss', 'auf wiedersehen',
    'farewell', 'vaya con dios', 'bye now', 'so long',
  ])('EN farewell %s -> vr-exit', (p) => {
    expect(key(mk(), p)).toBe('vr-exit');
  });

  test.each([
    '閉じなんし', '閉じたまふ', '閉じしんしゃん', '閉じたあ',
    '閉じちゃき', '閉じとーちゃ', '閉じとうちゃ', '閉じてなぁ',
    '閉じちょーだい', '閉じちょうだいね', '閉じておきやれ', '閉じときゃー',
    '閉じとりゃー', '閉じとりゃあ', '閉じとれや', '閉じとりな',
    '閉じまくれ', '閉じまくりな', '閉じんさる', '閉じんちゃう',
    '閉じるんじゃが', '閉じとこうや', '閉じとこうやないか',
    '閉じましょうが', '閉じまひょ', '閉じましょな',
    '閉じるっきゃねえ', '閉じるっきゃないね', '閉じるしかあるまえ',
    '閉じる一択だ', '閉じる一択しかない', '閉じる以外ない',
    '閉じるが勝ち', '閉じるのが勝ち', '閉じるが正義', '閉じるが本懐',
    '閉じるが順当', '閉じるが妥当', '閉じるが自然', '閉じるが妥当だろう',
    '閉じるが得策だ', '閉じるが最善だ', '閉じるが正解',
    '閉じざるべき', '閉じざるを得ん', '閉じざるをえん',
    '閉じざるをえぬ', '閉じざるしかない',
    '閉じないと困ります', '閉じないとだめなんだ', '閉じないとまずい',
    '閉じなきゃならんのだ', '閉じなきゃいかんのだ', '閉じなきゃならんのだが',
    '閉じなきゃまずい', '閉じなきゃ困るよ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  test.each([
    '閉じるっちゅうのに', '閉じるっていったのに', '閉じると言ったのに',
  ])('JA %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });
});

const mkB = () => {
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
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};
const keyB = (vc, p) => { vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : null; };

describe('quartz atom sweep — pass CCXXXVII', () => {
  test.each([
    'scuttle it', 'scuttle the tab', 'send it overboard',
    'overboard with it', 'keelhaul it', 'keelhaul the tab',
    'walk the plank', 'make it walk the plank',
    'make the tab walk the plank', 'jettison it out the airlock',
    'deep-six the tab', 'deep-six it', 'six feet under it',
    'take care of that tab', 'take care of the tab',
    'see to it', 'do the honors', 'do the honours', 'have at it',
    'be my guest', 'be my guest and close it', 'attend to it',
    'wind it down', 'wind it up', 'wrap it', 'wrap this tab up',
    'strike it from the record', 'scratch that tab', 'cross it off',
    'tick it off', 'check it off', 'mark it done', 'mark it as done',
    'wave it goodbye', 'wave goodbye to the tab', 'blow it a kiss',
    'pour one out', 'pour one out for the tab', 'one for the road',
    'done here', 'we are done here',
  ])('EN %s -> close-tab', (p) => {
    expect(keyB(mkB(), p)).toBe('close-tab');
  });

  test.each([
    'sayonara', 'au revoir', 'arrivederci', 'tschuss', 'auf wiedersehen',
    'farewell', 'vaya con dios', 'bye now', 'so long',
  ])('EN farewell %s -> vr-exit', (p) => {
    expect(keyB(mkB(), p)).toBe('vr-exit');
  });

  test.each([
    '閉じなんし', '閉じたまふ', '閉じしんしゃん', '閉じたあ',
    '閉じちゃき', '閉じとーちゃ', '閉じとうちゃ', '閉じてなぁ',
    '閉じちょーだい', '閉じちょうだいね', '閉じておきやれ', '閉じときゃー',
    '閉じとりゃー', '閉じとりゃあ', '閉じとれや', '閉じとりな',
    '閉じまくれ', '閉じまくりな', '閉じんさる', '閉じんちゃう',
    '閉じるんじゃが', '閉じとこうや', '閉じとこうやないか',
    '閉じましょうが', '閉じまひょ', '閉じましょな',
    '閉じるっきゃねえ', '閉じるっきゃないね', '閉じるしかあるまえ',
    '閉じる一択だ', '閉じる一択しかない', '閉じる以外ない',
    '閉じるが勝ち', '閉じるのが勝ち', '閉じるが正義', '閉じるが本懐',
    '閉じるが順当', '閉じるが妥当', '閉じるが自然', '閉じるが妥当だろう',
    '閉じるが得策だ', '閉じるが最善だ', '閉じるが正解',
    '閉じざるべき', '閉じざるを得ん', '閉じざるをえん',
    '閉じざるをえぬ', '閉じざるしかない',
    '閉じないと困ります', '閉じないとだめなんだ', '閉じないとまずい',
    '閉じなきゃならんのだ', '閉じなきゃいかんのだ', '閉じなきゃならんのだが',
    '閉じなきゃまずい', '閉じなきゃ困るよ',
  ])('JA %s -> close-tab', (p) => {
    expect(keyB(mkB(), p)).toBe('close-tab');
  });

  test.each([
    '閉じるっちゅうのに', '閉じるっていったのに', '閉じると言ったのに',
  ])('JA %s -> trouble', (p) => {
    expect(keyB(mkB(), p)).toBe('trouble');
  });
});
