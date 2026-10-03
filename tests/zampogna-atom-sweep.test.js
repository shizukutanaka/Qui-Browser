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
  // airport slot allocated & drone permit granted
  'airport slot allocated', 'drone permit granted',
];
const closeTabJa = [
  '航空法', '空港法',
  '定期航空', '航空運送事業',
  '航空従事者', '航空交通管制',
  '空港管理者', '騒音防止措置',
  '航空機登録', '耐空証明',
  'ドローン許可', '無人航空機登録',
  '航空安全', '空港整備',
  '航空灯火', '滑走路整備',
  '航空保安施設', '管制業務',
  '運航管理者', '航空機検査',
  '特定操縦技能審査', '操縦者証明',
  '航空保安情報', '航空事故調査',
  '空港騒音対策',
];
const negate = [
  'still awaiting the airworthiness review',
  'まだ飛行計画前', 'これから飛行計画',
];
const nullPins = [
  'about to file the drone permit',
  'about to register the aircraft',
];
const establishedPins = [
  ['airworthiness certificate issued', 'security-status'],
  ['まだ登録申請前', 'negate'],
];

describe('pass DCXXVIII: aviation & airport administration idioms (zampogna)', () => {
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
