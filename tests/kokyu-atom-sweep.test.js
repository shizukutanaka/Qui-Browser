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
  // divorce mediation & custody agreement concluded (離婚調停・親権協議の終了側)
  'mediation concluded', 'custody settled',
  'divorce finalized', 'alimony set',
  'property divided', 'settlement signed',
  'support ordered', 'visitation arranged',
  'decree issued',
];
const closeTabJa = [
  '調停成立', '親権決定',
  '財産分与', '慰謝料',
  '養育費', '面会交流',
  '合意書', '公正証書',
];
const negate = [
  'still mediating', 'about to mediate',
  'まだ調停中', 'これから調停',
];
const nullPins = [
  'mid divorce',
];
const establishedPins = [
  ['離婚調停', 'close-tab'],
  ['離婚届', 'close-tab'],
];

describe('pass CDLXXXVIII: divorce mediation & custody idioms (kokyu)', () => {
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
