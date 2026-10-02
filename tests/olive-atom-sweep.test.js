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
  // shift over
  'night shift done', 'graveyard shift done',
  'night duty done', 'overnight done',
  'all nighter done', 'pulled an all nighter',
  'survived the night', 'double shift done',
  'double done', 'overtime done', 'late shift done',
  'swing shift done', 'second shift done',
  'third shift done',
  // morning / handover
  'sun came up', 'sunrise after shift',
  'morning came', 'handover done shift',
  'handed over to day crew', 'day crew relieved',
  'relieved by morning crew',
  // rounds / lockup
  'last round done guard', 'patrol done night',
  'lockup done night', 'building locked night',
  'alarms set night', 'quiet night over',
  'no calls all night',
  // home / recovery
  'breakfast after shift', 'home from the night',
  'back from night shift', 'on call done',
  'pager off duty', 'woke up after night',
  'sleep during day done',
];
const closeTabJa = [
  '夜勤明け', '夜勤終了', '夜勤が終わって',
  '徹夜勤務終了', '徹夜が終わって',
  '夜通し働いて', '朝を迎えて', '日が昇って',
  '日勤と交代して', '朝番に引き継いで',
  '交代が来て', '引き継ぎを済ませて',
  '夜間巡回終了', '見回り終了',
  '警備が終わって', '施錠を確認して',
  '最終確認をして', '夜は何事もなく',
  'コールなしで', '仮眠から起きて',
  '仮眠終わり', '朝帰りして',
  '夜勤を抜けて', '二直終了', '夜直終了',
  '当直終了', '宿直終了', '遅番終了',
  '遅番が終わって', '日勤に戻って',
  '睡眠を取って',
];
const negate = [
  'still on night shift', 'まだ夜勤中',
];
const nullPins = [
  'about to start night', 'mid shift',
  'night rounds', 'bunk room', 'on call',
  'night float',
  '夜勤の途中', 'これから夜勤',
  '当直室', '夜勤表',
];
const establishedPins = [
  ['rounds done', 'close-tab'],
  ['call room empty', 'device-apps'],
  ['night shift tomorrow', 'date'], ['明日夜勤', 'defer'],
];

describe('pass CCCLXV: night-shift & overnight end idioms (olive)', () => {
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
