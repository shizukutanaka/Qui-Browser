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
  // narai-goto level-up done (習い事進級・修了の終了側)
  'level cleared', 'advanced class reached',
  'final lesson done', 'swim class passed',
  'piano book finished', 'belt rank earned',
];
const closeTabJa = [
  '級が上がって', '上級クラスに進んで',
  '最後のレッスンを終えて', '進級テストに受かって',
  '教室を卒業して', '水泳教室を終えて',
  'ピアノ教室を卒業して',
];
const negate = [
  'still taking lessons', 'about to finish level',
  'まだ教室に通って', 'これから進級テスト',
];
const nullPins = [
  'mid course', 'music class', 'swim school',
  'レッスン継続中', '習い事', 'スイミング教室',
];
const establishedPins = [
  ['course finished', 'close-tab'],
  ['certificate earned', 'security-status'],
  ['級を取って', 'close-tab'],
  ['修了証をもらって', 'close-tab'],
  ['テキストを終えて', 'close-tab'],
];

describe('pass CDLII: narai-goto level-up idioms (crappie)', () => {
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
