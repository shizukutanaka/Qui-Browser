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
  // leave-end & trip wrap-up
  'last day of leave', 'used up my pto',
  'all leave burned', 'packed the bags',
  'hotel checked out', 'travel journal done',
  'laundry done after trip',
];
const closeTabJa = [
  '有給を消化して', '休暇最終日',
  '連休が終わって', '旅の荷物を片付けて',
  '旅行日記を書いて', '旅行の洗濯をして',
  '休みを使い切って', '有休を取りきって',
];
const negate = [
  'still on leave', 'still vacationing',
];
const nullPins = [
  'about to take leave', 'mid vacation',
  'leave request', 'pto balance',
  'これから有給', '休暇の途中',
  '休暇届', '有給残り',
];
const establishedPins = [
  ['vacation over', 'close-tab'],
  ['staycation done', 'close-tab'],
  ['ホテルを出て', 'close-tab'],
  ['お土産を買って', 'close-tab'],
  ['まだ休暇中', 'negate'],
  ['まだ旅行中', 'negate'],
];

describe('pass CDXXIII: leave-end & trip wrap-up idioms (mizuna)', () => {
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
