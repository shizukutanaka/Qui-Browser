// Pass CCXVI — crown atom sweep: EN wrap-up idioms + keep-open negate family;
// JA ta-ue/ba-yokatta/naito-III residue.
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

describe('crown atom sweep (CCXVI)', () => {
  it.each([
    // EN wrap-up idioms -> close-tab
    'were done here close it', 'we are done here close it',
    'were done close it', 'were finished here close it',
    'done here close it', 'thats it close it', 'thats all close it',
    'thats all she wrote close it', 'mission accomplished close it',
    'job done close it', 'task complete close it', 'work done close it',
    'calling it close it', 'wrapping up close it', 'wrap it up close it',
  ])('wrap-up %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN keep-open family -> negate
    'leave it open', 'keep it open', 'leave it be', 'let it stay open',
    'let it keep going', 'leave it running', 'keep it running',
    'let it run', 'leave it up', 'let it sit', 'let it hang',
  ])('keep-open %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  it('keep it up -> resume-reading (established pin)', () => {
    expect(key(mk(), 'keep it up')).toBe('resume-reading');
  });

  it.each([
    // JA た上で/てから sequence -> close-tab
    '閉じてからでいい', '閉じてからにして', '閉じてからお願い',
    '閉じてからいい', '閉じてからのほうが', '閉じてからがいい',
    '閉じてからで構わない', '閉じてからで良い', '閉じてからが先',
    '閉じてからにしてほしい', '閉じた上で', '閉じた上でいい',
    '閉じた上でお願い', '閉じた上がいい',
  ])('JA sequence %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ばいいのに/ばよかった regret -> close-tab
    '閉じればいいのになあ', '閉じればいいのにねえ', '閉じればいいのにさ',
    '閉じればいいのになー', '閉じればよかったのに', '閉じばよかったのに',
    '閉じればよかった', '閉じばよかった', '閉じりゃよかった',
    '閉じりゃよかったのに', '閉じゃよかったのに', '閉じたほうがよかった',
    '閉じたほうがよかったのに', '閉じておけばよかった',
    '閉じておけばよかったのに',
  ])('JA regret %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ないと duty III -> close-tab
    '閉じないとまずい', '閉じないとまずいよ', '閉じないとだめ',
    '閉じないとだめだ', '閉じないとだめだよ', '閉じないといけないんだ',
    '閉じないと困る', '閉じないと困るんだ', '閉じないとやばい',
    '閉じないとやばいよ', '閉じないとね', '閉じないとよ',
    '閉じなきゃまずい', '閉じなきゃだめだ',
  ])('JA naito III %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it('JA ないといけないんだよ -> trouble (established pin)', () => {
    expect(key(mk(), '閉じないといけないんだよ')).toBe('trouble');
  });
});
