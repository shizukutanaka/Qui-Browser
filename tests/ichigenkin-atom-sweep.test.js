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
  // care-taxi & home-visit care service contract procedures done
  'care contract signed', 'home visit booked',
  'care taxi arranged', 'helper assigned',
  'service started', 'schedule fixed',
  'provider picked',
];
const closeTabJa = [
  '介護タクシー', '訪問介護',
  '介護契約',
  'ホームヘルパー',
  'サービス開始', '利用開始',
  '初回訪問', '事業者決定',
  'デイケア',
  '紹介済み',
];
const negate = [
  'still arranging', 'about to book',
  'まだ手配中',
];
const nullPins = [
  'contract pending', 'mid referral',
];
const establishedPins = [
  ['first visit done', 'close-tab'],
  ['訪問看護', 'close-tab'],
  ['まだ契約中', 'negate'],
  ['ケアマネ', null],
  ['福祉用具', null],
  ['これから契約', null],
];

describe('pass CDXCVI: care-taxi & home-visit service idioms (ichigenkin)', () => {
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
