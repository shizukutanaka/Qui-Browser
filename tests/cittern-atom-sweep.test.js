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
  // expressway toll collected & detour route opened
  'expressway toll collected', 'detour route opened',
];
const closeTabJa = [
  '国土交通省', '道路交通法',
  '道路管理', '高速道路',
  '自動車専用道路', '有料道路',
  '国道', '県道',
  '市町村道', '道路台帳',
  '道路附属物', '路面標示',
  '道路照明', '制限速度',
  '通行規制', '道路修繕工事',
  '維持修繕', '橋梁点検',
  'トンネル点検', '防雪対策',
  '道路標識', 'ガードレール',
  '中央分離帯', '路側帯',
  '歩道設置', '自転車道',
  '交通規制',
];
const negate = [
  'still awaiting the route permit',
  'まだ道路使用前', 'まだ通行許可前',
];
const nullPins = [
  'about to file the road occupation',
  'about to request the route survey',
];
const establishedPins = [
  // already pinned close-tab — registered 道路交通法/道路管理/道路修繕工事 instead
  ['道路法', 'close-tab'],
  ['道路管理者', 'close-tab'],
  ['道路工事', 'close-tab'],
  // already pinned negate — registered まだ道路使用前/まだ通行許可前 instead
  ['still awaiting the road permit', 'negate'],
  ['まだ許可前', 'negate'],
  ['まだ占用許可前', 'negate'],
  ['これから占用申請', 'negate'],
];

describe('pass DCXL: road administration idioms (cittern)', () => {
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
