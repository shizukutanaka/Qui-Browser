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

describe('quill atom sweep — pass CCXXVIII', () => {
  it.each([
    // EN gerunds/disposal + deixis + tag tails + op frames
    'closing it', 'closing the tab', 'closing this one',
    'shutting it', 'shutting this', 'getting rid of it',
    'getting rid of this', 'dumping it', 'ditching it',
    'axing it', 'binning it', 'scrapping it', 'tossing it',
    'chucking it', 'junking it', 'trashing it', 'zapping it',
    'nuking it', 'that tabs gotta go', 'that one goes',
    'this ones done', 'this tabs over', 'that page is done',
    'this ones finished', 'its a goner', 'this ones a goner',
    'dead tab', 'dead page', 'gone page', 'tab down',
    'tab out', 'tab away', 'tab gone', 'tab off', 'tab shut',
    'tab closed', 'close the other one', 'close this one here',
    'close it will ya', 'close it would ya', 'close it why dontcha',
    'close it wontcha', 'close it couldya', 'close it wouldja',
    'close it pleaseplease', 'close it yeah', 'close it yep',
    'you were gonna close it', 'you said youd close it',
    'you promised', 'you said you would', 'you told me youd close it',
    'make with the closing', 'commence closing', 'begin closing',
    'proceed to close it', 'go ahead with the close',
    'initiate close', 'execute close', 'perform the close',
    'operation close tab', 'mission close tab', 'task close it',
    'closing time', 'closing hour', 'its closing time',
    'last call', 'final boarding',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA stem imperatives IV + misc literals
    '閉じなんぜ', '閉じなんぜよ', '閉じましゅ', '閉じてんや', '閉じてみようぜ',
    // JA て-tail pushes V
    '閉じちゃえば', '閉じちゃったら', '閉じといたれ',
    '閉じときやれ', '閉じとけや', '閉じてみよ', '閉じてぷりーず',
    '閉じてもん',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA progressive reports -> describe-tab
    '閉じてるのに', '閉じてるから', '閉じてるんで', '閉じてるんだ',
    '閉じてるんだが', '閉じてるんだよ', '閉じてるのよ',
    '閉じてるのね', '閉じてるのさ', '閉じてるわよ', '閉じてるし',
    '閉じてるって', '閉じてるからね', '閉じてるもん',
    '閉じてるもんね', '閉じてるじゃん', '閉じてるじゃんね',
    '閉じてるんだっけ', '閉じてるっけ', '閉じてるかも',
    '閉じてるかもね', '閉じてるのか', '閉じてるの',
    '閉じとるで', '閉じよるよ', '閉じよるわ', '閉じよるね',
    '閉じちょるで', '閉じとう', '閉じとうよ', '閉じとうぜ',
    '閉じとうね', '閉じとんねん', '閉じてんねん',
    '閉じてんねんけど', '閉じてんねんで', '閉じられてる',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA Kansai not-done + inability + violated expectation -> trouble
    '閉じてんのに', '閉じてるはずなのに', '閉じてへんねん',
    '閉じてへんやん', '閉じてへんで', '閉じらんない',
  ])('JA %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });
});
