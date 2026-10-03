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
  // insurance claim & accident wrap-up done
  'claim approved', 'claim paid out',
  'adjuster visited', 'photos submitted',
  'police report filed', 'repairs authorized',
  'deductible paid',
];
const closeTabJa = [
  '保険金を請求して', '示談が成立して',
  '事故処理が終わって', '保険会社に連絡して',
  '写真を提出して', '事故証明を取って',
  '修理が認められて', '車が戻ってきて',
  '免責額を払って', '保険金が下りて',
];
const negate = [
  'still waiting on the claim', 'still under review',
  'まだ請求処理中', 'まだ示談交渉中',
];
const nullPins = [
  'about to file', 'mid claim',
  'insurance claim', 'accident report',
  'これから請求する', '査定中',
  '保険請求', '事故報告書',
];
const establishedPins = [
  ['claim filed', 'close-tab'],
  ['settlement reached', 'close-tab'],
  ['car back from the shop', 'close-tab'],
];

describe('pass CDXXXVI: insurance claim & accident wrap-up idioms (yuzu)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
