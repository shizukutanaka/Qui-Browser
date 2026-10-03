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
  // library card issued & branch reopened
  'library card issued', 'branch reopened',
];
const closeTabJa = [
  '図書館法', '学校図書館',
  '司書', '司書教諭',
  '蔵書目録', '貸出履歴',
  'レファレンス', '相互貸借',
  '移動図書館', '国立国会図書館',
  '納本制度', '地方出版物',
  '地域資料', '絵本講座',
  '読書会', '読書推進',
  '子ども読書', 'ブックスタート',
  '読書バリアフリー', '除籍図書',
  '寄贈本', '閉架書庫',
];
const negate = [
  'still awaiting the library card',
  'まだ貸出前', 'まだ予約待ち',
];
const nullPins = [
  'about to join the reading club',
  'about to join the book club',
];
const establishedPins = [
  ['about to renew the card', 'negate'],
  ['still on the waitlist', 'negate'],
];

describe('pass DCXVIII: library & reading-promotion administration (gaohu)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
