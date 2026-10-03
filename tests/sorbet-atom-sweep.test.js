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
  // disaster-management verbs
  'evacuation order lifted', 'shelter opened',
];
const closeTabJa = [
  // 法制・機関
  '災害救助法', '激甚災害法',
  '消防救助機動部隊', '災害ボランティアセンター',
  '東日本大震災', '阪神淡路大震災',
  // 避難
  '避難所', '避難勧告',
  '緊急避難', '警戒レベル',
  '避難情報', '避難判断',
  // 警報・情報
  '土砂災害警戒情報', '洪水警報',
  '大雨警報', '暴風警報',
  '大雪警報', '高潮警報',
  '津波注意報', '大津波警報',
  '緊急速報', 'エリアメール',
  // 区域・移転
  '災害危険区域', '危険区域',
  '集団移転', '災害公営住宅',
  '借り上げ仮設',
  // 復旧・被災
  '応急復旧', '恒久復旧',
  '被災地', '罹災',
  // 防災活動
  '防災', '避難',
  '防災訓練', '点呼',
  '消防', '救急',
];
const negate = [
  'still awaiting the disaster declaration',
  'まだ避難前', 'これから避難',
  'まだ復旧中',
];
const nullPins = [
  'about to file the damage report',
  'about to visit the evacuation shelter',
];
const establishedPins = [
  ['災害対策基本法', 'close-tab'],
  ['緊急消防援助隊', 'close-tab'],
  ['復興庁', 'close-tab'],
  ['避難指示', 'close-tab'],
  ['ハザードマップ', 'close-tab'],
  ['風水害', 'close-tab'],
  ['津波警報', 'close-tab'],
  ['土砂災害', 'close-tab'],
  ['急傾斜地', 'close-tab'],
  ['警戒区域', 'close-tab'],
  ['河川管理', 'close-tab'],
  ['水防団', 'close-tab'],
];

describe('pass DCLXXXIV: disaster-management & crisis-response administration (sorbet)', () => {
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
