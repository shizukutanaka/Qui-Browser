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
  // bed-report filed & hospital accreditation done
  'bed-report filed', 'hospital accreditation done',
];
const closeTabJa = [
  '病院機能評価', '医療安全支援センター',
  '院内感染対策', '医療ソーシャルワーカー',
  '入院時食事療養費', '差額ベッド料',
  '地域医療構想', '病床機能報告',
  'かかりつけ医機能', '医療広告規制',
  '医療事故調査制度', '院内調査',
  '医療メディエーター', '医療連携室',
  '地域包括ケア医療', '在宅医療連携拠点',
  '病床規制', '医療計画',
  '医療審議会', '医療法人',
  '特定機能病院', '地域医療支援病院',
  '入院基本料', '診療報酬',
  'レセプト',
];
const negate = [
  'still awaiting the accreditation',
  'まだ審査前', 'まだ評価前',
];
const nullPins = [
  'about to file the bed report', 'about to schedule the accreditation',
];
const establishedPins = [
  ['退院支援', 'close-tab'], ['これから報告', 'negate'],
];

describe('pass DCXII: hospital & regional-medical idioms (joktal)', () => {
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
