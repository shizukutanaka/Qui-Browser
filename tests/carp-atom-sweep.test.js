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
  // pension-claim done (年金受給手続きの終了側)
  'pension claimed', 'pension filing done',
  'nenkin applied', 'retirement benefit claimed',
  'pension office visited', 'social security filed',
  'pension book updated',
];
const closeTabJa = [
  '年金請求をして', '裁定請求を出して',
  '受給手続きを終えて', '年金手帳をもらって',
  '年金が振り込まれて', '厚生年金を申請して',
  '国民年金に加入して', '繰り上げ受給をして',
  '年金相談を終えて',
];
const negate = [
  'still claiming pension', 'about to claim',
  'まだ年金手続き中', 'これから年金請求',
];
const nullPins = [
  'mid filing', 'pension benefits', 'retirement paperwork',
  '個人型確定拠出年金', '年金受給',
];
const establishedPins = [
  ['claim approved', 'close-tab'],
  ['年金事務所に行ってきて', 'go-to'],
];

describe('pass CDXLVIII: pension-claim idioms (carp)', () => {
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
