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
  // adoption & special-adoption procedures done (養子縁組手続きの終了側)
  'adoption finalized', 'adoption granted',
  'home study done', 'agency matched',
  'special adoption granted', 'custody transferred',
  'birth parents consented', 'family court approved',
  'adoption registered',
];
const closeTabJa = [
  '養子縁組', '特別養子',
  '普通養子', '縁組成立',
  '里親', '児童相談所',
  '実親同意', '家庭裁判所許可',
  '入籍済み', '里子',
];
const negate = [
  'still adopting',
  'まだ縁組中', 'これから縁組',
];
const nullPins = [
  'mid placement',
];
const establishedPins = [
  ['about to adopt', null],
];

describe('pass CDXCI: adoption & special-adoption idioms (sanshin)', () => {
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
