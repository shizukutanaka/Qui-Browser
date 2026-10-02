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
  // bathroom & dress
  'flossed', 'showered and dressed',
  'got dressed', 'dressed for work',
  'hair done',
  // kitchen & pack
  'packed my bag', 'coffee made',
  'breakfast done', 'bed made morning',
  // departure
  'out the door on time', 'caught the train',
  'commute done morning', 'kids off to school',
  'family out the door', 'morning routine done',
  'walked the dog morning', 'watered the plants morning',
];
const closeTabJa = [
  '歯磨き終了', '顔を洗って',
  'シャワーを浴びて', '服を着て',
  '化粧終了', '髪を整えて',
  'カバンを準備して', 'お弁当を作って',
  'コーヒーを淹れて', '朝ごはん終了',
  '家を出て', '電車に乗って',
  '家族が出て', '朝の支度終了',
  '犬を散歩して', '花に水をやって',
];
const negate = [
  'still getting ready', 'still in the bathroom',
  'まだ準備中です', 'まだお風呂中',
];
const nullPins = [
  'about to shower', 'mid shower',
  'toothbrush', 'pajamas on',
  'これからシャワー', '支度の途中',
  '歯ブラシ', 'パジャマ',
];
const establishedPins = [
  ['teeth brushed', 'close-tab'], ['makeup done', 'close-tab'],
  ['lunch packed', 'close-tab'],
  ['着替え終了', 'close-tab'], ['布団を畳んで', 'close-tab'],
  ['通勤終了', 'close-tab'], ['子供を送って', 'close-tab'],
];

describe('pass CCCLXXXVI: morning-routine end idioms (thistle)', () => {
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
