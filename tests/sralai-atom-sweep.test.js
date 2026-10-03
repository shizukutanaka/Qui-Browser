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
  // grower certified & crop plan approved
  'grower certified', 'crop plan approved',
];
const closeTabJa = [
  '農業基本法', '食料自給率',
  '担い手', '認定農業者',
  '認定新規就農者', '農業経営基盤強化',
  '営農計画', '集落営農',
  '農地中間管理機構', '中山間地域',
  '鳥獣害防止', '病害虫防除',
  '米生産調整', '政府米',
  '食糧管理法', '米価審議会',
  '家畜改良増殖法', '飼料需給',
  '農産物検査', '農業改良普及',
  '普及指導員', '営農指導',
  '農業経営', '販売契約',
  '産地形成',
];
const negate = [
  'still awaiting the grower certification',
  'これから営農計画',
];
const nullPins = [
  'about to file the farming plan',
  'about to join the village co-op',
];
const establishedPins = [
  ['経営改善計画', 'close-tab'],
  ['まだ認定前', 'negate'],
];

describe('pass DCXXI: agricultural policy & food-self-sufficiency idioms (sralai)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
