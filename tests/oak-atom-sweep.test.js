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
  // purchase closing & loan
  'house bought', 'bought the house',
  'mortgage approved', 'loan approved',
  'loan application done', 'offer accepted on the house',
  'went into escrow', 'closed on the house',
  'inspection done', 'appraisal done',
  'title done', 'deed done',
];
const closeTabJa = [
  '住宅ローンが通って', 'ローン審査を通して',
  '売買契約を結んで', '決済を済ませて',
  '登記が終わって', '内覧会をして',
  '検査を受けて', '査定をして',
  'マンションを買って', '家を買って',
  '手付金を払って',
];
const negate = [
  'still house hunting', 'still in escrow',
  'まだ物件探し中', 'まだローン審査中',
];
const nullPins = [
  'about to close', 'mid escrow',
  'purchase agreement', 'mortgage paperwork',
  'これから決済', '審査の途中',
  '売買契約書', '重要事項説明',
];
const establishedPins = [
  ['offer accepted', 'close-tab'],
  ['escrow closed', 'close-tab'],
  ['closing done', 'close-tab'],
];

describe('pass CDIV: home-purchase closing idioms (oak)', () => {
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
