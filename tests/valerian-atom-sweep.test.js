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
  // viewing & estimates
  'apartment tour done', 'saw the place',
  'got an estimate', 'quotes collected',
  'applied for the place', 'application sent',
  'lease preview done', 'deposit wired',
  'guarantor arranged', 'walked through the unit',
  'viewed the unit', 'left a deposit',
];
const closeTabJa = [
  '内見終了', '内覧終了',
  '見学終了', '見積もりを取って',
  '相見積もり終了', '申し込みを出して',
  '仮審査を通して', '敷金を振り込んで',
  '連帯保証人を立てて', '契約説明を聞いて',
];
const negate = [
  'still viewing apartments', 'still at the viewing',
  'まだ内見中', 'まだ見学中',
];
const nullPins = [
  'about to view the place', 'mid viewing',
  'floor plan', 'brochure',
  'これから内見', '内見の途中',
  '間取り図', 'パンフレット',
];
const establishedPins = [
  ['viewing done', 'close-tab'],
  ['walkthrough done', 'close-tab'],
  ['open house visited', 'go-to'],
  ['オープンハウスに行って', 'go-to'],
];

describe('pass CCCXCIX: viewing & estimate-done idioms (valerian)', () => {
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
