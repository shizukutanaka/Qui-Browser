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
  // tax & municipal-payment errand done (納税・窓口支払いの終了側)
  'property tax paid', 'installment paid',
  'payment slip stamped', 'receipt kept',
  'notice mailed back', 'counter visited',
  'window number called',
];
const closeTabJa = [
  '年金を納めて', '保険料を納めて',
  '納付書を払って', '整理券を取って',
];
const negate = [
  'still paying taxes', 'about to pay',
  'まだ納付中', 'これから納める',
];
const nullPins = [
  'mid payment', 'tax office',
  '納税手続き中', '区役所', '納付書',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['tax bill paid', 'close-tab'],
  ['payment due', 'close-tab'],
  ['固定資産税を払って', 'close-tab'],
  ['自動車税を払って', 'close-tab'],
  ['窓口に行って', 'go-to'],
  ['受付を済ませて', 'close-tab'],
  ['支払いを済ませて', 'close-tab'],
];

describe('pass CDLIX: tax & municipal-payment idioms (cello)', () => {
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
