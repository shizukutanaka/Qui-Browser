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

describe('xenon atom sweep — pass CCXXXV', () => {
  it.each([
    // EN sleep/expiry/mob-slang + dead-weight
    'put the tab to sleep', 'put it to rest',
    'it has run its course', 'run its course',
    'the tab ran its course', 'the tab is spent',
    'the tab is used up', 'the tab is old news',
    'the tab is stale', 'stale tab',
    'the tab is dead weight', 'dead weight',
    'the tab is baggage', 'excess baggage', 'drop the baggage',
    'the tab is deadwood', 'deadwood',
    'i outgrew the tab', 'outgrew it',
    'the tab outlived its usefulness', 'outlived its usefulness',
    'the tab expired', 'the tab is expired',
    'its past its expiration', 'past the sell by date',
    'the tab is garbage', 'its garbage', 'its trash',
    'the tab is waste', 'waste of memory',
    'clear the decks', 'clear the deck', 'wipe the slate clean',
    'the tab is dust', 'bite the dust', 'the tab bit the dust',
    'the tab pushed up daisies', 'pushing up daisies',
    'the tab met its maker', 'the tab flatlined', 'flatlined',
    'pull the plug on the tab', 'unplug it',
    'the tab kicked it', 'the tab is dunzo', 'dunzo',
    'the tab is donezo', 'donezo',
    'the tab is worm food', 'worm food',
    'hatchet the tab', 'rub out the tab', 'rub it out',
    'whack the tab', 'whack it',
    'waste the tab', 'waste it', 'snuff the tab', 'snuff it',
    'snuff out the tab', 'snuff it out',
    'the tab sleeps with the fishes', 'sleeps with the fishes',
    'the tab takes a dirt nap', 'dirt nap', 'takes a dirt nap',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dialect residue VI + volitional
    '閉じてーよ', '閉じるでな', '閉じるでなお',
    '閉じてとくれ', '閉じておくんな', '閉じゃせ', '閉じゃす',
    '閉じでんの', '閉じてでんの', '閉じばい',
    '閉じておくから', '閉じけんな', '閉じんかい',
    '閉じるもんだよ', '閉じもんかい',
    '閉じてーから', '閉じてえから',
    '閉じゃれ', '閉じるやろう', '閉じよい',
    '閉じようぜ', '閉じりす', '閉じじゃ',
    '閉じときたいねん', '閉じてみろってば',
    '閉じちまお', '閉じちまおう',
    '閉じるっすか', '閉じるっすかね', '閉じるんでえ',
    '閉じてほすい', '閉じてもらいたか', '閉じてもらいたかね',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA progressive/state reports II -> describe-tab
    '閉じておるし', '閉じてあるし', '閉じてたし',
    '閉じてんかな', '閉じてるべ', '閉じてるず',
    '閉じてますやん', '閉じてんだもん',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA るのに/れないのに complaints -> trouble
    '閉じるのに', '閉じれないのに', '閉じれるのに',
  ])('JA %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });
});
