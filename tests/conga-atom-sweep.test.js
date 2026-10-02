const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // shelter entered & transition-house moved in
  'shelter entered', 'transition-house moved in',
];
const closeTabJa = [
  '母子生活支援施設', '母子自立支援員',
  '母子寮', '婦人保護施設',
  '婦人相談所', 'dvシェルター',
  '民間シェルター', 'ステップハウス',
  '母子自立支援プログラム', '配偶者暴力相談支援センター',
  'dv相談ナビ', '緊急一時保護',
  '自立訓練プログラム', '婦人相談員',
  '母子福祉寮',
];
const negate = [
  'still fleeing',
  'まだ避難中', 'これから避難所',
];
const nullPins = [
  'about to escape', 'about to shelter',
];
const establishedPins = [];

describe('pass DLXXIII: dv-shelter & mother-support idioms (conga)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
});
