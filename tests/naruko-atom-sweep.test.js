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
  // public-housing application procedures done
  'housing application entered', 'lottery won',
  'move-in approved',
  'application withdrawn',
];
const closeTabJa = [
  '市営住宅', '県営住宅',
  '公営住宅', '団地申込',
  '入居抽選', '当選通知',
  '申込期間', '収入証明',
  '入居面接', '住宅カード',
  'ur賃貸', '公社住宅',
  '家賃減額', '世帯人数',
];
const negate = [
  'still on the waitlist', 'about to enter the lottery',
  'まだ抽選待ち',
];
const nullPins = [
  'mid application',
];
const establishedPins = [
  ['income certificate submitted', 'security-status'],
  ['これから申込', 'negate'],
];

describe('pass DXI: public-housing application idioms (naruko)', () => {
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
