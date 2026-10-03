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
  // deed recorded & cadastral survey done
  'deed recorded', 'cadastral survey done',
];
const closeTabJa = [
  '不動産登記', '登記所',
  '登記情報', '表示登記',
  '権利登記', '建物表題登記',
  '分筆', '合筆',
  '地積測量', '筆界特定',
  '境界標', '境界立会い',
  '公図', '地番',
  '土地家屋調査士', '不動産登記法',
  '筆界調査', '地籍調査',
];
const negate = [
  'still awaiting the registration',
  'まだ登記前', 'これから登記申請',
];
const nullPins = [
  'about to file the registration', 'about to survey the boundary',
];
const establishedPins = [
  ['land registry updated', 'close-tab'],
  ['boundary survey done', 'close-tab'],
  ['法務局', 'close-tab'],
  ['登記申請', 'close-tab'],
  ['登記簿謄本', 'close-tab'],
];

describe('pass DC: land-registry & boundary-survey idioms (sheng)', () => {
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
