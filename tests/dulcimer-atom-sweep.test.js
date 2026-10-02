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
  // mourning-year & memorial etiquette done (喪中・香典返し・回忌案内の終了側)
  'sympathy cards sent', 'memorial gifts sent',
  'return gifts done', 'condolence money returned',
  'mourning cards printed', 'anniversary service booked',
  'temple notified', 'incense offered',
];
const closeTabJa = [
  '喪中はがき', '年賀欠礼',
  '香典返しをして', '忌明けをして',
  '法要の案内を出して', 'お寺に連絡して',
  '線香をあげて', '仏壇を掃除して',
];
const negate = [
  'これから印刷',
];
const nullPins = [
  'mid preparations', 'rosary done',
  '菩提寺',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['still mailing', 'negate'],
  ['about to mail', 'negate'],
  ['まだ準備中', 'negate'],
  ['数珠をしまって', 'close-tab'],
];

describe('pass CDLXXII: mourning-year & memorial idioms (dulcimer)', () => {
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
