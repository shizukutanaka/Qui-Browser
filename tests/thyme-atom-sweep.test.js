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
  // insurance signup & coverage
  'insurance signed up', 'fire insurance done',
  'got insured', 'policy issued',
  'coverage started', 'home insurance done',
  // loan & screening
  'screening passed', 'preapproval done',
  'application accepted',
];
const closeTabJa = [
  '保険に入って', '保険加入',
  '保険証券が届いて', '保障が始まって',
  '住宅保険を決めて', 'ローンが通って',
  'ローン審査に通って', '仮審査が通って',
  '申し込みが通って', '団信に入って',
];
const negate = [
  'still waiting on insurance', 'still in underwriting',
  'まだ審査中', 'まだ保険手続き中',
];
const nullPins = [
  'about to apply', 'mid application',
  'insurance policy', 'loan documents',
  'これから申し込み', '申請の途中',
  '保険証券', 'ローン書類',
];
const establishedPins = [
  ['loan approved', 'close-tab'],
  ['mortgage approved', 'close-tab'],
  ['paperwork submitted', 'close-tab'],
  ['火災保険に入って', 'close-tab'],
  ['書類を提出して', 'close-tab'],
];

describe('pass CDIX: insurance & loan-approval idioms (thyme)', () => {
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
