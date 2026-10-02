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
  // club/circle enrollment done
  'joined the club', 'club signup done',
  'first practice attended', 'club dues paid',
  'jersey issued', 'locker assigned',
  'circle registered', 'lesson trial done',
  'class booked', 'first session attended',
];
const closeTabJa = [
  '部活に入って', 'サークルに入って',
  '入部届を出して', '部費を払って',
  'ユニフォームをもらって', 'ロッカーをもらって',
  '習い事を申し込んで', '初回参加をして',
];
const negate = [
  'still deciding on clubs', 'still shopping around',
  'まだ部活選び中', 'まだ迷ってる',
];
const nullPins = [
  'about to join', 'mid tryouts',
  'club brochure', 'signup form',
  'もうすぐ入部', '体験の途中',
  '部活案内', '入会申込書',
];
const establishedPins = [
  ['初練習に行って', 'go-to'],
  ['体験レッスンに行って', 'go-to'],
];

describe('pass CDXXVII: club & circle enrollment idioms (quinoa)', () => {
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
