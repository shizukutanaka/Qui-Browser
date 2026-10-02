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
  // late-elderly medical insurance procedures done
  'insurance card received',
  'copay tier set',
  'high-cost refund filed',
];
const closeTabJa = [
  '後期高齢者医療', '保険証交付',
  '負担割合', '特定疾病',
  '限度額適用認定証', '資格喪失',
  '医療費自己負担', '広域連合',
  '健診受診券',
];
const negate = [
  'まだ加入前', 'これから移行',
];
const nullPins = [
  'about to switch',
  '75歳', 'フレイル',
];
const establishedPins = [
  ['still enrolled', 'negate'],
  ['後期高齢者', 'close-tab'],
  ['高額療養費', 'close-tab'],
  ['被保険者証', 'close-tab'],
  ['窓口負担', 'close-tab'],
  ['まだ手続き中', 'negate'],
];

describe('pass DXLIII: late-elderly medical insurance idioms (trumpet)', () => {
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
