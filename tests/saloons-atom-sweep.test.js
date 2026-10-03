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
  'club license renewed', 'lounge permit granted',
];
const closeTabJa = [
  // 法制・定義
  '風営法', '風俗営業等取締法',
  '風俗営業', '性的風俗',
  '特殊飲食店', '接待飲食',
  // 業種・飲食
  'キャバクラ', 'キャバレー',
  'スナック', 'バー営業',
  'ホストクラブ', 'クラブ営業',
  'ガールズバー', 'メイド喫茶',
  '深夜酒類提供飲食店',
  // 深夜営業
  '深夜酒類', '営業時間制限',
  '深夜営業', '朝方営業',
  // 性風俗
  'デリバリーヘルス', 'ソープランド',
  'ファッションヘルス', 'ピンサロ',
  'イメクラ', 'ラブホテル営業',
  '店舗型性風俗', '無店舗型性風俗',
  // 許可・届出
  '受付所', '風俗営業許可',
  '営業届出', '風俗営業届出',
  '特定遊興飲食店',
  // 規制区域
  '風俗営業規制区域', '規制区域',
  '繁華街', '歓楽街',
  '風俗環境保全地域',
  // 取締・管理
  '営業停止命令', '営業停止',
  '児童買春', '風俗営業管理責任者',
  '管理責任者', '客引き',
  // 遊技
  'パチンコ営業', '遊技場',
  '遊技機', '換金所',
  '三店方式',
];
const negate = [
  'still awaiting the club license',
  'still awaiting the entertainment permit',
  'これから営業', 'まだ営業中',
];
const nullPins = [
  'about to visit the host club',
  'about to file the entertainment license',
];
const establishedPins = [
  ['まだ開店前', 'negate'],
  ['まだ許可前', 'negate'],
  ['まだ届出前', 'negate'],
  ['まだ検査前', 'negate'],
];

describe('pass DCXCIV: adult-entertainment & nightlife regulation (saloons)', () => {
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
