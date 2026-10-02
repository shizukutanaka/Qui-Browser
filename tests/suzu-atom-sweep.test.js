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
  // vocational training benefit procedures done
  'training benefit granted', 'course completed',
  'tuition reimbursed', 'benefit paid',
];
const closeTabJa = [
  '教育訓練給付', '一般教育訓練',
  '専門実践教育訓練', '給付金支給',
  '資格取得費', 'ハローワーク申請',
  '受講完了', '講座修了',
  '受講料', '通信教育終了',
  '対象講座', '支給申請',
  '合格証',
];
const negate = [
  'still in the course', 'まだ受講中',
  'これから受講',
];
const nullPins = [
  'mid program',
];
const establishedPins = [
  ['certification earned', 'close-tab'],
  ['受講終了', 'close-tab'],
  ['about to enroll', 'negate'],
];

describe('pass DXVI: vocational training benefit idioms (suzu)', () => {
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
