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
  // school-lunch menu posted & health checkup roster done
  'school-lunch menu posted', 'health checkup roster done',
];
const closeTabJa = [
  '給食センター', '学校給食法',
  '栄養教諭', 'アレルギー対応食',
  '学校衛生管理', '歯科検診',
  '内科検診', '視力測定',
  '寄生虫検査', '心臓検診',
  '尿検査', '検尿',
  '保健委員会', '校医',
  '養護教諭', '保健室',
  '保健指導', '食物アレルギー',
  '生活管理指導表', '牛乳中止',
  '学校衛生委員会', '体育祭',
  '体力テスト', '学校保健委員会',
];
const negate = [
  'still awaiting the lunch menu',
  'まだ給食前', 'これから健診',
];
const nullPins = [
  'about to start the health screening', 'about to post the lunch menu',
  // nashi null pin — kept unregistered, 視力測定 registered instead
  '視力検査',
];
const establishedPins = [
  ['定期健康診断', 'close-tab'], ['就学時健康診断', 'close-tab'],
  ['給食費', 'close-tab'],
];

describe('pass DCX: school-lunch & school-health idioms (khaen)', () => {
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
