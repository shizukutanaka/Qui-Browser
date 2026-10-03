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
  'dam inspection passed', 'water intake permit granted',
];
const closeTabJa = [
  // ダム施設
  'ダム', '多目的ダム',
  'ダム建設', 'ダム撤去',
  'ダム湖', '貯水池',
  '砂防ダム', '治山ダム',
  '堰堤', '可動堰',
  // 水利・取水
  '利水', '水利権',
  '水利組合', '水利使用',
  '水利施設', '水源',
  '取水', '取水堰',
  '用水', '用水路',
  // 灌漑・設備
  '揚水', '水門',
  'ポンプ場', '灌漑',
  '土地改良区',
  // 区域・整備
  '河川敷', '河川区域',
  '占用許可', '河川整備',
  '河川改良',
  // 治水・水防
  '治水計画', '流域治水',
  '洪水', '洪水対策',
  '堤防強化', '堤防整備',
  // 水源保全
  '水源税', '水道水源保全',
  'ため池', 'ため池防災',
  // 渇水・資源
  '渇水対策', '節水対策',
  '水資源',
  // ダム管理・放流
  'ダム操作', 'ダム監視',
  'ダム放流', '水位警報',
];
const negate = [
  'still awaiting the dam review',
  'まだ放水前', 'まだ貯水中',
  'まだ放流中', 'これから放水',
];
const nullPins = [
  'about to file the dam report',
  'about to visit the reservoir',
];
const establishedPins = [
  ['排水機場', 'close-tab'],
  ['樋門', 'close-tab'],
  ['渇水', 'close-tab'],
  ['堤防', 'close-tab'],
  ['浸水被害', 'close-tab'],
  ['河川管理', 'close-tab'],
  ['水防団', 'close-tab'],
  ['still awaiting the water permit', 'negate'],
  ['まだ避難前', 'negate'],
  ['これから避難', 'negate'],
];

describe('pass DCLXXXIX: water-resources & dam administration (weir)', () => {
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
