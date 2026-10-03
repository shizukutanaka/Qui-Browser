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
  // launch & deployment
  'launch window opened', 'satellite deployed',
];
const closeTabJa = [
  // 法制・政策
  '宇宙基本法', '宇宙政策委員会',
  '宇宙開発利用', '宇宙活用法',
  '宇宙法', '宇宙損害賠償',
  '宇宙資源', '宇宙外交',
  // 衛星・測位
  '準天頂衛星', 'みちびき',
  '人工衛星', '衛星画像',
  'リモートセンシング', '測位衛星',
  // 打ち上げ・基地
  'ロケット打ち上げ', '種子島宇宙センター',
  '内之浦宇宙空間観測所', 'h3ロケット',
  'イプシロンロケット',
  // 宇宙ステーション・探査
  '国際宇宙ステーション', '宇宙飛行士',
  'きぼう', 'こうのとり',
  '探査機', 'はやぶさ',
  '月面探査', '火星探査',
  '小惑星探査',
  // 監視・環境
  '宇宙ゴミ', 'スペースデブリ',
  '宇宙状況監視', '宇宙天気',
  // 民間
  '民間宇宙', '宇宙ビジネス',
  '宇宙旅行', '宇宙航空研究開発機構',
];
const negate = [
  'still awaiting the launch window',
  'まだ打上げ前', 'これから打ち上げ',
  'まだ投入前',
];
const nullPins = [
  'about to file the launch notice',
  'about to visit the space center',
];
const establishedPins = [
  ['jaxa', 'close-tab'],
  ['宇宙研究機構', 'close-tab'],
];

describe('pass DCLXXXII: space development administration (squill)', () => {
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
