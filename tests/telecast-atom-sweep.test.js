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
  'transmission approved', 'airtime cleared',
];
const closeTabJa = [
  // 放送行政・機関
  '放送倫理', '放送倫理委員会',
  '番組審議会', '放送番組審議会',
  'bpo', '視聴率',
  '民放連', '日本民間放送連盟',
  '放送免許', '送信所',
  // 放送種別
  'ラジオ放送', '短波放送',
  'コミュニティfm', '番組制作',
  // 制作職
  'プロデューサー', 'ディレクター',
  'アナウンサー', 'リポーター',
  'スポンサー',
  // 広告
  '広告倫理', '放送広告',
  '番組広告',
  // 著作権
  '著作権管理団体', 'jasrac',
  '著作権使用料', '印税',
  'ロイヤリティ', '著作権保護期間',
  '著作権登録', '演奏権',
  // 権利
  '上映権', '頒布権',
  '貸与権', '翻案権',
  // 表現・規制
  '二次的著作物', '引用',
  '知的財産権', '放送禁止',
  '番組規制',
  // 番組種別
  '電子番組表', 'ドラマ番組',
  'バラエティ番組', '教養番組',
  'アニメ番組',
  // 配信
  '動画配信', 'vod',
  'サブスク配信', 'コンテンツ制作',
];
const negate = [
  'still awaiting the airtime slot',
  'まだ放送前', 'まだ配信前',
  'まだ収録中',
];
const nullPins = [
  'about to visit the broadcast bureau',
  'about to file the broadcast license',
];
const establishedPins = [
  ['放送法', 'close-tab'],
  ['周波数割当', 'close-tab'],
  ['中継局', 'close-tab'],
  ['衛星放送', 'close-tab'],
  ['地上波デジタル', 'close-tab'],
  ['ケーブルテレビ', 'close-tab'],
  ['著作権侵害', 'close-tab'],
  ['著作者人格権', 'close-tab'],
  ['複製権', 'close-tab'],
  ['公衆送信権', 'close-tab'],
  ['広告主', 'close-tab'],
  ['still awaiting the broadcast license', 'negate'],
  ['まだ審査前', 'negate'],
  ['まだ許可前', 'negate'],
];

describe('pass DCXCV: broadcast & copyright administration (telecast)', () => {
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
