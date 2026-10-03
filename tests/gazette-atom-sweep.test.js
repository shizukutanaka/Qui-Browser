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
  'paper published', 'correction issued',
];
const closeTabJa = [
  // 報道・取材
  '報道', '取材',
  '取材許可', '報道規制',
  '記者', '記者会見',
  '記者クラブ', '会見',
  // 倫理・権利
  '報道倫理', '報道の自由',
  '知る権利', 'オフレコ',
  '名誉毀損', '訂正要求',
  // 新聞
  '新聞', '新聞社',
  '全国紙', '地方紙',
  'スポーツ紙', '夕刊',
  '朝刊', '電子版',
  '購読料', '新聞販売所',
  // 記事・紙面
  '記事', '見出し',
  '一面', '社説',
  '論説', 'コラム',
  '連載', '号外',
  // 出版・編集
  '雑誌', '週刊誌',
  '出版社', '出版',
  '編集部', '編集長',
  '発行', '刊行',
  '紙面', '校閲',
  // 広報
  '報道官', '広報官',
  'スポークスマン', '広報部',
  '広報室', 'プレスリリース',
];
const negate = [
  'still awaiting the correction',
  'still awaiting the press release',
  'まだ発行前', 'まだ掲載前',
  'まだ校了前', 'まだ入稿前',
  'まだ取材中',
];
const nullPins = [
  'about to file the press release',
  'about to visit the newsroom',
];
const establishedPins = [
  ['報道機関', 'close-tab'],
  ['訂正記事', 'close-tab'],
  ['校了', 'close-tab'],
  ['版権', 'close-tab'],
  ['絶版', 'close-tab'],
  ['学術誌', 'close-tab'],
  ['off the record', 'close-tab'],
];

describe('pass DCXCI: press & media administration (gazette)', () => {
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
