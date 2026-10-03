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
  // embassy notice posted & consulate appointment booked
  'embassy notice posted', 'consulate appointment booked',
];
const closeTabJa = [
  '外務省', '大使館',
  '領事館', '総領事館',
  '領事サービス', '国際機関',
  '条約締結', '経済協力',
  '政府開発援助', '文化交流',
  '在外邦人', '領事館員',
  '外交特権', '国際会議',
  '平和条約', '外交青書',
  '国際協力機構', '海外安全情報',
  'たびレジ', '外務報道官',
  '領事保護', 'ビザ免除',
  '外交使節', '領事館業務',
  '外務審議官', '領事面会',
];
const negate = [
  'still awaiting the consular service',
  'まだ査証申請前', 'これから査証申請',
];
const nullPins = [
  'about to file the treaty ratification',
  'about to visit the consulate',
];
const establishedPins = [
  // 'まだ申請中' already pinned negate — registered 'まだ査証申請前' instead
  ['まだ申請中', 'negate'],
];

describe('pass DCXXXIII: diplomatic & consular administration idioms (ghosh)', () => {
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
