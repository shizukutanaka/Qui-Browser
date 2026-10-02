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
  // unemployment & jobseeker filing done (失業保険・求職手続きの終了側)
  'unemployment filed', 'jobseeker registered',
  'benefit days counted', 'first payment received',
  'work search logged', 'hello work done',
  'severance paid', 'benefits started',
];
const closeTabJa = [
  '失業保険', '求職登録',
  '受給資格', '給付日数',
  '失業認定', '就職手当',
  '再就職手当', '雇用保険',
  '離職理由',
];
const negate = [
  'still claiming',
  'まだ受給中',
];
const nullPins = [
  'mid certification',
];
const establishedPins = [
  ['claim approved', 'close-tab'],
  ['about to claim', 'negate'],
  ['ハローワークに行って', 'go-to'],
  ['これから手続き', null],
];

describe('pass CDLXXXIII: unemployment-insurance idioms (erhu)', () => {
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
