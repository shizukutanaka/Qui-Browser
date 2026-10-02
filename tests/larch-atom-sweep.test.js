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
  // arrived at work/school
  'made it to work', 'at my desk now',
  'commute done', 'rush hour over',
  'through the ticket gate', 'off the train commute',
  'walked in the door', 'home from work',
  'home from school', 'last transfer done',
  // transport legs
  'caught the bus', 'caught my train',
  'bike locked up', 'parked at the station',
  'train pulled in station', 'crowded train survived',
  'seat found train', 'missed the rush',
  'commute survived', 'back before dark',
  // school run / walking
  'kids at school', 'drop off done commute',
  'school run done', 'walked to the office',
  'biked to work done',
];
const closeTabJa = [
  '通勤終了', '会社についた', 'オフィス到着',
  '改札を出て', '乗り換え終了',
  'ラッシュを抜けて', '満員電車を下りて',
  '自転車を止めて', '終電に間に合って',
  '帰宅して家に', '家についた',
  'ただいま帰宅', '通学終了',
  '学校についた', '登校しました',
  '下校して家に', '送りました子供',
  '子供を送って', 'チャリを止めて',
  '駐輪場に停めて', '定期を通して',
  '電車を降りて', '座れました電車',
  '通勤ラッシュ終了',
];
const negate = [
  'still commuting', 'still on the train',
  'まだ通勤中', 'まだ電車の中',
];
const nullPins = [
  'about to commute', 'mid commute',
  'train pass', 'commuter pass', 'bike lock',
  'station platform',
  '通勤の途中', 'これから通勤',
  '定期券', '駐輪場',
];
const establishedPins = [
  ['traffic cleared', 'close-tab'],
  ['parking spot found', 'close-tab'],
  ['帰宅しました', 'close-tab'],
  ['バスを降りて', 'close-tab'],
  ['渋滞を抜けて', 'close-tab'],
  ['ホーム', 'home'],
  ['commute tomorrow', 'date'], ['明日通勤', 'defer'],
];

describe('pass CCCLXX: commute & school-run end idioms (larch)', () => {
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
