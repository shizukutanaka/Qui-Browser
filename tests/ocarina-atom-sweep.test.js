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
  // labor-standards report & tribunal procedures done
  'labor report filed',
];
const closeTabJa = [
  '労基署', '労働審判',
  '残業代請求', '賃金未払い',
  '未払い残業', '割増賃金',
  '固定残業代', '36協定',
  '勤怠記録', '退勤打刻',
  'パワハラ', 'セクハラ',
  'モラハラ', '不当解雇',
  '解雇予告', '配置転換',
  '労働組合', '団体交渉',
  '労働条件', '就業規則',
  '年次有給',
];
const negate = [
  'still in dispute',
  'これから申告', 'まだ交渉中',
];
const nullPins = [
  'about to file',
];
const establishedPins = [
  ['claim settled', 'close-tab'],
  ['労働基準監督署', 'close-tab'],
  ['まだ相談前', 'negate'],
  ['タイムカード', null],
];

describe('pass DXLVII: labor-standards & tribunal idioms (ocarina)', () => {
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
