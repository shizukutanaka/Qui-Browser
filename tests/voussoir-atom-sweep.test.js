// Pass CCXVII — voussoir atom sweep: EN superfluity/trouble-apology;
// JA ta-noda reports + masu-ka III + choudai-masu.
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'Alpha', url: 'https://alpha' },
      { id: 't2', title: 'Beta', url: 'https://beta' },
      { id: 't3', title: 'Gamma', url: 'https://gamma' },
    ],
    getActiveTab() { return this.tabs.find(t => t.id === this.activeTabId); },
    closeAllTabs() { return this.tabs.length; },
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('voussoir atom sweep (CCXVII)', () => {
  it.each([
    // EN superfluity frames -> close-tab
    'i wont be needing it', 'i wont need it', 'wont be needing it',
    'i dont need it anymore', 'dont need it anymore',
    'i no longer need it', 'no longer needed close it',
    'not needed anymore close it', 'no use for it anymore',
    'its no longer needed', 'i have no use for it',
    'served its purpose close it', 'purpose served close it',
  ])('superfluity %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN trouble-apology -> close-tab
    'close it if its not too much trouble', 'close it if its no bother',
    'close it if thats ok', 'close it if thats okay',
    'close it if you dont mind', 'close it if it isnt too much trouble',
    'close it if its not a bother', 'close it if its no trouble at all',
    'close it if you wouldnt mind', 'close it if it suits you',
    'close it if its convenient for you',
  ])('trouble %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA たのだ past reports -> describe-tab
    '閉じたのだ', '閉じたんだよ',
    '閉じたんだが', '閉じたんだけど', '閉じたんです',
    '閉じたんですが', '閉じたんですけど', '閉じたのです', '閉じたのですが',
    '閉じたのね',
  ])('JA ta-noda %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // established close-tab pins for these report forms
    ['閉じたので', 'close-tab'],
    ['閉じたんですよ', 'close-tab'],
    ['閉じたんだ', 'close-tab'],     // established んだ->te variant
    ['閉じたなんか', null],          // established ambiguity pin
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });

  it.each([
    // JA ますか III -> close-tab
    '閉じますかねえ', '閉じますかな', '閉じますかのう', '閉じますかの',
    '閉じますかぞ', '閉じますわ', '閉じますわよ', '閉じますわね',
    '閉じますとも', '閉じますこと', '閉じますので', '閉じますんで',
    '閉じますから', '閉じますが', '閉じますけど',
  ])('JA masu III %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA いただき/ちょうだいます residue -> close-tab
    '閉じていただきます', '閉じていただきますね', '閉じていただきたいです',
    '閉じていただきとうございます', '閉じていただきますよう',
    '閉じていただきたく', '閉じていただきたく存じます',
    '閉じていただきたく思います', '閉じていただきたいのです',
    '閉じていただきたいんです', '閉じていただきたいですが',
    '閉じてちょうだいます', '閉じてちょうだいますよう',
    '閉じてちょうだいまして',
  ])('JA itadaku %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
