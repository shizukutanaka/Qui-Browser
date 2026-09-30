// Pass CCX — beam atom sweep: EN go-on permissives + hedged reports;
// JA potential imperatives + ba-yoi residue + morau III + ro-tails.
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

describe('beam atom sweep (CCX)', () => {
  it.each([
    // EN go-on permissives -> close-tab
    'go on and close it', 'go ahead and close it', 'go on close it',
    'go ahead close it', 'just go and close it', 'go right ahead and close it',
    'go on then close it', 'feel free to close it', 'be my guest close it',
    'knock yourself out close it', 'be at liberty to close it',
    'be at leisure close it',
  ])('permissive %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN hedged reports -> close-tab
    'i suppose you could close it', 'i suppose you can close it',
    'i guess you could close it', 'i reckon you could close it',
    'i figure you could close it', 'i imagine you could close it',
    'i bet you could close it', 'i bet you can close it',
    'i dare say you could close it', 'suppose you close it',
    'say you close it', 'lets say you close it', 'assuming you close it',
  ])('hedged %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA potential-form imperatives -> close-tab
    '閉じれろ', '閉じれよ', '閉じれや', '閉じれな', '閉じれんなよ',
    '閉じれらんないか', '閉じれらんか', '閉じれりゃいい',
    '閉じれりゃいいのに', '閉じれりゃいいじゃん',
    '閉じれりゃいいんだけど', '閉じれりゃいいわ',
  ])('JA potential-imperative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ばよい/ばよろしい residue -> close-tab
    '閉じればよい', '閉じればよいのです', '閉じればよいのよ',
    '閉じればよいわ', '閉じればよいです', '閉じればよいではないか',
    '閉じればよいだろう', '閉じれば宜しい', '閉じれば善い',
    '閉じれば好い', '閉じれば可也', '閉じればいいものを',
    '閉じればいいものだ', '閉じればいいんですよ',
  ])('JA ba-yoi %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てもろて/てもらう III -> close-tab
    '閉じてもろて', '閉じてもろても', '閉じてもろたら', '閉じてもろた',
    '閉じてもらうと', '閉じてもらうなら', '閉じてもらうのであれば',
    '閉じてもらえそう', '閉じてもらえそうだ', '閉じてもらえそうな',
    '閉じてもらえるよう', '閉じてもらえるように',
  ])('JA morau %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ろ-imperative tails -> close-tab
    '閉じろてな', '閉じろて', '閉じろっての', '閉じろっちゅうの',
    '閉じろよな', '閉じろよね', '閉じろなあ', '閉じろねえ',
    '閉じろはよ', '閉じろはよう', '閉じろじゃい', '閉じろじゃ',
    '閉じろって言ってんでしょ', '閉じろって言ってんのに',
  ])('JA ro %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // established pins kept
    ['help yourself close it', 'scoped-help'], // scoped-help preempts literal (registration order)
    ['閉じないろ', 'negate'],                   // malformed ない-imperative stays negate
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
