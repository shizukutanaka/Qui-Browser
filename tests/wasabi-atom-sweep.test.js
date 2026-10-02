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
  // furusato & resident-tax done (ふるさと納税・住民税の終了側)
  'furusato filed', 'furusato done',
  'hometown tax done', 'one stop filed',
  'resident tax adjusted', 'tax notice arrived',
  'donation limit checked', 'return gifts picked',
];
const closeTabJa = [
  'ふるさと納税を済ませて', 'ワンストップを出して',
  '限度額を確認して', '返礼品を選んで',
  '住民税の通知が来て', '確定申告の後片付け',
  '住民税を納めて', '納税を済ませて',
];
const negate = [
  'still doing furusato', 'about to file furusato',
  'まだふるさと納税中', 'これからふるさと納税',
];
const nullPins = [
  'mid furusato', 'furusato', 'one stop',
  '途中で止まって', 'ふるさと納税', 'ワンストップ',
];
const establishedPins = [
  ['refund deposited', 'close-tab'],
  ['tax paid', 'close-tab'],
  ['還付金が振り込まれて', 'close-tab'],
  ['税理士に任せて', 'close-tab'],
];

describe('pass CDXLII: furusato & resident-tax idioms (wasabi)', () => {
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
