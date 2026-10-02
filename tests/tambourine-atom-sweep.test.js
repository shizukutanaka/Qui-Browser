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
  // care-facility admitted & small-multifunction enrolled
  'care-facility admitted', 'small-multifunction enrolled',
];
const closeTabJa = [
  '介護老人保健施設', '老健',
  '介護医療院', 'ケアハウス',
  '軽費老人ホーム', '養護老人ホーム',
  'サービス付き高齢者向け住宅', 'ケア付き高齢者住宅',
  '地域密着型サービス', '地域密着型介護',
  '定期巡回', '随時対応型',
  '夜間対応型', '小規模多機能',
  '看護小規模多機能', '複合型サービス',
];
const negate = [
  'still waitlisted for care',
  'まだ入所前', 'これから施設入所',
];
const nullPins = [
  'about to tour the home', 'about to move in with care',
];
const establishedPins = [
  ['サ高住', 'close-tab'],
  ['まだ待機中', 'negate'],
];

describe('pass DLXXIV: care-facility & local-care idioms (tambourine)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
