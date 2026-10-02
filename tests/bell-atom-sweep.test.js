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
  // community-facility bookings done
  'facility booking confirmed', 'community hall reserved',
];
const closeTabJa = [
  '公民館', '自治会館',
  '集会所', 'コミュニティセンター',
  '生涯学習センター', '市民ホール',
  '体育館予約', '施設利用申込',
  '使用料支払い', '団体登録',
  '貸出申請', '利用許可書',
  '利用票', 'キャンセル待ち',
  '施設使用料', '区民センター',
];
const negate = [
  'still waiting for the room',
  'まだ予約前',
];
const nullPins = [
  'about to reserve', 'about to register',
];
const establishedPins = [
  ['about to book', 'negate'],
  ['これから申込', 'negate'],
  ['予約確認', null],
];

describe('pass DLIV: community-facility booking idioms (bell)', () => {
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
