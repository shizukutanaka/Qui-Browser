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
  // kids' lesson signup & transport logistics done
  'lessons signed up', 'first lesson done',
  'monthly fee paid', 'dropoff done',
  'uniform bought', 'recital registered',
  'class switched',
];
const closeTabJa = [
  'おけいこ',
  '月謝', '入門',
  '体験レッスン', '初回レッスン',
  '送迎', 'お迎え',
  '制服購入', '発表会申込',
  '級審査', '教室入会',
];
const negate = [
  'still in lessons', 'about to start lessons',
  'まだ習い事中', 'これから習い事',
  'まだ送迎中',
];
const nullPins = [
  'registration pending', 'mid term',
];
const establishedPins = [
  ['習い事', null],
  ['pickup done', 'close-tab'],
  ['kids dropped off', 'close-tab'],
  ['kids picked up', 'close-tab'],
  ['迎えに行って', 'go-to'],
];

describe('pass CDXCVIII: kids lessons & transport idioms (tonkori)', () => {
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
