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
  // overtime wrap
  'finished the overtime', 'clocked out late',
  'last one in the office', 'turned off the office lights',
  'locked the office', 'sent the last email',
  'emails cleared', 'desk cleared',
  'left the office late', 'missed the last train',
  'took the taxi home', 'burning the midnight oil',
  'survived the crunch', 'deploy done and dusted',
];
const closeTabJa = [
  '残業終了', '定時に上がって',
  '終業チャイム', '退社しました',
  'オフィスを出て', '最終メールを送って',
  'メールを全部返して', '終電を逃して',
  'タクシーで帰って', '繁忙期を乗り切って',
  '修羅場が終わって',
];
const negate = [
  'still working late', 'still at the desk',
  'まだ残業中', 'まだ会社にいる',
];
const nullPins = [
  'about to head home', 'mid overtime',
  'timesheet', 'overtime form',
  'これから帰宅', '残業の途中',
  'タイムカード', '勤怠表',
];
const establishedPins = [
  ['overtime done', 'close-tab'],
  ['施錠して', 'close-tab'],
  ['デスクを片付けて', 'close-tab'],
  ['終電に間に合って', 'close-tab'],
];

describe('pass CCCXCIII: overtime wrap-up & last-out idioms (petunia)', () => {
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
