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
  // landlord-side done (大家・賃貸管理の終了側)
  'tenant screened', 'lease renewed',
  'key returned', 'unit cleaned',
  'deposit refunded', 'deposit kept',
  'repair quoted', 'painting done',
  'walkthrough inspected',
];
const closeTabJa = [
  '入居者を審査して', '契約を更新して',
  '家賃を回収して', '鍵を返してもらって',
  '部屋を掃除して', '敷金を返して',
  '敷金を差し引いて', '修理見積もりを取って',
  '壁紙を張り替えて', '退去立ち会いをして',
];
const negate = [
  'still collecting rent', 'about to inspect',
  'まだ家賃回収中', 'これから立ち会う',
];
const nullPins = [
  'mid turnover', 'landlord duties', 'rental unit',
  '退去準備中', '大家業', '賃貸物件',
];
const establishedPins = [
  ['rent collected', 'close-tab'],
];

describe('pass CDXLVII: landlord-side idioms (bonito)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
