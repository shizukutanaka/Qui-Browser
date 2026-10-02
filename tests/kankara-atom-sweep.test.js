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
  // amended-return & correction-of-record procedures done
  'amended return filed', 'correction filed',
  'refund claim filed', 'overpayment refunded',
  'tax office contacted', 'deduction added',
  'receipt resubmitted', 'blue return filed',
  'white return filed', 'audit closed',
  'notice answered',
];
const closeTabJa = [
  '修正申告', '更生の請求',
  '還付申告', '過納金',
  '追徴課税', '青色申告',
  '白色申告', '税務署',
  '控除追加', '領収書再提出',
  '異議申立',
];
const negate = [
  'still amending', 'about to amend',
  'まだ修正中', 'これから修正',
  'まだ更生中',
];
const nullPins = [
  'mid audit',
];

describe('pass CDXCIII: amended-return & correction idioms (kankara)', () => {
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
});
