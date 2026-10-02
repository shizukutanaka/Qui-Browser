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
  // single-parent allowance & support procedures done
  'allowance claim filed', 'single parent registered',
  'renewal filed', 'support meeting done',
  'family court done',
];
const closeTabJa = [
  'ひとり親', '母子手当',
  '支給認定', '所得証明',
  '現況届', '支援員面談',
  '父子家庭', 'ひとり親家庭',
  '児童育成手当',
];
const negate = [
  'about to file the claim',
];
const nullPins = [
  'claim pending', 'mid certification',
  '認定待ち',
];
const establishedPins = [
  ['certificate issued', 'security-status'],
  ['first payment received', 'close-tab'],
  ['income verified', 'close-tab'],
  ['児童扶養手当', 'close-tab'],
  ['更新手続き', 'close-tab'],
  ['still applying', 'negate'],
  ['まだ申請中', 'negate'],
  ['これから申請', 'negate'],
];

describe('pass DI: single-parent allowance procedures (komabue)', () => {
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
