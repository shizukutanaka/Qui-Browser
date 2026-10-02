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
  // neighborhood-association accounting & dues collection done
  'accounts settled', 'cash counted',
  'treasurer done', 'receipts issued',
  'funds handed',
];
const closeTabJa = [
  '集金して', '集金袋を回して',
  '領収書を書いて', '会計報告',
  '保管して',
];
const negate = [
  'still collecting', 'about to collect',
  'まだ集金中', 'これから集金',
];
const nullPins = [
  'mid collection', 'association dues',
  '町内会費',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['dues collected', 'close-tab'],
  ['ledger balanced', 'close-tab'],
  ['books closed', 'close-tab'],
  ['会費を集めて', 'close-tab'],
  ['会計を締めて', 'close-tab'],
  ['帳簿をつけて', 'close-tab'],
  ['集金に行って', 'go-to'],
];

describe('pass CDLXVIII: association-accounting idioms (sax)', () => {
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
