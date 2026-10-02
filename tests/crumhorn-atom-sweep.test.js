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
  // brokerage & tax-free account setup done (証券口座・NISA/iDeCo開設の終了側)
  'nisa opened', 'brokerage account opened',
  'ideco set up', 'first trade placed',
  'portfolio funded', 'risk profile done',
  'account verified', 'documents uploaded',
];
const closeTabJa = [
  'nisa口座', 'つみたてnisa',
  'ideco', '積立設定をして',
  '初回注文して', '口座開設して',
  '本人確認をして', '入金して',
];
const negate = [
  'still investing', 'about to invest',
  'これから口座開設',
];
const nullPins = [
  'mid setup', 'stock purchase',
  '投資信託',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['証券口座を開いて', 'go-to'],
  ['まだ設定中', 'negate'],
];

describe('pass CDLXXVII: brokerage & tax-free-account idioms (crumhorn)', () => {
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
