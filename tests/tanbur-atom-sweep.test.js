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
  // npo registered & nonprofit charter filed
  'npo registered', 'nonprofit charter filed',
];
const closeTabJa = [
  'npo法人', '一般社団法人',
  '公益法人', '認定npo',
  '寄附金控除', '代表理事',
  '理事会', '社員総会',
  '評議員会', '監事',
  '監査役', '定款寄附',
  '活動計算書', '会費収入',
  '助成金申請', '公益目的事業',
  '収益事業', '事業報告書',
  '貸借対照表', '正味財産増減計算書',
  '管理費割合', 'コミュニティ財団',
  '助成団体', '非営利団体',
  '任意団体', '法人格取得',
  '設立登記', '解散清算',
  '残余財産', '清算結了',
  '法人番号',
];
const negate = [
  'まだ設立前', 'これから設立登記',
  'まだ総会前',
];
const nullPins = [
  'about to file the articles', 'about to register the nonprofit',
];
const establishedPins = [
  ['定款変更', 'close-tab'],
  ['still awaiting the registration', 'negate'],
  ['まだ登記前', 'negate'],
];

describe('pass DCXV: npo & public-interest corporation idioms (tanbur)', () => {
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
