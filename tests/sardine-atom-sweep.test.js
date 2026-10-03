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
  // seawall finished & marina permit granted
  'seawall finished', 'marina permit granted',
];
const closeTabJa = [
  '海岸侵食', '防潮堤',
  '護岸工事', '砂浜保全',
  '人工養浜', '離岸堤',
  'テトラポット', '港湾管理',
  '港湾整備', '臨港地区',
  '臨港道路', '埠頭用地',
  'みなとオアシス', 'フェリーターミナル',
  'プレジャーボート', '海上交通',
  '航路測量', '海難調査',
  '小型船舶', '海上運送法',
  '水上バス', '海上公園',
  '埋立地', '海面埋立',
  '公有水面埋立', '港湾環境',
  '港湾再利用', '港湾税',
  '港湾施設', '特定重要港湾',
  '国際戦略港湾', 'ハブ港湾',
  '海岸法', '海岸保全区域',
  '津波防災',
];
const negate = [
  'still awaiting the harbor plan',
  'まだ埋立前', 'これから係留',
];
const nullPins = [
  'about to file the reclamation',
  'about to visit the marina',
];
const establishedPins = [
  ['防波堤', 'close-tab'],
  ['港湾区域', 'close-tab'],
  ['マリーナ', 'close-tab'],
  ['航路標識', 'close-tab'],
  ['海難審判', 'close-tab'],
  ['港湾計画', 'close-tab'],
  ['港湾管理者', 'close-tab'],
];

describe('pass DCLXVIII: coastal & harbor-facility administration (sardine)', () => {
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
