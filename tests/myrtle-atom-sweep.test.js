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
  // driving school & tests
  'driving school done', 'passed the driving test',
  'got my license', 'provisional license',
  'learners permit done', 'behind the wheel done',
  'driving lesson done', 'final driving exam',
  'road test passed', 'written test passed',
  'graduated driving school', 'license in hand',
];
const closeTabJa = [
  '教習所終了', '仮免許を取って',
  '卒業検定合格', '路上教習終了',
  '学科試験合格', '教習終了',
  '卒検合格', '免許証を受け取って',
];
const negate = [
  'still learning to drive', 'still in driving school',
  'まだ教習中',
];
const nullPins = [
  'about to take the test', 'mid driving lesson',
  'learners handbook', 'test appointment',
  'これから試験', '教習の途中',
  '教本', '試験予約',
];
const establishedPins = [
  ['運転免許を取って', 'close-tab'],
  ['まだ練習中', 'negate'],
];

describe('pass CCCXC: driving-school & license-test end idioms (myrtle)', () => {
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
