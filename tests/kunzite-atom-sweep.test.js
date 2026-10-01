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

describe('kunzite atom sweep (CCLXXXVI)', () => {
  // EN curtain/theatre + book/chapter + broadcast finales
  test.each([
    ['curtain call close it', 'close-tab'],
    ['bring the curtain down', 'close-tab'],
    ['curtain down close it', 'close-tab'],
    ['roll credits on it', 'close-tab'],
    ['lights out for it', 'close-tab'],
    ['lights out close it', 'close-tab'],
    ['lights out on it', 'close-tab'],
    ['end of chapter', 'close-tab'],
    ['end of the chapter', 'close-tab'],
    ['closing chapter', 'close-tab'],
    ['denouement close it', 'close-tab'],
    ['end of broadcast', 'close-tab'],
    ['sign off on it', 'close-tab'],
    ['end of program', 'close-tab'],
    ['program over', 'close-tab'],
    ['pack it up close it', 'close-tab'],
    ['put it in the drawer', 'close-tab'],
    ['in the drawer with it', 'close-tab'],
    ['close the current please', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA 幕/演目/成仏/供養/見送り forms
  test.each([
    ['閉幕して', 'close-tab'],
    ['終幕にして', 'close-tab'],
    ['緞帳を下ろして', 'close-tab'],
    ['緞帳下ろして', 'close-tab'],
    ['カーテンを閉めて', 'close-tab'],
    ['幕引きして', 'close-tab'],
    ['エンドロール', 'close-tab'],
    ['エンドロール流して', 'close-tab'],
    ['演目終了', 'close-tab'],
    ['出番終わり', 'close-tab'],
    ['成仏してもらって', 'close-tab'],
    ['お供養して', 'close-tab'],
    ['お別れして', 'close-tab'],
    ['見送りして', 'close-tab'],
    ['お見送りで', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // JA おくれ/おくんな tails
  test.each([
    ['閉じておくれや', 'close-tab'],
    ['閉じておくれんが', 'close-tab'],
    ['閉じておくれっか', 'close-tab'],
    ['お閉じなすって', 'close-tab'],
    ['閉じておくんなし', 'close-tab'],
    ['閉じておくんなしぇ', 'close-tab'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // 畳む family kana/inflection variants — same lexeme, same close-all route
  // as the established 畳んで/畳んじゃって pins.
  test.each([
    ['たたんで', 'close-all-tabs'],
    ['タタんで', 'close-all-tabs'],
    ['畳みかけて', 'close-all-tabs'],
    ['畳んでしまって', 'close-all-tabs'],
    ['畳んで', 'close-all-tabs'],
    ['畳んじゃって', 'close-all-tabs'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Misroute-fix regressions: 'curtain call close it' hit device-apps'
  // `call \w+` (matches 'call close'); 'lights out *' hit dark-mode's
  // /lights out/. Genuine dark-mode and call-lookup intents preserved.
  test.each([
    ['curtain call close it', 'close-tab'],
    ['curtain down close it', 'close-tab'],
    ['lights out close it', 'close-tab'],
    ['lights out for it', 'close-tab'],
    ['lights out for this tab', 'close-tab'],
    ['lights out', 'dark-mode'],
    ['call support', 'device-apps'],
  ])('%s -> %s', (p, k) => {
    expect(key(makeVc(), p)).toBe(k);
  });

  // Honest-null pins: 'curtain call' alone is an encore request, not a
  // close; 'turn the final page' collides with page-turn navigation.
  test.each([
    ['curtain call'],
    ['turn the final page'],
  ])('%s -> null', (p) => {
    expect(key(makeVc(), p)).toBeNull();
  });
});
