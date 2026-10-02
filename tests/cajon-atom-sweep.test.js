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
  // welfare-council joined & community-bus boarded
  'welfare-council joined', 'community-bus boarded',
];
const closeTabJa = [
  '社会福祉協議会', '社協',
  '地域福祉コーディネーター', '福祉有償運送',
  '地域福祉ボランティア', '福祉バス',
  '移送サービス', '善意銀行',
  'たすけあい', '共生型デイ',
  '地域福祉計画', '近隣支え合い',
  '助け合い活動', '福祉おばさん',
  '福祉おじさん', '福祉委員',
  '町内福祉員',
];
const negate = [
  'still awaiting welfare review',
  'まだ相談窓口', 'これから登録面談',
];
const nullPins = [
  'about to volunteer locally', 'about to serve',
];
const establishedPins = [
  ['社協窓口', 'close-tab'],
  ['ボランティアセンター', 'close-tab'],
  ['配食サービス', 'close-tab'],
  ['まだ申込前', 'negate'],
];

describe('pass DLXXI: community-welfare council & mutual-aid idioms (cajon)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
