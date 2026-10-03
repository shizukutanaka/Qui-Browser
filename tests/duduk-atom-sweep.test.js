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
  // logging notice filed & forest co-op joined
  'logging notice filed', 'forest co-op joined',
];
const closeTabJa = [
  '森林組合', '間伐',
  '造林', '森林経営計画',
  '林道', '保安林',
  '立木', '伐採届',
  '林地開発', '森林環境税',
  '木材', '製材',
  '森林所有者', '境界',
  '共用林', '入会林',
  '森林認証', '植樹',
];
const negate = [
  'still awaiting the felling permit',
  'まだ伐採前', 'これから伐採届',
];
const nullPins = [
  'about to log the forest', 'about to join the forest co-op',
];
const establishedPins = [
  ['まだ届出前', 'negate'],
];

describe('pass DLXXXIII: forestry co-op & felling-notice idioms (duduk)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
