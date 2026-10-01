import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function makeVc() {
  const tabs = [
    { id: 1, url: 'https://a.example', title: 'Alpha', loading: false },
    { id: 2, url: 'https://b.example', title: 'Beta', loading: false },
  ];
  const tm = {
    tabs,
    activeTabId: 2,
    activeIndex: 1,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    getTab(id) { return this.tabs.find((t) => t.id === id); },
    setActive(i) { this.activeIndex = i; this.activeTabId = this.tabs[i].id; },
  };
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tm);
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('fluorite atom sweep (CCLXXXV)', () => {
  // EN wrap-up / finale frames
  test.each([
    ['wrap up close it', 'close-tab'],
    ['finish up close it', 'close-tab'],
    ['wind down close it', 'close-tab'],
    ['call it a wrap close it', 'close-tab'],
    ['thats a wrap close it', 'close-tab'],
    ['it is a wrap close it', 'close-tab'],
    ['this one is finished', 'close-tab'],
    ['its all over', 'close-tab'],
    ['this ones over', 'close-tab'],
    ['its gone to seed', 'close-tab'],
    ['its run its course', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // EN implore/beseech residue + time-declaim frames
  test.each([
    ['i beg of you close it', 'close-tab'],
    ['i beseech you close it', 'close-tab'],
    ['i entreat you close it', 'close-tab'],
    ['i plead with you close it', 'close-tab'],
    ['i beg ya close it', 'close-tab'],
    ['i beg you one last time close it', 'close-tab'],
    ['its time to close it', 'close-tab'],
    ['its high time', 'close-tab'],
    ['high time it closed', 'close-tab'],
    ['its overdue for closing', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA 決着/仕切り/仕舞い forms
  test.each([
    ['けりつけて', 'close-tab'],
    ['けりをつけて', 'close-tab'],
    ['ケリつけて', 'close-tab'],
    ['けじめつけて', 'close-tab'],
    ['けじめをつけて', 'close-tab'],
    ['仕切って', 'close-tab'],
    ['仕切っちゃって', 'close-tab'],
    ['しめくくって', 'close-tab'],
    ['締めくくって', 'close-tab'],
    ['仕上げて', 'close-tab'],
    ['仕上げちゃって', 'close-tab'],
    ['これで仕舞い', 'close-tab'],
    ['もう仕舞い', 'close-tab'],
    ['仕舞いにして', 'close-tab'],
    ['お仕舞いにして', 'close-tab'],
    ['お仕舞いにしましょう', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA くれ residue, relayed-directive reports, urgency adverbs
  test.each([
    ['閉じてくれよぉ', 'close-tab'],
    ['閉じてくれぇ', 'close-tab'],
    ['閉じてくれよおまえ', 'close-tab'],
    ['閉じてくれよお前', 'close-tab'],
    ['閉じてくれりゃあ', 'close-tab'],
    ['閉じるとのお達し', 'close-tab'],
    ['閉じるとの命', 'close-tab'],
    ['閉じるのが決まり', 'close-tab'],
    ['閉じるよう指示', 'close-tab'],
    ['閉じるよう指示が', 'close-tab'],
    ['閉じるように言われてる', 'close-tab'],
    ['今直ぐ閉じて', 'close-tab'],
    ['至急に閉じて', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // volume-status query forms + scroll direction literals
  test.each([
    ['whats it at volume', 'volume-status'],
    ['volume at what', 'volume-status'],
    ['whats my volume', 'volume-status'],
    ['どのくらい音量', 'volume-status'],
    ['音量どれくらい', 'volume-status'],
    ['音量はどれくらい', 'volume-status'],
    ['音量どのくらい', 'volume-status'],
    ['下へスクロール', 'scroll-down'],
    ['上へスクロール', 'scroll-up'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Honest-null pins: 'スクロール止めて' has no stop-scroll surface.
  test.each([
    ['スクロール止めて'],
    ['スクロール停止'],
  ])('%s -> null', (p) => {
    expect(key(makeVc(), p)).toBeNull();
  });
});
