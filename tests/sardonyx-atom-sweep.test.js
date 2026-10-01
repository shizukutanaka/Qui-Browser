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

describe('sardonyx atom sweep (CCLXXXIV)', () => {
  // EN again/for-sure/re-close tails
  test.each([
    ['re-close it', 'close-tab'],
    ['reclose it', 'close-tab'],
    ['close it should ya', 'close-tab'],
    ['close it wont ya', 'close-tab'],
    ['close it may i ask', 'close-tab'],
    ['for the umpteenth time close it', 'close-tab'],
    ['how many more times close it', 'close-tab'],
    ['once and for all close it', 'close-tab'],
    ['permanently close it', 'close-tab'],
    ['close it definitely', 'close-tab'],
    ['close it absolutely', 'close-tab'],
    ['positively close it', 'close-tab'],
    ['for sure close it', 'close-tab'],
    ['close it for sure', 'close-tab'],
    ['no doubt close it', 'close-tab'],
    ['obviously close it', 'close-tab'],
    ['clearly close it', 'close-tab'],
    ['evidently close it', 'close-tab'],
    ['apparently close it', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA potential-request and Kansai くんな/まへん tails
  test.each([
    ['閉じれませんか', 'close-tab'],
    ['閉じてもらいましょうか', 'close-tab'],
    ['閉じまへんか', 'close-tab'],
    ['閉じてくんない', 'close-tab'],
    ['閉じてくんね', 'close-tab'],
    ['閉じてくんま', 'close-tab'],
    ['閉じてくんまし', 'close-tab'],
    ['閉じてくんかい', 'close-tab'],
    ['閉じてくんなはれ', 'close-tab'],
    ['閉じてくんなまし', 'close-tab'],
    ['閉じてくんない？', 'close-tab'],
    ['閉じてくんね？', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA bulk/positional close fills
  test.each([
    ['同じタブ閉じて', 'close-duplicate-tabs'],
    ['かぶってるタブ閉じて', 'close-duplicate-tabs'],
    ['かぶってるタブを閉じて', 'close-duplicate-tabs'],
    ['ピンしてないの閉じて', 'close-unpinned-tabs'],
    ['ピンしてないタブ閉じて', 'close-unpinned-tabs'],
    ['ピン留めされてないタブ閉じて', 'close-unpinned-tabs'],
    ['右のタブ閉じて', 'close-tabs-right'],
    ['右にあるタブ閉じて', 'close-tabs-right'],
    ['左のタブ閉じて', 'close-tabs-left'],
    ['左にあるタブ閉じて', 'close-tabs-left'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA duplicate/refresh/trouble fills
  test.each([
    ['もう一枚同じの', 'duplicate-tab'],
    ['同じタブもう一枚', 'duplicate-tab'],
    ['このタブコピー', 'duplicate-tab'],
    ['タブコピーして', 'duplicate-tab'],
    ['このタブコピーして', 'duplicate-tab'],
    ['再読込して', 'refresh'],
    ['ページリロード', 'refresh'],
    ['タブをリロード', 'refresh'],
    ['タブをリロードして', 'refresh'],
    ['リロードしてページ', 'refresh'],
    ['音聞こえない', 'audio-trouble'],
    ['音がきこえない', 'audio-trouble'],
    ['再生されない', 'trouble'],
    ['動画見れない', 'trouble'],
    ['動画が見れない', 'trouble'],
    ['ビデオ見れない', 'trouble'],
    ['オフラインになった', 'online-status'],
    ['接続切れた', 'online-status'],
    ['接続が切れた', 'online-status'],
    ['繋がらなくなった', 'online-status'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Misroute-fix regression: 'wont ya' is a request, not a refusal report.
  // Capability questions stay with help (established pins in earlier suites).
  test.each([
    ['close it wont ya', 'close-tab'],
    ['wont you close it', 'close-tab'],
    ['閉じれますか', 'help'],
    ['閉じられますか', 'help'],
    ['this wont close', 'trouble'],
    ['it wont die', 'trouble'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Honest-null pins: potential/capability reports, rare dialect tails,
  // and ambiguous positional forms stay unrouted.
  test.each([
    ['閉じれる？'],
    ['閉じれる'],
    ['閉じれない？'],
    ['閉じれるようにして'],
    ['閉じれるように'],
    ['閉じまんも'],
    ['閉じまんな'],
    ['閉じまんなって'],
    ['閉じてちょんまげ'],
    ['前のタブ閉じて'],
    ['更新してページ'],
    ['for good close it'],
  ])('%s -> null', (p) => {
    expect(key(makeVc(), p)).toBeNull();
  });
});
