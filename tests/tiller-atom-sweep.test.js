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
  'rail franchise renewed', 'bus route licensed',
];
const closeTabJa = [
  // 制度・安全
  '公共交通オープンデータ', '交通系ic',
  '運賃審査', '運賃上限',
  '交通事業者',
  '旅客輸送', '輸送安全',
  '安全マネジメント', '運輸審議会',
  '交通政策審議会',
  // 法制・線路
  '地域公共交通確保維持改善法', '廃線',
  '線路', '線路敷設免許',
  '新交通システム',
  '索道', 'バス事業',
  '高速バス', 'タクシー事業',
  'ハイヤー',
  // 運送・地域
  '旅客自動車運送事業', '交通空白地',
  '交通不便地', '乗降場',
  '標柱',
  'バス停', '停留所',
  '定期券', '回数券',
  '普通運賃',
  // 運賃・乗務
  '運賃認可', '運賃届出',
  '運賃割引', '乗務員',
  '整備管理者',
  '安全規程', '運輸規程',
  '駅構内', '改札',
  'ホームドア',
  // 運行
  '運行計画', 'ダイヤ',
  '始発', '増発',
  '減便',
  '迂回運転', '代行バス',
  '乗継割',
];
const negate = [
  'still awaiting the fare approval',
  'まだ開通前', 'まだ就航前',
];
const nullPins = [
  'about to visit the rail bureau',
  'about to file the route notice',
];
const establishedPins = [
  ['鉄道事業法', 'close-tab'],
  ['私鉄', 'close-tab'],
  ['地下鉄', 'close-tab'],
  ['モノレール', 'close-tab'],
  ['路線バス', 'close-tab'],
  ['運転士', 'close-tab'],
  ['運行管理者', 'close-tab'],
  ['終電', 'close-tab'],
  ['still awaiting the route permit', 'negate'],
  ['まだ運行前', 'negate'],
];

describe('pass DCXCIX: passenger-transport operations (tiller)', () => {
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
