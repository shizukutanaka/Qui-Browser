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
  // care-insurance copay-tier procedures done
  'burden tier assessed', 'limit amount approved',
  'copay refund received', 'tier changed',
];
const closeTabJa = [
  '負担割合証', '負担限度額認定',
  '限度額認定証', '所得区分',
  '高額介護サービス費', '高額医療介護合算',
  '特定入所者介護', '施設食費',
  '居住費', '世帯分離',
  '境界層', '非課税世帯',
  '生活保護受給', '還付手続き',
  '窓口負担',
];
const negate = [
  'still reviewing the tier', 'about to apply for the limit',
  'まだ認定審査中', 'これから限度額申請',
];
const nullPins = [
  'mid assessment',
];
const establishedPins = [
  ['copay certificate received', 'security-status'],
  ['1割負担', 'percent-jump'],
  ['2割負担', 'percent-jump'],
  ['3割負担', 'percent-jump'],
];

describe('pass DXXV: care-insurance copay-tier idioms (tettsui)', () => {
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
