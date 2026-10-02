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
  // presumed-death declaration & missing-person procedures done
  'presumed dead', 'missing person found',
  'vanished for seven years', 'estate opened',
  'survivor benefits paid', 'search called off',
];
const closeTabJa = [
  '失踪宣告', '認定死亡',
  '失踪届', '行方不明者',
  '七年経過', '遺産凍結',
  '捜索願', '捜索終了',
];
const negate = [
  'still searching', 'search ongoing',
  'still searching for them',
  'まだ捜索中', 'これから捜索',
];
const nullPins = [
  'about to declare', 'still missing',
];
const establishedPins = [
  ['declared dead', 'close-tab'],
  ['死亡届', 'close-tab'],
  ['死亡診断書', 'close-tab'],
  ['death certificate issued', 'security-status'],
  ['account frozen', 'trouble'],
];

describe('pass CDXCII: presumed-death & missing-person idioms (shakuhachi)', () => {
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
