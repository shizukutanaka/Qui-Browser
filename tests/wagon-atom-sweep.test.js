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
  // elder-care facility move-in contract procedures done
  'moved into the home', 'nursing home contract signed',
  'facility tour done', 'level of care assessed',
  'care plan signed', 'room assigned',
  'belongings moved in',
];
const closeTabJa = [
  '老人ホーム',
  '施設見学',
  '入居一時金', 'ケアプラン',
  '部屋決定', '持ち物搬入',
  '特別養護老人ホーム', '特養',
  '有料老人ホーム', 'サービス付き高齢者住宅',
  'サ高住',
];
const negate = [
  'まだ入居中',
];
const nullPins = [
  'assessment pending', 'waitlisted',
  '待機中',
];
const establishedPins = [
  ['deposit paid', 'close-tab'],
  ['still applying', 'negate'],
  ['要介護認定', null],
  ['入居契約', null],
  ['about to move in', null],
  ['これから入居', null],
];

describe('pass CDXCV: elder-care facility move-in idioms (wagon)', () => {
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
