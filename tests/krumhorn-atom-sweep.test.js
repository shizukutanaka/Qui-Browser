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
  // consumer complaint filed & fraud case reported
  'consumer complaint filed', 'fraud case reported',
];
const closeTabJa = [
  '消費生活相談', '消費生活センター',
  '電話勧誘', '消費者庁',
  '消費者委員会', '消費者被害',
  '消費者相談員', '消費者団体',
  '消費者ホットライン', '適格消費者団体',
  '差止請求', '消費者契約法',
  '団体訴訟', '景品表示法',
  '不当表示', '優良誤認',
  '有利誤認', '消費者紛争',
];
const negate = [
  'still waiting on the consumer case',
  'まだ被害届前', 'これから消費者相談',
];
const nullPins = [
  'about to call the hotline', 'about to file the consumer complaint',
];
// Already-pinned literals kept at their earlier routing.
const establishedPins = [
  ['消費者センター', 'close-tab'], ['訪問販売', 'close-tab'],
  ['マルチ商法', 'close-tab'], ['架空請求', 'close-tab'],
  ['還付金詐欺', 'close-tab'], ['特定商取引法', 'close-tab'],
  ['中途解約', 'close-tab'],
  ['まだ相談前', 'negate'], ['これから被害申請', 'negate'],
];

describe('pass DXCII: consumer-affairs & fraud-complaint idioms (krumhorn)', () => {
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
  test.each(establishedPins)('"%s" stays %s (pin)', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
