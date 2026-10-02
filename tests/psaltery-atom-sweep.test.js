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
  // elderly meal-delivery & medication management set up (配食・服薬管理の手配終了側)
  'meal delivery set up', 'pill organizer filled',
  'weekly delivery', 'pharmacy delivery',
  'grocery delivery set', 'rehab scheduled',
];
const closeTabJa = [
  '配食サービス', 'お薬カレンダー',
  '服薬ゼリー', '宅配弁当を頼んで',
  'デイサービスに申し込んで', '薬を分けて',
  'リハビリ予約', '訪問看護',
];
const negate = [
  'still sorting',
  'まだ申込中', 'これから申し込む',
];
const nullPins = [
  'mid setup', 'home helper',
  'care manager', 'ケアマネ',
  '福祉用具',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['meds sorted', 'close-tab'],
  ['about to sort', 'negate'],
];

describe('pass CDLXXIII: meal-delivery & medication-management idioms (psaltery)', () => {
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
