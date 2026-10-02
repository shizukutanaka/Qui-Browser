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
  // mail-order returns & cooling-off procedure done (返品・クーリングオフの終了側)
  'return shipped', 'item returned',
  'exchange done', 'cooling off done',
  'rma issued',
];
const closeTabJa = [
  '返品して', '返金して',
  '交換して', 'クーリングオフ',
  '着払いで', '受け付けて',
];
const negate = [
  'still returning', 'about to return',
  'まだ返品中', 'これから返品',
];
const nullPins = [
  'mid return', 'returns counter',
  '返品窓口',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['refund received', 'close-tab'],
  ['label printed', 'close-tab'],
  ['返送して', 'close-tab'],
  ['梱包して', 'close-tab'],
  // cancel-intent stays a stop, not a tab-close
  ['キャンセルして', 'stop-everything'],
];

describe('pass CDLXIX: mail-order returns idioms (cornet)', () => {
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
