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
  // insurance-review & policy-checkup done (保険見直しの終了側)
  'policy reviewed', 'coverage compared',
  'rider added', 'beneficiary changed',
  'agent consulted', 'premium lowered',
  'deductible raised', 'policy renewed',
];
const closeTabJa = [
  '保険を見直して', '保障を比較して',
  '特約をつけて', '受取人を変えて',
  '保険料を下げて', '証券を確認して',
  '契約者を変えて', '生命保険を見直して',
];
const negate = [
  'still comparing', 'about to renew',
  'まだ見直し中', 'これから見直す',
];
const nullPins = [
  'mid review', 'insurance review', 'policy checkup',
  '保険見直し中', '証券', '保険相談',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['quotes collected', 'close-tab'],
  ['見積もりを取って', 'close-tab'],
];

describe('pass CDLXII: insurance-review idioms (oboe)', () => {
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
