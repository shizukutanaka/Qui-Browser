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
  // care facility arrangement done
  'facility toured', 'care manager met',
  'level assessed', 'ramp installed',
  'handrails installed', 'day service booked',
];
const closeTabJa = [
  '施設を見学して', 'ケアマネと面談して',
  '要介護認定が出て', 'スロープをつけて',
  '手すりをつけて', 'デイサービスを申し込んで',
  '初回訪問が終わって',
];
const negate = [
  'still touring facilities', 'still waiting for assessment',
  'まだ施設探し中', 'まだ認定待ち',
];
const nullPins = [
  'about to tour', 'mid application',
  'nursing home', 'care level',
  'これから見学する', '申請中',
  '介護施設', '要介護認定',
];
const establishedPins = [
  ['move in date set', 'close-tab'],
  ['first visit done', 'close-tab'],
  ['契約を結んで', 'close-tab'],
  ['申請を出して', 'close-tab'],
  ['入居日が決まって', 'close-tab'],
];

describe('pass CDXXXVIII: care facility arrangement idioms (xigua)', () => {
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
