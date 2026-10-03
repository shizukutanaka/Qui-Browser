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
  // logistics plan approved & freight permit granted
  'logistics plan approved', 'freight permit granted',
];
const closeTabJa = [
  '物流効率化法', '物流二〇二四年問題',
  '運輸安全マネジメント評価', '宅配便',
  'トラック運送業', '貸切バス',
  '乗合バス', '共同輸送',
  'モーダルシフト', '鉄道貨物',
  '内航海運', '物流センター',
  '共同配送', 'ラストワンマイル',
  '標準貨物運送約款', '輸送力供給',
  '幹線輸送', '海上輸送',
  '港湾運送', '外航海運',
  '物流拠点', '運送支払',
  '物流人材', '物流施設',
  '荷役作業', '運送業免許',
  '旅客運送業免許', '貨物運送業免許',
  '運輸調査',
];
const negate = [
  'still awaiting the freight license',
  'これから開業', 'これから輸送届',
];
const nullPins = [
  'about to file the transport plan',
  'about to join the freight co-op',
];
const establishedPins = [
  // already pinned negate — registered これから開業/これから輸送届 instead
  ['まだ運行前', 'negate'],
  ['まだ免許申請前', 'negate'],
];

describe('pass DCXLVII: logistics administration idioms (gusli)', () => {
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
