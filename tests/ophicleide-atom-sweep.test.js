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
  // forestry grant approved & timber quota allocated
  'forestry grant approved', 'timber quota allocated',
];
const closeTabJa = [
  '森林法', '森林計画',
  '森林計画区', '森林管理署',
  '特定保安林', '保安施設地区',
  '林道開設', '治山事業',
  '水源林', '間伐促進',
  '森林整備事業', '森林環境譲与税',
  '木材利用ポイント', '木材加工業',
  '木材産地', '製材所',
  '木材需給', '木材自給率',
  '森林病害虫', '松くい虫',
  'ナラ枯れ', '森林監視',
  '森林評価', '木材価格',
  '林業経営体', '林業従事者',
];
const negate = [
  'still awaiting the forestry permit',
  'これから間伐', 'まだ開業届前',
];
const nullPins = [
  'about to file the harvest notice',
  'about to join the timber co-op',
];
const establishedPins = [
  // already pinned close-tab — registered 特定保安林/森林環境譲与税 instead
  ['保安林', 'close-tab'],
  ['森林環境税', 'close-tab'],
  // already pinned negate — registered これから間伐/まだ開業届前 instead
  ['まだ伐採前', 'negate'],
  ['これから伐採届', 'negate'],
];

describe('pass DCXLV: forestry administration idioms (ophicleide)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
