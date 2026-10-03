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
  // emissions & climate plan
  'emissions trading launched', 'climate plan adopted',
];
const closeTabJa = [
  // 脱炭素・再エネ
  '脱炭素社会', 'カーボンニュートラル',
  'グリーン成長戦略', 'グリーントランスフォーメーション',
  '水素社会', 'アンモニア混焼',
  '洋上風力', '再エネ海域利用',
  '太陽光発電', '風力発電',
  '地熱発電', 'バイオマス発電',
  '蓄電池', 'スマートグリッド',
  'デマンドレスポンス', '再エネ',
  // 排出・炭素
  '排出量取引', '炭素税',
  'カーボンプライシング', '温室効果ガス',
  '排出削減', '削減目標',
  '排出インベントリ', 'スコープ3',
  'サプライチェーン排出', 'カーボンフットプリント',
  // 適応・災害
  '気候変動適応法', '適応計画',
  '気候リスク', 'ヒートアイランド',
  '線状降水帯', '海水面上昇',
  // 条約・国際
  'パリ協定', '京都議定書',
  '気候変動枠組条約', 'sdgs',
  '持続可能な開発目標', 'グリーン気候基金',
  // 汚染
  '大気汚染防止法', '水質汚濁防止法',
  'ダイオキシン類対策', '光化学オキシダント',
  '黄砂観測', 'マイクロプラスチック',
  'プラスチック資源循環促進法', '使い捨てプラスチック',
];
const negate = [
  'still awaiting the climate review',
  'まだ適応前', 'これから脱炭素化',
  'まだ削減中',
];
const nullPins = [
  'about to file the emissions report',
  'about to join the climate council',
];
const establishedPins = [
  ['熱中症警戒アラート', 'close-tab'],
  ['環境影響評価', 'close-tab'],
  ['絶滅危惧種', 'close-tab'],
  ['国立公園', 'close-tab'],
];

describe('pass DCLXXXI: climate & decarbonization administration (sprig)', () => {
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
