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
  // company trip & retreat end
  'company trip done', 'team retreat done',
  'offsite done', 'back from the retreat',
  'group tour done', 'field work done',
  'team building done', 'thank you party done',
  'farewell party done',
  // wrap-up
  'luggage claimed', 'saw the tour guide off',
  'retreat wrapped', 'training camp wrapped',
];
const closeTabJa = [
  '社員旅行終了', '研修旅行終了',
  '団体旅行終了', '慰安旅行終了',
  'チームビルディング終了', '歓迎会終了',
  '添乗員さんにお礼を言って',
  '合宿から帰って', '研修合宿終了',
];
const negate = [
  'still on the retreat', 'still at the offsite',
  'まだ合宿中', 'まだ旅行先',
];
const nullPins = [
  'about to head back', 'mid retreat',
  'retreat schedule', 'room key',
  'これから帰着', '合宿の途中',
  '行程表', '部屋の鍵',
];
const establishedPins = [
  ['bus tour done', 'close-tab'],
  ['welcome party done', 'close-tab'],
  ['合宿終了', 'close-tab'],
  ['バスツアー終了', 'close-tab'],
  ['送別会終了', 'close-tab'],
  ['ホテルをチェックアウトして', 'close-tab'],
  ['荷物を受け取って', 'close-tab'],
];

describe('pass CCCXCV: company-trip & retreat end idioms (rhodo)', () => {
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
