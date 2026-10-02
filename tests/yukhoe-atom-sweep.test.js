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
  // second career done (定年再就職の終了側)
  'rehired', 'second career started',
  'senior job landed', 'post retirement job found',
  'part time job started', 'first paycheck',
  'new routine settled', 'badge got',
  'retired again',
];
const closeTabJa = [
  '再就職が決まって', 'セカンドキャリアに入って',
  'シニアジョブに就いて', 'パートを始めて',
  '初給料が入って', '新しい日常に慣れて',
  '再び引退して', '就活を終えて',
];
const negate = [
  'still job hunting',
  'まだ仕事探し中', 'これから応募する',
];
const nullPins = [
  'mid job search', 'senior job', 'post retirement work',
  '探し中', 'シニア求人', '定年後の仕事',
];
const establishedPins = [
  ['about to apply', null],
  ['orientation done', 'close-tab'],
  ['社員証をもらって', 'close-tab'],
  ['オリエンテーション終了', 'close-tab'],
];

describe('pass CDXLIV: second-career idioms (yukhoe)', () => {
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
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
