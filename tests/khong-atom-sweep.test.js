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
  // customs clearance done & duty deferral granted
  'customs clearance done', 'duty deferral granted',
];
const closeTabJa = [
  '税関', '通関業者',
  '通関士', '輸入申告',
  '輸出申告', '関税評価',
  '関税分類', '税関検査',
  '保税地域', '保税倉庫',
  '特定保税承認', '特恵関税',
  '原産地証明', '経済連携協定',
  '輸入監視', '輸出入禁止品',
  '携帯品免税', '別送品',
  '旅客携帯品', '免税店',
  '関税割当', '更正の請求',
  '関税審査会', '関税率表',
  '関税暫定措置法', '関税定率法',
  '通関情報処理',
];
const negate = [
  'still awaiting the customs clearance',
  'まだ通関前',
];
const nullPins = [
  'about to file the import declaration',
  'about to enter the bonded warehouse',
  // 'about to claim the origin certificate' — security-status pins it
];
const establishedPins = [
  ['納付猶予', 'close-tab'],
  ['これから申告', 'negate'],
  ['about to claim the origin certificate', 'security-status'],
];

describe('pass DCXXII: customs & tariff administration idioms (khong)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
