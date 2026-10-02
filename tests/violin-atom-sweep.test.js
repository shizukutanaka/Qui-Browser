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
  // disability welfare service procedures done
  'day service contract signed',
];
const closeTabJa = [
  '障害福祉サービス', '受給者証',
  '通所介護', '居宅介護',
  '重度訪問介護', '同行援護',
  '行動援護', '就労継続支援',
  '就労移行支援', '就労定着支援',
  '継続支援a型', '継続支援b型',
  '自立訓練', '自立生活援助',
  '共同生活援助', 'グループホーム',
  '福祉ホーム', '放課後等デイサービス',
  '児童発達支援', '保育所等訪問支援',
  '療育', '障害児通所支援',
  '計画相談支援', 'サービス管理責任者',
  'サビ管', '支給決定',
  '障害支援区分', 'モニタリング',
];
const negate = [
  'still in rehab',
  'まだ利用中', 'これから利用',
  'まだ契約前',
];
const nullPins = [
  'mid assessment',
];
const establishedPins = [
  ['service certificate issued', 'security-status'],
  ['about to enroll', 'negate'],
  ['短期入所', 'close-tab'],
];

describe('pass DXLI: disability welfare service idioms (violin)', () => {
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
