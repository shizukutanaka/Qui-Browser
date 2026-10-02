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
  // workplace disability-accommodation procedures done
  'accommodations approved', 'workplace assessment done',
  'support plan signed', 'reasonable adjustments made',
  'desk moved', 'job coach assigned',
  'ergonomic chair ordered', 'disability disclosure done',
  'screen reader set up', 'commute support arranged',
];
const closeTabJa = [
  '合理的配慮', '配慮申請',
  '障害者雇用', '職場適応',
  '支援計画', 'ジョブコーチ',
  '通勤支援', '作業環境整備',
  '支援員手配', 'バリアフリー工事',
];
const negate = [
  'still arranging accommodations', 'about to request accommodations',
  'まだ配慮申請中',
];
const nullPins = [
  'plan pending', 'mid assessment',
  '申請中', '配慮未決',
];
const establishedPins = [
  ['これから申請', 'negate'],
];

describe('pass D: workplace disability-accommodation idioms (tsuzumi)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
