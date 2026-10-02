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
  // break end
  'weekend over', 'long weekend over',
  'reality check back', 'sunday night back',
  'monday reset', 'back in the grind',
  'back to the grind', 'days off used',
  'pto over', 'staycation done',
  'staycation over',
  // unpacking / re-entry chores
  'suitcase unpacked', 'unpacked the suitcase',
  'jet lag gone', 'jet lag over',
  'beat the jet lag', 'souvenirs handed out',
  'gifts handed out trip', 'mail collected home',
  'plants watered back', 'fridge restocked home',
  'laundry done back', 'album done trip',
  // routine resumed
  'back at the desk', 'office bound again',
  'routine resumed',
];
const closeTabJa = [
  '週末終了', '三連休終了',
  '休み明け', '休暇明け',
  'ゴールデンウィーク終了', 'シルバーウィーク終了',
  '休暇を終えて', '仕事モードに戻って',
  '旅の思い出をしまって', '土産を配って',
  '時差ボケが治って', 'スーツケースを空にして',
  '旅行から戻って', '帰省から戻って',
  '羽伸ばし終了', '骨休め終了',
  'リフレッシュ休暇終了',
];
const negate = [
  'still on vacation', 'still on holiday',
  'まだ休暇中',
];
const nullPins = [
  'about to travel', 'mid vacation',
  'suitcase', 'travel pillow', 'duty free bag',
  '休暇の途中', 'これから旅行',
  'スーツケース', 'お土産',
];
const establishedPins = [
  ['long weekend done', 'close-tab'],
  ['holiday over', 'close-tab'],
  ['back from vacation', 'close-tab'],
  ['vacation done', 'close-tab'],
  ['back to reality', 'close-tab'],
  ['連休終了', 'close-tab'],
  ['お盆休み終了', 'close-tab'],
  ['現実に戻って', 'close-tab'],
  ['日常に戻って', 'close-tab'],
  ['まだ旅行中', 'negate'],
  ['holiday tomorrow', 'date'], ['明日休み', 'defer'],
];

describe('pass CCCLXXI: vacation-return & long-weekend end idioms (alder)', () => {
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
