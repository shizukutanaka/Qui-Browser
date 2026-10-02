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
  // vehicle disposal & deregistration done (廃車・抹消登録の終了側)
  'junked the car', 'plates surrendered',
  'sold the clunker', 'scrap dealer came',
  'ownership transferred', 'title signed',
  'car picked up', 'inspection expired',
];
const closeTabJa = [
  'ナンバーを返して', '車を手放して',
  '車検を切って', 'リサイクル料金を払って',
  '車を引き取って',
];
const negate = [
  'about to sell', 'これから売る',
];
const nullPins = [
  'mid paperwork', '買取業者',
  '重量税',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['registration cancelled', 'close-tab'],
  ['廃車にして', 'close-tab'],
  ['解体して', 'close-tab'],
  ['still selling', 'negate'],
  ['まだ手続き中', 'negate'],
];

describe('pass CDLXXIV: vehicle-disposal & deregistration idioms (shawm)', () => {
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
