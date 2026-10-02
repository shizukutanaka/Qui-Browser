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
  // small-business support consultations done
  'mentoring session done',
];
const closeTabJa = [
  '商工会', '商工会議所',
  '創業塾', '経営相談',
  'マル経', '経営力強化支援',
  '中小企業支援センター', 'よろず支援拠点',
  '資金調達', '経営改善計画',
  '記帳指導', '税務相談',
  '融資申込', '創業融資',
  '創業スクール', '専門家派遣',
  'ビジネスサポート',
];
const negate = [
  'still in the program',
  'まだ参加中', 'これから融資',
];
const nullPins = [
  'about to borrow', 'about to network',
];
const establishedPins = [
  ['loan approved', 'close-tab'],
];

describe('pass DLV: small-business support idioms (chime)', () => {
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
