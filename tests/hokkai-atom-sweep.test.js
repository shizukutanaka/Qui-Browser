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
  // disaster-relief certificate & aid procedures done
  'damage report filed', 'relief fund granted',
  'shelter registered', 'emergency housing assigned',
];
const closeTabJa = [
  '罹災証明', '被災証明',
  '被害届', '被災届出',
  '災害救助', '避難所登録',
  '見舞金', '義援金',
  '仮設住宅入居', '浸水被害',
  '半壊認定', '全壊認定',
  '応急修理', '住宅再建',
];
const negate = [
  'still assessing damage', 'about to report the damage',
  'まだ被害調査中', 'これから罹災申請',
];
const nullPins = [
  'mid survey',
];
const establishedPins = [
  ['disaster certificate issued', 'security-status'],
];

describe('pass DXVII: disaster-relief certificate idioms (hokkai)', () => {
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
