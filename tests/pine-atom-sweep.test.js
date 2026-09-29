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

describe('pine atom sweep — pass CCXXVII', () => {
  it.each([
    // EN reliance + relative clauses + slam-verbs + intent question
    'im counting on you', 'im relying on you', 'im depending on you',
    'the tab i want closed', 'the tab i asked you to close',
    'the tab i told you about', 'the one i want gone',
    'the tab we talked about', 'the tab i was on',
    'the tab i just had',
    'shut it tight', 'close it tight', 'slam it closed',
    'bang it shut', 'click it shut', 'flick it closed',
    'nail it shut', 'seal it tight',
    'are you gonna close it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN not-done reproaches -> trouble
    'you still havent closed it', 'you havent closed it yet',
    'you never closed it', 'you forgot to close it',
    'you didnt close it', 'you wouldnt close it',
  ])('EN %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // JA negate-fix + decision/verdict declaratives II
    '閉じてくださいまへん', '閉じてくれないんだ',
    '閉じるつもりなんだが', '閉じることになる',
    '閉じることになりそう', '閉じることになりました',
    '閉じることに決まり', '閉じることに決まりました',
    '閉じるのは決まり', '閉じるのは決まりました',
    '閉じるしかなさそ', '閉じるしかなさそう',
    '閉じるべきかもね',
    '閉じることにしたよ', '閉じることにしたんだ',
    // JA て-tail pushes IV
    '閉じてもらおうと', '閉じてもらうとかして',
    // JA not-done report
    '閉じてないよ',
  ])('JA %s -> close-tab', (p) => {
    if (p === '閉じてないよ') {
      expect(key(mk(), p)).toBe('trouble');
    } else {
      expect(key(mk(), p)).toBe('close-tab');
    }
  });

  it.each([
    // JA accident variants -> reopen-tab
    '閉じられちゃった', '閉じられてしまった', '閉じてしまいましたが',
  ])('JA %s -> reopen-tab', (p) => {
    expect(key(mk(), p)).toBe('reopen-tab');
  });

  it.each([
    // JA past-benefactive completion reports -> describe-tab
    '閉じてもらったよ', '閉じてもらったんだ', '閉じてくれた',
    '閉じてくれたよ', '閉じてくれたんだ', '閉じてくれてありがとう',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA べき deliberative questions -> help
    '閉じるべきなんかな', '閉じるべきなのかな', '閉じるべきなのか',
  ])('JA %s -> help', (p) => {
    expect(key(mk(), p)).toBe('help');
  });
});
