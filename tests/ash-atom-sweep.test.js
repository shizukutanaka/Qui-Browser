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
  // lunch break end
  'lunch break over', 'back from lunch',
  'lunch run done', 'grabbed a bite back',
  'cafeteria emptied', 'lunchbox done',
  'second half started', 'back to work lunch',
  // recess / school break
  'recess over', 'bell rang recess',
  'playground emptied', 'recess done',
  'recess bell rang',
  // short breaks
  'break time done', 'coffee break over',
  'smoke break done', 'fifteen minute break done',
  'quick break done', 'tea time done',
  'siesta over', 'power nap done',
  'afternoon slump survived',
];
const closeTabJa = [
  '昼休み終了', 'お昼を終えて',
  '昼食を済ませて', 'ランチ終了',
  '学食を出て',
  '休み時間終了', 'チャイムが鳴って休み',
  '校庭が空いて', '昼寝から起きて',
  'コーヒーブレイク終了', 'タバコ休憩終了',
  '席に戻って休憩', '午後に入って',
  '午後の授業', '午後イチ',
  '休憩終了', '息抜き終了',
  '一休み終了', '気分転換終了',
  '小腹を満たして', 'おやつを食べ終えて',
  '給湯室を出て', '売店を出て',
];
const negate = [
  'still on break', 'still at lunch',
  'まだ休憩中', 'まだ昼休み',
];
const nullPins = [
  'about to break', 'mid break',
  'lunch box', 'coffee mug', 'break room',
  'vending machine',
  '休憩の途中', 'これから休憩',
  '自動販売機コーナー', '売店', '給湯室',
];
const establishedPins = [
  ['弁当を食べ終えて', 'close-tab'],
  ['お昼寝終了', 'close-tab'],
  ['lunch tomorrow', 'date'],
];

describe('pass CCCLXXII: lunch-break & recess end idioms (ash)', () => {
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
