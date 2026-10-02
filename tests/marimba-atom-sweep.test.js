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
  // care-worker qualification & training procedures done
  'care worker certified',
];
const closeTabJa = [
  '介護福祉士', '実務者研修',
  '初任者研修', '介護職員初任者',
  '介護支援専門員', '介護職員処遇改善',
  '処遇改善加算', '介護報酬',
  '介護給付費', '加算算定',
  '人材育成', '介護人材',
  '介護職員', '資格取得支援',
  '働きながら資格', 'ケアワーカー',
  '福祉専門職', '国家試験受験',
  '受験資格',
];
const negate = [
  'still studying care',
  'これから研修',
];
const nullPins = [
  'about to take the exam',
];
const establishedPins = [
  ['まだ受講中', 'negate'],
];

describe('pass DLI: care-worker qualification idioms (marimba)', () => {
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
