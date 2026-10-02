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
  // personal bankruptcy & debt-restructuring filing done (債務整理申立の終了側)
  'bankruptcy filed', 'discharge granted',
  'debts discharged', 'petition filed',
  'restructuring approved', 'plan confirmed',
  'trustee assigned', 'credit counseling done',
  'exempt assets',
];
const closeTabJa = [
  '個人再生', '債務整理',
  '任意整理', '免責決定',
  '再生計画', '債権者集会',
  '弁護士相談', '整理終了',
];
const negate = [
  'still repaying',
];
const nullPins = [
  'mid proceedings',
];
const establishedPins = [
  ['自己破産', 'close-tab'],
  ['破産宣告', 'close-tab'],
  ['まだ返済中', 'negate'],
  ['これから申立', 'negate'],
  ['about to file', null],
];

describe('pass CDLXXXVII: bankruptcy & debt-restructuring idioms (ryuteki)', () => {
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
