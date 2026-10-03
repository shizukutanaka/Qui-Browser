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
  // shipping route opened & vessel registered
  'shipping route opened', 'vessel registered',
];
const closeTabJa = [
  '船員法', '船舶法',
  '船籍', '船舶登記',
  '船舶国籍', '船舶職員',
  '船舶職員証', '海員名簿',
  '船舶運航', '内航',
  '外航', '遠洋航海',
  '沿岸航海', '船主',
  '船舶所有者', '海運会社',
  '海運業', '船舶管理',
  '船舶代理店', '海運仲立',
  '海運組合', '海運振興',
  '商船隊', '日本郵船',
  '船舶公団', '海運国家',
  '海運政策', '海事思想',
  '海運秩序', '港湾労働',
  '埠頭作業', 'コンテナ船',
  '貨物船', '自動車運搬船',
  'ばら積み船', 'タンカー',
  '客船', 'フェリー',
  '定期船', '不定期船',
];
const negate = [
  'still awaiting the shipping permit',
  'これから出航',
];
const nullPins = [
  'about to file the vessel registry',
  'about to join the shipping guild',
];
const establishedPins = [
  ['まだ入港前', 'negate'],
  ['まだ運行前', 'negate'],
];

describe('pass DCLXIV: maritime & shipping administration idioms (regal2)', () => {
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
