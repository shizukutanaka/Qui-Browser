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
  // hunting license renewed & pest-control detail done
  'hunting license renewed', 'pest-control detail done',
];
const closeTabJa = [
  '狩猟免許', '猟銃',
  '狩猟登録', '猟友会',
  '鳥獣保護区', '狩猟期間',
  '有害鳥獣', '駆除',
  '捕獲', '罠免許',
  'わな猟', '空気銃',
  '猟銃等講習', '銃所持許可',
  '狩猟税', '猟区',
  'ジビエ', '銃砲所持許可',
  '狩猟免状',
];
const negate = [
  'still unregistered for hunting',
  'まだ狩猟登録前', 'これから狩猟登録',
];
const nullPins = [
  'about to renew the gun license', 'about to join the hunt club',
];
const establishedPins = [
  ['更新講習', 'close-tab'],
  ['まだ登録前', 'negate'],
  ['まだ免許前', 'negate'],
];

describe('pass DLXXXIV: hunting-license & pest-control idioms (zampo)', () => {
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
