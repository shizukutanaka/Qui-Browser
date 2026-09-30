// Pass CCVI — column atom sweep: EN polite-final tails + prefer/out-of-here;
// JA can-statements + plan nouns + volitional-ではないか + benefactive III +
// broken-promise (trouble) + potential-form queries (help).
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

describe('column atom sweep (CCVI)', () => {
  it.each([
    // EN polite-final tails / immediacy -> close-tab
    'close it if you would', 'close it if you could', 'close it if you will',
    'close it if you may', 'close it if you might', 'close it if you please',
    'close it when you can', 'close it when you may', 'close it whenever',
    'close it soon', 'close it soonish', 'close it asap', 'close it stat',
    'close it now please', 'close it now if you would',
    'close it before long',
  ])('final-tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN passive-result wishes -> close-tab
    'id like it closed', 'id like that closed', 'id like this closed',
    'id like the tab closed', 'id prefer it closed', 'id prefer that closed',
    'i want it closed', 'i want that closed', 'i want this closed',
    'i need it closed', 'i need that closed', 'i need this closed',
    'i need it gone', 'i want it gone', 'i want it out of here',
    'i want it shut', 'i need it shut', 'want it shut', 'want it closed',
  ])('wish %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA can-statements / nominalized ability -> close-tab
    '閉じることができる', '閉じることができるでしょうか',
    '閉じることができますか', '閉じることはできますか',
    '閉じることが可能ですか', '閉じること可能ですか',
    '閉じるのは可能ですか', '閉じるのはできる',
  ])('JA can %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA plan/expectation nouns -> close-tab
    '閉じられる予定', '閉じる予定でした', '閉じる予定だった',
    '閉じられる予定だった', '閉じる手筈', '閉じる手筈だった',
    '閉じる段取りだった', '閉じる算段だった', '閉じる見込みだった',
    '閉じる見込みでした', '閉じる目算だった', '閉じる心算だった',
  ])('JA plan %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA volitional ではないか / じゃないの -> close-tab
    '閉じようではないか', '閉じようではありませんか', '閉じようじゃないの',
    '閉じょうではないか', '閉じゃろうではないか', '閉じるではないか',
  ])('JA volitional %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA benefactive III -> close-tab
    '閉じていただければ', '閉じていただけるなら', '閉じていただくなら',
    '閉じていただけたら', '閉じていただけたなら', '閉じてくれてもいい',
    '閉じてくだされば', '閉じてくださるなら', '閉じてくださるのであれば',
    '閉じてもらえてもいい', '閉じてもらっていい', '閉じてもらっていいよ',
  ])('JA benefactive %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA broken-promise reports -> trouble
    '閉じる約束だった', '閉じる約束なのに',
  ])('JA promise %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // JA potential-form capability queries -> help
    '閉じれるんですか', '閉じれるのですか', '閉じれますでしょうか',
    '閉じられますでしょうか', '閉じられるんでしょうか',
    '閉じられるでしょうか',
  ])('JA potential %s -> help', (p) => {
    expect(key(mk(), p)).toBe('help');
  });

  it.each([
    // established pins kept
    ['閉じれるわけですか', 'ack'],        // わけ→ack established family
    ['閉じまいかと思うけど', null],        // not-to-close deliberation
    ['閉じまいかと思うのです', null],
    ['閉じまいかと思った', null],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
