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
  // safety officer appointed & workplace inspection done
  'safety officer appointed', 'workplace inspection done',
];
const closeTabJa = [
  '労働安全衛生', '産業医',
  '衛生管理者', '安全管理者',
  '衛生推進者', '安全衛生推進者',
  '作業主任者', '特別教育',
  '技能講習', '危険作業',
  '立会検査', '二度災害',
  'ヒヤリハット', '安全パトロール',
  'リスクアセスメント', '作業環境測定',
  'ストレスチェック', '過重労働',
  '労基監督',
];
const negate = [
  'still awaiting the safety review',
  'まだ講習前', 'これから報告',
];
const nullPins = [
  'about to file a safety report', 'about to appoint an officer',
];
const establishedPins = [
  ['安全衛生委員会', 'close-tab'],
];

describe('pass DLXXXVI: occupational-safety & health-admin idioms (kaval)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
