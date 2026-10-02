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
  // medical-expense subsidy paperwork done
  'subsidy card received', 'medical voucher issued',
];
const closeTabJa = [
  '特定医療費受給者証', '乳幼児医療費助成',
  '子ども医療費助成', 'ひとり親医療費助成',
  '難病医療費助成', '医療費受給者証',
  '福祉医療', '障害者医療助成',
  '医療券交付', '助成申請',
  '所得審査', '受給者証交付',
  '負担額軽減', '小児慢性特定疾病',
  '児童医療費',
];
const negate = [
  'still under income review',
  'まだ受給前', 'これから助成申請',
];
const nullPins = [
  'about to submit', 'about to file',
];
const establishedPins = [
  ['about to claim', 'negate'],
];

describe('pass DLVI: medical-expense subsidy idioms (carillon)', () => {
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
