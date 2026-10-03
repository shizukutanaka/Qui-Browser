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
  'appeal accepted', 'hearing scheduled',
];
const closeTabJa = [
  // 不服申立
  '行政不服', '再審査請求',
  '教示', '異議申立て',
  '不服申立て', '異議申立受理',
  // 訴訟類型
  '行政訴訟', '取消訴訟',
  '無効確認訴訟', '義務付け訴訟',
  '差止訴訟', '抗告訴訟',
  '当事者訴訟', '不作為訴訟',
  // 手続き・聴聞
  '行政手続き法', '聴聞',
  '弁明', '意見陳述',
  '公開聴聞', '聴聞会',
  // 執行・強制
  '行政強制', '行政執行',
  '行政執行法', '間接強制',
  '代執行', '執行停止',
  '仮の救済',
  // 機関・裁決
  '第三者機関', '審理員',
  '答弁書', '被告行政庁',
  '裁決', '裁決書',
  '参加人',
  // 訴訟進行
  '提訴', '訴状',
  '控訴', '上告',
  '上告審', '判例',
  '和解勧告', '執行抗告',
  // 書面・争点
  '証拠書面', '陳述書',
  '理由附記', '認容',
  '棄却', '原告適格',
  '争点',
];
const negate = [
  'still awaiting the appeal hearing',
  'still awaiting the ruling',
  'まだ審理中', 'まだ裁決前',
  'これから訴訟', 'まだ申立前',
  'まだ上告前',
];
const nullPins = [
  'about to file the appeal brief',
  'about to attend the hearing',
];
const establishedPins = [
  ['行政不服審査', 'close-tab'],
  ['審査請求', 'close-tab'],
  ['住民訴訟', 'close-tab'],
  ['行政処分', 'close-tab'],
  ['強制執行', 'close-tab'],
  ['審査会', 'close-tab'],
  ['地方裁判所', 'close-tab'],
  ['最高裁判所', 'close-tab'],
  ['閲覧請求', 'close-tab'],
  ['case dismissed', 'close-tab'],
  ['まだ審査中', 'negate'],
  ['これから審査', 'negate'],
  ['まだ判決前', 'negate'],
];

describe('pass DCXC: administrative appeals & litigation (writ)', () => {
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
