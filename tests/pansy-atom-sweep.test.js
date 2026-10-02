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
  // delivery & setup
  'fridge delivered', 'washer installed',
  'new furniture in', 'delivery done',
  'installation done', 'appliance set up',
  'old appliance hauled', 'setup complete',
  'crew left',
];
const closeTabJa = [
  '冷蔵庫が届いて', '洗濯機を設置して',
  '家具が届いて', '配送が終わって',
  '設置が終わって', '家電を設置して',
  '古いのを引き取って', '設置業者が帰って',
  '保証書に登録して',
];
const negate = [
  'still waiting for delivery', 'still installing',
  'まだ配送待ち', 'まだ設置中',
];
const nullPins = [
  'about to set it up', 'mid installation',
  'instruction manual', 'warranty card',
  'これから設置', '設置の途中',
  '説明書', '保証書',
];
const establishedPins = [
  ['warranty registered', 'close-tab'],
  ['ベッドを組み立てて', 'close-tab'],
];

describe('pass CDX: appliance delivery & setup idioms (pansy)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
