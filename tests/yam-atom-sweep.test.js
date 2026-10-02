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
  // vaccine & screening booking done
  'vaccine booked', 'got the shot',
  'booster done', 'flu shot done',
  'observation over', 'screening booked',
  'checkup scheduled', 'reminder set',
];
const closeTabJa = [
  'ワクチンを予約して', '接種してきて',
  '3回目を打って', 'インフルの注射をして',
  '経過観察が終わって', '副反応が出て',
  '検診を予約して', '人間ドックを予約して',
  'リマインダーを設定して', '接種証明をもらって',
];
const negate = [
  'still waiting out the shot', 'still sore',
  'まだ経過観察中', 'まだ腕が痛い',
];
const nullPins = [
  'about to get the shot', 'mid observation',
  'consent form', 'vaccine record',
  'これから接種', '観察の途中',
  '同意書', '接種券',
];
const establishedPins = [
  ['certificate issued', 'security-status'],
];

describe('pass CDXXXI: vaccine & screening booking idioms (yam)', () => {
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
