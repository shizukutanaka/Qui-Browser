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
  // estate & parents'-home clearout
  'house cleared out', 'estate cleared',
  'keepsakes boxed', 'junk hauled away',
  'sold the old house', 'empty house cleaned',
  'attic emptied', 'cleared the old home',
  'donated the furniture', 'photos divided up',
  'took what i wanted', 'cleanout done',
];
const closeTabJa = [
  '実家の片付け終了', '形見分け終了',
  '空き家を片付けて', '残置物を処分して',
  '家具を引き取ってもらって', '実家を売却して',
  '蔵を片付けて', '屋根裏を片付けて',
  '思い出の品を分けて', '実家の荷物を運んで',
];
const negate = [
  'still sorting the estate', 'still at the old house',
  'まだ実家片付け中',
];
const nullPins = [
  'about to sort the house', 'mid clearout',
  'estate list', 'deed',
  'これから実家の片付け', '片付けの途中',
  '形見', '登記書類',
];
const establishedPins = [
  ['belongings sorted', 'close-tab'],
  ['遺品整理終了', 'close-tab'],
  ['まだ遺品整理中', 'negate'],
];

describe('pass CCCXCVII: estate & parents-home clearout idioms (tormentil)', () => {
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
