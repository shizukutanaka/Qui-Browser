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
  // fire inspection done & ambulance dispatched
  'fire inspection done', 'ambulance dispatched',
];
const closeTabJa = [
  '消防法', '消防署',
  '救急隊', '救助隊',
  '高度救助隊', '救急医療情報',
  '救急安心センター', '応急手当',
  '防災対策本部', '災害対策本部',
  '災害対策基本法', '避難指示',
  '高齢者等避難', '避難所指定',
  '緊急消防援助隊', '消防救急無線',
  '救急搬送', '救急受入体制',
  '災害拠点病院', '救急救命士',
  '熱中症警戒アラート', '消防審議会',
  '消防署長', '救助事務所',
];
const negate = [
  'still awaiting the fire inspection',
  'まだ防火前', 'これから防火届',
];
const nullPins = [
  'about to file the fire plan',
  'about to join the rescue team',
];
const establishedPins = [
  ['消防本部', 'close-tab'],
];

describe('pass DCXXIII: fire-service & emergency-rescue administration idioms (peking)', () => {
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
