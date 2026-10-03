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
  // scholarship granted & loan deferment approved
  'scholarship granted', 'loan deferment approved',
];
const closeTabJa = [
  '奨学金', '給付奨学金',
  '貸与奨学金', '第一種奨学金',
  '第二種奨学金', 'スカラーシップ',
  '奨学金返還', '返還猶予',
  '減額返還', '機関保証',
  '返還期限', '返還免除',
  '高等教育無償化', '授業料減免',
  '入学金減免', '緊急採用奨学金',
  '在学猶予', '奨学金継続願',
  '奨学金停止', '奨学生証',
  '支援区分', '奨学金振込',
  '予約採用', '在学採用',
];
const negate = [
  'still awaiting the scholarship',
  'まだ奨学金前', 'これから奨学金申請',
];
const nullPins = [
  'about to apply for the scholarship', 'about to file the scholarship paperwork',
];
const establishedPins = [
  ['連帯保証人', 'close-tab'],
  ['about to defer the loan', 'negate'],
];

describe('pass DCXI: scholarship & tuition-support idioms (bachu)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
