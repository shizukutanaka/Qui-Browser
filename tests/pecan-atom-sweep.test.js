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
  // gym & class signup
  'joined the gym', 'gym membership done',
  'signed up for classes', 'enrolled in the course',
  'trial class done', 'membership activated',
  'paid the dues', 'got the membership card',
  'dojo joined',
];
const closeTabJa = [
  'ジムに入会して', 'ジム契約をして',
  'レッスンを申し込んで', 'コースに申し込んで',
  '体験レッスンを受けて', '初回利用をして',
  '会員証を受け取って', '月謝を払って',
  '道場に入門して', 'スクールに入会して',
];
const negate = [
  'still deciding on a gym', 'still touring gyms',
  'まだジム探し中', 'まだ検討中',
];
const nullPins = [
  'about to sign up', 'mid enrollment',
  'membership form', 'class schedule',
  'これから入会届', '入会手続き中',
  '入会申込書', 'レッスン表',
];
const establishedPins = [
  ['first visit done', 'close-tab'],
];

describe('pass CDXI: gym & class signup idioms (pecan)', () => {
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
