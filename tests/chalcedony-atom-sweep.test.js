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

describe('chalcedony atom sweep (CCLXXXII)', () => {
  // EN timing / concessive frames that still mean "do it now"
  test.each([
    ['at your leisure close it', 'close-tab'],
    ['no rush close it', 'close-tab'],
    ['if you get a moment close it', 'close-tab'],
    ['do the needful and close it', 'close-tab'],
    ['close it if you get a chance', 'close-tab'],
    ['when ready close it', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Deferral requests route to the honest defer atom, never execute
  test.each([
    ['later close it', 'defer'],
    ['eventually close it', 'defer'],
    ['close it eventually', 'defer'],
    ['close it someday', 'defer'],
    ['whenever works close it', 'defer'],
    ['close it at some point', 'defer'],
    ['time permitting close it', 'defer'],
    ['close it later', 'defer'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // EN contraction queries
  test.each([
    ['wheres the url', 'read-url'],
    ['hows the volume', 'volume-status'],
    ['whatre my tabs', 'tabs-list'],
    ['whatre the tabs', 'tabs-list'],
    ['howre the tabs', 'tabs-list'],
    ['wheres my tab', 'describe-tab'],
    ['wheres the bookmark', 'bookmark-status'],
    ['whatve i got open', 'tabs-list'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA regional request tails (Kyushu くれん/んさい/みり/ちょって/もす, Kansai なはれ)
  test.each([
    ['閉じってくれ', 'close-tab'],
    ['閉じちょって', 'close-tab'],
    ['閉じもす', 'close-tab'],
    ['閉じみる', 'close-tab'],
    ['閉じてみり', 'close-tab'],
    ['閉じなはれや', 'close-tab'],
    ['閉じてて', 'close-tab'],
    ['読んでみり', 'read-aloud'],
    ['読んでいて', 'read-aloud'],
    ['読んでてお願い', 'read-aloud'],
    ['戻ってみり', 'back'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Tab count queries — must not hit tab-by-name search
  test.each([
    ['タブ何枚', 'tab-status'],
    ['今何枚', 'tab-status'],
    ['タブ枚数', 'tab-status'],
    ['何タブある', 'tab-status'],
    ['何タブ開いてる', 'tab-status'],
    ['タブ全部でいくつ', 'tab-status'],
    ['何枚のタブ', 'tab-status'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Find status / clear
  test.each([
    ['検索結果何件', 'find-status'],
    ['何件あった', 'find-status'],
    ['マッチはいくつ', 'find-status'],
    ['検索いくつ', 'find-status'],
    ['検索消して', 'clear-find'],
    ['検索とめて', 'clear-find'],
    ['クリアして検索', 'clear-find'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Active-tab queries
  test.each([
    ['どのタブ見てる', 'describe-tab'],
    ['アクティブなタブは', 'describe-tab'],
    ['アクティブはどれ', 'describe-tab'],
    ['どれが開いてる', 'describe-tab'],
    ['今どのタブ', 'where-am-i'],
    ['今見てるタブ', 'describe-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Reading / video / misc fills
  test.each([
    ['ひらがなで読んで', 'read-aloud'],
    ['カタカナで読んで', 'read-aloud'],
    ['もういっぺん', 'repeat-command'],
    ['もいっぺん', 'repeat-command'],
    ['倍速で読んで', 'speech-rate-set'],
    ['動画の音消して', 'mute-toggle'],
    ['飛ばして次', 'next-paragraph'],
    ['スキップして次', 'next-paragraph'],
    ['video louder', 'volume-up'],
    ['louder video', 'volume-up'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Honest-null pins: ambiguous forms stay unrouted
  test.each([
    ['とばして'],
    ['戻っていて'],
    ['開いていて'],
    ['skip the rest'],
  ])('%s -> null', (p) => {
    expect(key(makeVc(), p)).toBeNull();
  });
});
