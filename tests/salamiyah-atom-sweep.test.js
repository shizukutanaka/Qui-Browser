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
  // vehicle registration renewed & safety inspection done
  'vehicle registration renewed', 'safety inspection done',
];
const closeTabJa = [
  '道路運送車両法', '運輸支局',
  '自動車検査証', '自動車重量税',
  '運輸局', '運輸安全委員会',
  '自動車検査', '運転代行',
  '旅客運送', '貨物運送',
  '運送事業者', 'バス運行',
  'タクシー業務', '軽自動車検査',
  '自動車リサイクル', '道路運送法',
  '道路運送車両', '特殊自動車',
  '臨時運行許可', '自動車登録番号',
  '自動車新規登録', '自動車ナンバー',
  '自動車検査員', '運行管理士',
  '運行管理者', '運送約款',
];
const negate = [
  'still awaiting the vehicle registration',
  'まだ車検前', 'これから車検予約',
];
const nullPins = [
  'about to file the transport permit',
  'about to register the truck',
];
const establishedPins = [
  // '自動車登録' already pinned close-tab — registered '自動車新規登録' instead
  ['自動車登録', 'close-tab'],
  // 'まだ検査前' / 'これから車検' already pinned negate — registered まだ車検前/これから車検予約 instead
  ['まだ検査前', 'negate'],
  ['これから車検', 'negate'],
];

describe('pass DCXXXV: road transport administration idioms (salamiyah)', () => {
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
