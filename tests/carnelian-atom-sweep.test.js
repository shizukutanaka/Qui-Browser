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

describe('carnelian atom sweep (CCLXXXIII)', () => {
  // EN convenience/courtesy frames that still mean "do it"
  test.each([
    ['when convenient close it', 'close-tab'],
    ['close it when convenient', 'close-tab'],
    ['when it suits you close it', 'close-tab'],
    ['close it when it suits you', 'close-tab'],
    ['if you dont mind too much close it', 'close-tab'],
    ['if its no bother close it', 'close-tab'],
    ['no hurry but close it', 'close-tab'],
    ['take your time but close it', 'close-tab'],
    ['whenever youre free close it', 'close-tab'],
    ['close it whenever youre free', 'close-tab'],
    ['when you have a second close it', 'close-tab'],
    ['when you have a sec close it', 'close-tab'],
    ['at some point today close it', 'close-tab'],
    ['before i forget close it', 'close-tab'],
    ['before it slips my mind close it', 'close-tab'],
    ['while youre thinking about it close it', 'close-tab'],
    ['while youre still in there close it', 'close-tab'],
    ['in your own time close it', 'close-tab'],
    ['when the mood strikes close it', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // EN "the current one" object swaps and done-declaratives
  test.each([
    ['the active tab close it', 'close-tab'],
    ['close the one im on', 'close-tab'],
    ['close whatever tab is open', 'close-tab'],
    ['close the current one', 'close-tab'],
    ['shut the current tab', 'close-tab'],
    ['kill the current tab', 'close-tab'],
    ['this page can close', 'close-tab'],
    ['this page can go', 'close-tab'],
    ['this one can go', 'close-tab'],
    ['close the one open', 'close-tab'],
    ['kill this one off', 'close-tab'],
    ['wrap this one up', 'close-tab'],
    ['how many windows', 'tab-status'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA request tails and dialect residue
  test.each([
    ['閉じて下されば幸いです', 'close-tab'],
    ['閉じちゃってもらって', 'close-tab'],
    ['閉じてもらっておきたい', 'close-tab'],
    ['閉じておいてくれるかな', 'close-tab'],
    ['閉じちゃいなって', 'close-tab'],
    ['閉じちゃいな', 'close-tab'],
    ['閉じて来い', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA active-tab / current-tab queries -> describe-tab
  test.each([
    ['今のタブ何', 'describe-tab'],
    ['現在のタブ教えて', 'describe-tab'],
    ['いま何見てる', 'describe-tab'],
    ['アクティブタブ教えて', 'describe-tab'],
    ['アクティブなタブ教えて', 'describe-tab'],
    ['いまのタブ', 'describe-tab'],
    ['今のタブ', 'describe-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA tab-count queries -> tab-status
  test.each([
    ['タブいくつある', 'tab-status'],
    ['タブいくつ開いてる', 'tab-status'],
    ['タブいくつ開いた', 'tab-status'],
    ['全部で何枚', 'tab-status'],
    ['合計何枚', 'tab-status'],
    ['タブの数教えて', 'tab-status'],
    ['タブ数教えて', 'tab-status'],
    ['何枚のタブがある', 'tab-status'],
    ['タブは何枚ある', 'tab-status'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA find-status / clear-find fills
  test.each([
    ['検索結果いくつ', 'find-status'],
    ['検索結果何個', 'find-status'],
    ['検索何件', 'find-status'],
    ['検索いくつあった', 'find-status'],
    ['いくつヒット', 'find-status'],
    ['何ヒット', 'find-status'],
    ['何箇所ヒット', 'find-status'],
    ['何箇所ある', 'find-status'],
    ['検索をリセット', 'clear-find'],
    ['検索解除して', 'clear-find'],
    ['検索を終わらせて', 'clear-find'],
    ['検索終わり', 'clear-find'],
    ['サーチ消して', 'clear-find'],
    ['サーチを消して', 'clear-find'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA reading fills
  test.each([
    ['速読で読んで', 'speech-faster'],
    ['速読で読み上げて', 'speech-faster'],
    ['そこから読んで', 'read-here'],
    ['そこから読み上げて', 'read-here'],
    ['今のとこから読んで', 'read-here'],
    ['今の場所から読んで', 'read-here'],
    ['その段落読んで', 'read-paragraph'],
    ['この段落読んで', 'read-paragraph'],
    ['この文読んで', 'read-sentence'],
    ['今の文読んで', 'read-sentence'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Pin coexistence: established routes must not shift
  test.each([
    ['閉じてんか', 'describe-tab'],
    ['閉じちょる', 'describe-tab'],
    ['閉じてや', 'close-tab'],
    ['閉じてて', 'close-tab'],
    ['閉じちょって', 'close-tab'],
    ['close it later', 'defer'],
    ['later close it', 'defer'],
    ['im done here', 'vr-exit'],
    ['いま何が開いてる', 'tabs-list'],
    ['タブいくつ', 'tab-status'],
    ['ゆっくり読んで', 'speech-slower'],
    ['普通に読んで', 'speech-reset'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Honest-null pins: ambiguous or negative-intent forms stay unrouted
  test.each([
    ['閉じぬ'],
    ['閉じぬけ'],
    ['閉じちゃってる？'],
    ['閉じけ'],
    ['閉じき'],
  ])('%s -> null', (p) => {
    expect(key(makeVc(), p)).toBeNull();
  });
});
