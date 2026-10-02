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
  // gatekeeper trained & helpline staffed
  'gatekeeper trained', 'helpline staffed',
];
const closeTabJa = [
  'いのちの電話', '自殺予防',
  'いのち支える', 'ゲートキーパー',
  '自殺対策基本法', 'こころの健康相談',
  '相談ダイヤル', 'よりあい',
  'グリーフケア', '自死遺族',
  'つながり支援', 'セーフティネット',
  'こころの相談', '電話相談員',
  '自殺対策強化月間', '悩み相談電話',
];
const negate = [
  'still in training to be a listener',
  'まだ研修前', 'これから応募',
];
const nullPins = [
  'about to volunteer on the line', 'about to call the helpline',
];
const establishedPins = [
  ['これから受講', 'negate'],
];

describe('pass DLXVIII: suicide-prevention & helpline idioms (handpan)', () => {
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
