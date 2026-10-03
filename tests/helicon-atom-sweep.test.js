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
  // patent granted & design registered
  'patent granted', 'design registered',
];
const closeTabJa = [
  '著作権', '著作権法',
  '著作者人格権', '著作隣接権',
  '版権', '著作権管理',
  '著作権侵害', '複製権',
  '公衆送信権', '特許査定',
  '優先権', 'パリ条約',
  '特許明細書', '請求項',
  '発明者', '先行技術',
  '新規性', '進歩性',
  '均等論', '審判',
  '侵害訴訟', '無効審判',
  '出願審査', '変更出願',
  '国内移行', '知財高裁',
  '特許異議', '商標異議',
  '商標更新', '意匠権',
  '実用新案権', '半導体集積回路',
  '育成者権', '地理的表示',
  '商標法', '特許協力条約',
];
const negate = [
  'still awaiting the patent grant',
  'まだ出願前',
];
const nullPins = [
  'about to file the design application',
  'about to contest the invalidity ruling',
];
const establishedPins = [
  ['これから出願', 'negate'],
  ['まだ審査前', 'negate'],
  ['これから審査請求', 'negate'],
];

describe('pass DCLVI: patent & intellectual-property administration idioms (helicon)', () => {
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
